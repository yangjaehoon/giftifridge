import AsyncStorage from '@react-native-async-storage/async-storage';
import * as MediaLibrary from 'expo-media-library';
import { newGifticonId } from './gifticonService';
import { saveGifticon } from './saveGifticon';
import { syncGifticonReminders } from './gifticonReminders';
import {
  guessGifticonFields,
  parseAmountFromText,
  parseExpiryDateFromText,
  recognizeText,
} from './ocrService';
import { recognizeBarcodeFromImage } from './barcodeRecognition';
import { defaultExpiryDate, toDateString } from '../../../shared/utils/date';
import type { GifticonCategory } from '../types';

// Everything about turning "a new photo appeared in the gallery" into a saved
// gifticon: the persisted scan cursor / dedupe set, the (best-effort) heuristic
// for "this looks like a gifticon", and the create. Called both by the
// foreground listener (useGalleryAutoImport) and the background task
// (galleryImportTask.ts), so the two can't drift on what counts as "new" or
// "already handled".

export const ENABLED_KEY = 'galleryImportEnabled';
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

// Guards against two scans running at once (the foreground listener can fire
// again — a burst of new photos, a share-sheet save — before a scan already
// in flight has persisted its cursor/dedupe state), which would otherwise let
// both read the same "already imported" snapshot and double-create the same
// photo. Callers that overlap just await the scan already running.
let scanInFlight: Promise<number> | null = null;

/**
 * Scans for photos added to the gallery since the last check and auto-creates
 * a gifticon for each one that looks like one — no confirmation step, per the
 * feature's design. Returns the number created. A no-op (returns 0) without
 * permission, so it's safe to call from a background task that runs before
 * the user has ever granted it.
 */
export function scanGalleryForGifticons(ownerId: string): Promise<number> {
  if (scanInFlight) return scanInFlight;
  const scan = runScan(ownerId).finally(() => {
    scanInFlight = null;
  });
  scanInFlight = scan;
  return scan;
}

async function runScan(ownerId: string): Promise<number> {
  const permission = await MediaLibrary.getPermissionsAsync(false, ['photo']);
  if (!permission.granted) return 0;

  const lastCheckedAt = await getLastCheckedAt();
  const importedIds = await getImportedIds();

  // >= (not the tighter >) so an asset sharing the exact same creationTime as
  // the persisted cursor — plausible given some devices only record
  // second-level precision — is re-fetched rather than permanently skipped;
  // the dedupe set below is what actually stops it from being reprocessed.
  const assets = await new MediaLibrary.Query()
    .eq(MediaLibrary.AssetField.MEDIA_TYPE, MediaLibrary.MediaType.IMAGE)
    .gte(MediaLibrary.AssetField.CREATION_TIME, lastCheckedAt)
    .orderBy(MediaLibrary.AssetField.CREATION_TIME)
    .limit(BATCH_LIMIT)
    .exe();

  let imported = 0;
  let newestCheckedAt = lastCheckedAt;

  try {
    for (const asset of assets) {
      const creationTime = (await asset.getCreationTime()) ?? Date.now();
      newestCheckedAt = Math.max(newestCheckedAt, creationTime);
      if (importedIds.has(asset.id)) continue;

      const uri = await asset.getUri();
      const text = await recognizeText(uri);
      if (text == null || !looksLikeGifticon(text)) {
        // Decided it's not a gifticon — remember that so it isn't re-OCR'd
        // every scan, but don't mark it done before a create is even tried.
        importedIds.add(asset.id);
        continue;
      }

      // Only worth the extra native call for photos already confirmed to
      // look like a gifticon — no point barcode-scanning everything else.
      const barcode = await recognizeBarcodeFromImage(uri);
      const { brand, name, category } = guessGifticonFields(text);
      const draftId = newGifticonId();
      const fields = {
        name: name ?? FALLBACK_NAME,
        brand: brand ?? FALLBACK_BRAND,
        category: category ?? FALLBACK_CATEGORY,
        expiresAt: parseExpiryDateFromText(text) ?? toDateString(defaultExpiryDate()),
        barcode: barcode ?? undefined,
        amount: parseAmountFromText(text) ?? undefined,
      };
      await saveGifticon({ draftId, ownerId, imageUri: uri, imageChanged: true, fields });
      // Only marked done once the create actually went through — if
      // saveGifticon throws, this asset is left off the dedupe set so the
      // next scan retries it instead of silently losing the photo.
      importedIds.add(asset.id);
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
  } finally {
    // Persist whatever progress was made even if one asset's OCR/create threw
    // partway through — otherwise the next scan re-fetches (and re-creates a
    // duplicate for) every photo already successfully imported this run.
    await AsyncStorage.setItem(LAST_CHECKED_KEY, String(newestCheckedAt));
    await saveImportedIds(importedIds);
  }
  return imported;
}
