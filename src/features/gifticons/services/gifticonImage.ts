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

function imageRef(gifticonId: string) {
  return storageRef(`gifticons/${gifticonId}.jpg`);
}

/**
 * Resizes/compresses the picked image and uploads it to Storage, returning its
 * download URL. Only the URL goes on the Firestore doc — a base64 image would
 * push the doc toward the 1 MiB limit and force every space member's onSnapshot
 * to re-download it on any write. The object is keyed by the gifticon id, so a
 * retry after a timeout overwrites the same file instead of orphaning one.
 */
export async function uploadGifticonImage(gifticonId: string, localUri: string): Promise<string> {
  const resized = await ImageManipulator.manipulateAsync(
    localUri,
    [{ resize: { width: IMAGE_MAX_DIMENSION } }],
    { compress: IMAGE_COMPRESS_QUALITY, format: ImageManipulator.SaveFormat.JPEG },
  );
  const blob = await (await fetch(resized.uri)).blob();
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
