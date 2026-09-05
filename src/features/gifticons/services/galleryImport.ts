import AsyncStorage from '@react-native-async-storage/async-storage';
import * as MediaLibrary from 'expo-media-library';
import { newGifticonId } from './gifticonService';
import { saveGifticon } from './saveGifticon';
import { syncGifticonReminders } from './gifticonReminders';
import { parseExpiryDateFromText, recognizeText } from './ocrService';
import { toDateString } from '../../../shared/utils/date';
import type { GifticonCategory } from '../types';

// Everything about turning "a new photo appeared in the gallery" into a saved
// gifticon: the persisted scan cursor / dedupe set, the (best-effort) heuristic
// for "this looks like a gifticon", and the create. Called both by the
// foreground listener (useGalleryAutoImport) and the background task
// (galleryImportTask.ts), so the two can't drift on what counts as "new" or
// "already handled".

const LAST_CHECKED_KEY = 'galleryImportLastCheckedAt';
const IMPORTED_IDS_KEY = 'galleryImportImportedIds';
// Bounds the dedupe set's storage footprint; recent-enough that a normal scan
// cadence never sees the same asset id twice before it would roll off anyway.
const IMPORTED_IDS_CAP = 500;
// Caps how many photos one scan processes (each one is an OCR pass), so a
// single run — especially a background one with a limited execution window —
// can't run long or drain the battery.
const BATCH_LIMIT = 20;

const GIFTICON_KEYWORDS = ['기프티콘', '교환권', '모바일교환권', '쿠폰'];
const FALLBACK_CATEGORY: GifticonCategory = 'etc';
const FALLBACK_BRAND = '미확인 브랜드';
const FALLBACK_NAME = '새 기프티콘';

/**
 * A real expiry-date match is the strongest signal (most non-gifticon photos
 * don't contain what looks like a calendar date next to an expiry keyword);
 * the keyword list catches gifticons whose date OCR couldn't parse.
 */
function looksLikeGifticon(text: string): boolean {
  return (
    parseExpiryDateFromText(text) != null ||
    GIFTICON_KEYWORDS.some((keyword) => text.includes(keyword))
  );
}

function defaultExpiry(): string {
  const d = new Date();
  d.setMonth(d.getMonth() + 1);
  return toDateString(d);
}

// There's no reliable way to pick the product name out of OCR text (unlike a
// date, it has no consistent shape), so this is a rough guess the user is
// expected to correct afterward — the first short-enough non-empty line.
function guessName(text: string): string {
  const line = text
    .split('\n')
    .map((l) => l.trim())
    .find((l) => l.length > 0 && l.length <= 30);
  return line ?? FALLBACK_NAME;
}

async function getLastCheckedAt(): Promise<number> {
  const raw = await AsyncStorage.getItem(LAST_CHECKED_KEY);
  if (raw != null) return Number(raw);
  // First run ever: only look forward from here, never backfill the user's
  // entire existing camera roll as "new".
  const now = Date.now();
  await AsyncStorage.setItem(LAST_CHECKED_KEY, String(now));
  return now;
}

async function getImportedIds(): Promise<Set<string>> {
  const raw = await AsyncStorage.getItem(IMPORTED_IDS_KEY);
  if (!raw) return new Set();
  try {
    const parsed = JSON.parse(raw);
    return new Set(Array.isArray(parsed) ? parsed : []);
  } catch {
    return new Set();
  }
}

async function saveImportedIds(ids: Set<string>): Promise<void> {
  const trimmed = Array.from(ids).slice(-IMPORTED_IDS_CAP);
  await AsyncStorage.setItem(IMPORTED_IDS_KEY, JSON.stringify(trimmed));
}

/** Checks/requests photo-library read permission, granular to images only. */
export async function ensureGalleryImportPermission(): Promise<boolean> {
  const current = await MediaLibrary.getPermissionsAsync(false, ['photo']);
  if (current.granted) return true;
  if (!current.canAskAgain) return false;
  const requested = await MediaLibrary.requestPermissionsAsync(false, ['photo']);
  return requested.granted;
}

/**
 * Scans for photos added to the gallery since the last check and auto-creates
 * a gifticon for each one that looks like one — no confirmation step, per the
 * feature's design. Returns the number created. A no-op (returns 0) without
 * permission, so it's safe to call from a background task that runs before
 * the user has ever granted it.
 */
export async function scanGalleryForGifticons(ownerId: string): Promise<number> {
  const permission = await MediaLibrary.getPermissionsAsync(false, ['photo']);
  if (!permission.granted) return 0;

  const lastCheckedAt = await getLastCheckedAt();
  const importedIds = await getImportedIds();

  const assets = await new MediaLibrary.Query()
    .eq(MediaLibrary.AssetField.MEDIA_TYPE, MediaLibrary.MediaType.IMAGE)
    .gt(MediaLibrary.AssetField.CREATION_TIME, lastCheckedAt)
    .orderBy(MediaLibrary.AssetField.CREATION_TIME)
    .limit(BATCH_LIMIT)
    .exe();

  let imported = 0;
  let newestCheckedAt = lastCheckedAt;

  for (const asset of assets) {
    const creationTime = (await asset.getCreationTime()) ?? Date.now();
    newestCheckedAt = Math.max(newestCheckedAt, creationTime);
    if (importedIds.has(asset.id)) continue;
    importedIds.add(asset.id);

    const uri = await asset.getUri();
    const text = await recognizeText(uri);
    if (text == null || !looksLikeGifticon(text)) continue;

    const draftId = newGifticonId();
    const fields = {
      name: guessName(text),
      brand: FALLBACK_BRAND,
      category: FALLBACK_CATEGORY,
      expiresAt: parseExpiryDateFromText(text) ?? defaultExpiry(),
    };
    await saveGifticon({ draftId, ownerId, imageUri: uri, imageChanged: true, fields });
    await syncGifticonReminders({
      gifticon: {
        id: draftId,
        name: fields.name,
        brand: fields.brand,
        expiresAt: fields.expiresAt,
      },
      isOwner: true,
      isEditing: false,
    });
    imported += 1;
  }

  await AsyncStorage.setItem(LAST_CHECKED_KEY, String(newestCheckedAt));
  await saveImportedIds(importedIds);
  return imported;
}
