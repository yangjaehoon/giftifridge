import * as ImageManipulator from 'expo-image-manipulator';
import {
  deleteObject,
  getDownloadURL,
  storageRef,
  uploadBytes,
} from '../../../lib/firebase/storage';

// Everything about a gifticon's photo lives here (resize/compress, Storage
// upload/delete) so the doc-CRUD service in gifticonService.ts stays free of
// expo-image-manipulator, Storage, and the fetch/blob dance.

const IMAGE_MAX_DIMENSION = 900;
const IMAGE_COMPRESS_QUALITY = 0.5;
// storage.rules rejects an upload of 1 MiB or more; stay clearly under it. A
// busy, tall screenshot (resized to 900px wide it can still be ~900x2000) can
// exceed that even at quality 0.5, so re-encode it smaller until it fits rather
// than letting uploadBytes fail with storage/unauthorized.
const MAX_UPLOAD_BYTES = 950 * 1024;
const MIN_COMPRESS_QUALITY = 0.2;
const MIN_DIMENSION = 480;
const QUALITY_STEP = 0.15;
const DIMENSION_STEP = 0.8;

function imageRef(gifticonId: string) {
  return storageRef(`gifticons/${gifticonId}.jpg`);
}

async function encodeJpeg(localUri: string, width: number, quality: number): Promise<Blob> {
  const { uri } = await ImageManipulator.manipulateAsync(localUri, [{ resize: { width } }], {
    compress: quality,
    format: ImageManipulator.SaveFormat.JPEG,
  });
  return (await fetch(uri)).blob();
}

/**
 * Resizes/compresses to a JPEG that's under the Storage size cap. The first
 * over-cap result is used to scale quality down in one ratio-based jump (a full
 * re-decode of a multi-megapixel original isn't cheap), then quality is stepped
 * to the floor and only after that the dimension — so a large screenshot
 * converges in ~2 passes instead of 6. `blob.size` can be undefined on some RN
 * builds; treat that as "fits" so this degrades to the old single pass.
 */
async function compressUnderLimit(localUri: string): Promise<Blob> {
  let width = IMAGE_MAX_DIMENSION;
  let quality = IMAGE_COMPRESS_QUALITY;
  let blob = await encodeJpeg(localUri, width, quality);

  if (blob.size > MAX_UPLOAD_BYTES) {
    // JPEG size drops faster than linearly as quality falls, so scaling by the
    // measured overshoot ratio lands under the cap in one more encode almost
    // every time (and never overshoots badly upward).
    quality = Math.max(MIN_COMPRESS_QUALITY, quality * (MAX_UPLOAD_BYTES / blob.size));
    blob = await encodeJpeg(localUri, width, quality);
  }

  while (
    blob.size > MAX_UPLOAD_BYTES &&
    (quality > MIN_COMPRESS_QUALITY || width > MIN_DIMENSION)
  ) {
    if (quality > MIN_COMPRESS_QUALITY) {
      quality = Math.max(MIN_COMPRESS_QUALITY, quality - QUALITY_STEP);
    } else {
      width = Math.max(MIN_DIMENSION, Math.round(width * DIMENSION_STEP));
    }
    blob = await encodeJpeg(localUri, width, quality);
  }

  return blob;
}

/**
 * Resizes/compresses the picked image and uploads it to Storage, returning its
 * download URL. Only the URL goes on the Firestore doc — a base64 image would
 * push the doc toward the 1 MiB limit and force every space member's onSnapshot
 * to re-download it on any write. The object is keyed by the gifticon id, so a
 * retry after a timeout overwrites the same file instead of orphaning one.
 */
export async function uploadGifticonImage(gifticonId: string, localUri: string): Promise<string> {
  const blob = await compressUnderLimit(localUri);
  const objectRef = imageRef(gifticonId);
  await uploadBytes(objectRef, blob, { contentType: 'image/jpeg' });
  return getDownloadURL(objectRef);
}

/** Best-effort removal of a gifticon's Storage image (called on delete). */
export async function deleteGifticonImage(gifticonId: string): Promise<void> {
  try {
    await deleteObject(imageRef(gifticonId));
  } catch {
    // already gone, or never uploaded (e.g. an old base64 doc)
  }
}
