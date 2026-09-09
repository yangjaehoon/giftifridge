import AsyncStorage from '@react-native-async-storage/async-storage';
import * as MediaLibrary from 'expo-media-library';
import { newGifticonId } from '../domain/services/gifticonService';
import { readCachedBarcodes } from '../domain/services/gifticonCache';
import { saveGifticon } from '../domain/services/saveGifticon';
import { syncGifticonReminders } from '../domain/services/gifticonReminders';
import {
  assessGifticon,
  guessGifticonFields,
  isRetryWorthwhile,
  recognizeText,
  resolveImportAmount,
} from '../ocr/ocrService';
import { recognizeBarcodeFromImage } from '../ocr/barcodeRecognition';
import { captureCorpusCase, ocrDebugLog } from '../ocr/debugLog';
import type { GifticonCategory } from '../domain/types';

// Everything about turning "a new photo appeared in the gallery" into a saved
// gifticon: the persisted scan cursor / dedupe set, the "is this a gifticon"
// score (see ocr/gifticonScore), and the create. Called both by the foreground
// listener (useGalleryAutoImport) and the background task (galleryImportTask),
// so the two can't drift on what counts as "new" or "already handled".

export const ENABLED_KEY = 'galleryImportEnabled';
const LAST_CHECKED_KEY = 'galleryImportLastCheckedAt';
const IMPORTED_IDS_KEY = 'galleryImportImportedIds';
const RETRIES_KEY = 'galleryImportRetries';
// Bounds the dedupe set's storage footprint; recent-enough that a normal scan
// cadence never sees the same asset id twice before it would roll off anyway.
const IMPORTED_IDS_CAP = 500;
// A photo that scored close but not enough (isRetryWorthwhile) gets this many
// more OCR passes on later scans before it's given up on for good — enough for
// an improved parser or a re-photo to land, without re-OCRing it forever.
const MAX_IMPORT_RETRIES = 2;
// Caps how many photos one scan processes (each one is an OCR pass), so a
// single run — especially a background one with a limited execution window —
// can't run long or drain the battery.
const BATCH_LIMIT = 20;

const FALLBACK_CATEGORY: GifticonCategory = 'etc';
const FALLBACK_BRAND = '미확인 브랜드';
const FALLBACK_NAME = '새 기프티콘';

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

async function getRetries(): Promise<Map<string, number>> {
  const raw = await AsyncStorage.getItem(RETRIES_KEY);
  if (!raw) return new Map();
  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return new Map();
    return new Map(
      Object.entries(parsed).filter(([, v]) => typeof v === 'number') as [string, number][],
    );
  } catch {
    return new Map();
  }
}

async function saveRetries(retries: Map<string, number>): Promise<void> {
  const entries = Array.from(retries.entries()).slice(-IMPORTED_IDS_CAP);
  await AsyncStorage.setItem(RETRIES_KEY, JSON.stringify(Object.fromEntries(entries)));
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
  const retries = await getRetries();
  // Barcodes the user already has (from the offline list mirror) — a re-photo
  // of an existing gifticon shouldn't become a second entry. Also grows within
  // this scan so a burst of the same gifticon can't double-create.
  const knownBarcodes = await readCachedBarcodes();

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
  // The scan cursor is held back to just before the oldest still-retryable
  // asset, so a later scan re-fetches and re-OCRs it.
  let oldestPending = Number.POSITIVE_INFINITY;

  try {
    for (const asset of assets) {
      const creationTime = (await asset.getCreationTime()) ?? Date.now();
      newestCheckedAt = Math.max(newestCheckedAt, creationTime);
      if (importedIds.has(asset.id)) continue;

      const uri = await asset.getUri();
      const recognized = await recognizeText(uri);
      // Text-only score first; then, only if a decoded barcode graphic could
      // matter (there's a confident date and the +5 could carry a short score
      // over), spend the native scan and re-score with it folded in.
      const textAssessment = recognized ? assessGifticon(recognized.text) : null;
      const scannedBarcode =
        textAssessment?.worthGraphicScan === true ? await recognizeBarcodeFromImage(uri) : null;
      const assessment =
        recognized == null
          ? null
          : scannedBarcode == null
            ? textAssessment
            : assessGifticon(recognized.text, scannedBarcode);

      // A confident, non-stale expiry date is mandatory (this no-review flow
      // never invents or guesses one), plus a high enough gifticon-likeness
      // score. The `expiresAt == null` check is implied by `!create` but kept
      // so TS narrows `assessment.expiresAt` to `string` past this guard.
      if (
        recognized == null ||
        assessment == null ||
        assessment.expiresAt == null ||
        !assessment.create
      ) {
        // Remember the decision so it isn't re-OCR'd every scan, but don't mark
        // it done before a create is even tried.
        ocrDebugLog('gallery-import skip', {
          textRead: recognized != null,
          score: assessment?.score ?? null,
          signals: assessment?.signals ?? null,
          expiresAt: assessment?.expiresAt ?? null,
        });
        if (recognized != null && assessment != null) {
          captureCorpusCase({
            text: recognized.text,
            isGifticon: false,
            expiresAt: assessment.expiresAt,
            barcode: assessment.barcode,
            amount: assessment.amount,
          });
        }
        // Close-but-not-enough with a real date: leave it off the done set and
        // hold the cursor so a later scan retries it, up to MAX_IMPORT_RETRIES.
        if (
          assessment != null &&
          isRetryWorthwhile(assessment) &&
          (retries.get(asset.id) ?? 0) < MAX_IMPORT_RETRIES
        ) {
          retries.set(asset.id, (retries.get(asset.id) ?? 0) + 1);
          oldestPending = Math.min(oldestPending, creationTime);
        } else {
          retries.delete(asset.id);
          importedIds.add(asset.id);
        }
        continue;
      }

      const barcode = assessment.barcode;
      if (barcode != null && knownBarcodes.has(barcode)) {
        // Already have this gifticon — a re-photo, not a new one.
        ocrDebugLog('gallery-import skip', {
          reason: 'duplicate barcode',
          score: assessment.score,
        });
        retries.delete(asset.id);
        importedIds.add(asset.id);
        continue;
      }

      const { brand, name, category } = guessGifticonFields(recognized);
      // Drops a bare "N원" that reads as a printed menu price on a cafe/
      // restaurant coupon, so the gifticon isn't shown as a 금액권 with a
      // spend-down balance.
      const amount = resolveImportAmount(assessment, category);
      const draftId = newGifticonId();
      const fields = {
        name: name ?? FALLBACK_NAME,
        brand: brand ?? FALLBACK_BRAND,
        category: category ?? FALLBACK_CATEGORY,
        expiresAt: assessment.expiresAt,
        barcode: barcode ?? undefined,
        amount: amount ?? undefined,
      };
      ocrDebugLog('gallery-import create', {
        name: fields.name,
        brand: fields.brand,
        category: fields.category,
        expiresAt: fields.expiresAt,
        amount: fields.amount ?? null,
        barcode: fields.barcode ? `<${fields.barcode.length} digits>` : null,
        brandGuessed: brand != null,
        nameGuessed: name != null,
        score: assessment.score,
        signals: assessment.signals,
      });
      captureCorpusCase({
        text: recognized.text,
        isGifticon: true,
        brand,
        category,
        expiresAt: fields.expiresAt,
        barcode,
        amount,
      });
      await saveGifticon({ draftId, ownerId, imageUri: uri, imageChanged: true, fields });
      // Only marked done once the create actually went through — if
      // saveGifticon throws, this asset is left off the dedupe set so the
      // next scan retries it instead of silently losing the photo.
      retries.delete(asset.id);
      importedIds.add(asset.id);
      if (barcode != null) knownBarcodes.add(barcode);
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
    // duplicate for) every photo already successfully imported this run. The
    // cursor stops just before the oldest still-retryable asset (Math.min with
    // Infinity is a no-op when nothing is pending).
    await AsyncStorage.setItem(LAST_CHECKED_KEY, String(Math.min(newestCheckedAt, oldestPending)));
    await saveImportedIds(importedIds);
    await saveRetries(retries);
  }
  return imported;
}
