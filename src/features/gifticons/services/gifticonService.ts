import {
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  setDoc,
  updateDoc,
  where,
  type DocumentData,
} from 'firebase/firestore';
import * as ImageManipulator from 'expo-image-manipulator';
import { db } from '../../../lib/firebase/config';
import type { Gifticon, NewGifticon } from '../types';

const COLLECTION = 'gifticons';
const IMAGE_MAX_DIMENSION = 900;
const IMAGE_COMPRESS_QUALITY = 0.5;

/**
 * Resizes/compresses the image and returns it as a data: URL so it can be
 * stored directly on the Firestore doc — needed for shared-space gifticons,
 * since a local file:// path is only ever visible on the device that made it.
 */
export async function encodeGifticonImage(localUri: string): Promise<string> {
  const result = await ImageManipulator.manipulateAsync(
    localUri,
    [{ resize: { width: IMAGE_MAX_DIMENSION } }],
    { compress: IMAGE_COMPRESS_QUALITY, format: ImageManipulator.SaveFormat.JPEG, base64: true },
  );
  if (!result.base64) {
    throw new Error('Failed to encode gifticon image');
  }
  return `data:image/jpeg;base64,${result.base64}`;
}

// Firestore rejects any field explicitly set to `undefined` (e.g. an unset
// optional barcode/amount/location/spaceId) unless ignoreUndefinedProperties
// is configured, which it isn't — so strip those keys before writing.
function omitUndefined<T extends object>(data: T): Partial<T> {
  return Object.fromEntries(
    Object.entries(data).filter(([, value]) => value !== undefined),
  ) as Partial<T>;
}

// Firestore only guarantees the field types the security rules enforce going
// forward; a doc written before those rules (or by a future schema change) can
// still be missing required strings, which would render as `D-NaN` and crash
// date math downstream. Drop anything that isn't a usable Gifticon.
function toGifticon(id: string, data: DocumentData): Gifticon | null {
  if (
    typeof data.ownerId !== 'string' ||
    typeof data.name !== 'string' ||
    typeof data.brand !== 'string' ||
    typeof data.category !== 'string' ||
    typeof data.imageUrl !== 'string' ||
    typeof data.expiresAt !== 'string' ||
    Number.isNaN(new Date(data.expiresAt).getTime())
  ) {
    return null;
  }
  return { id, ...(data as Omit<Gifticon, 'id'>) };
}

// A client-side id, so a create that is retried after a timeout (which doesn't
// cancel the original write) overwrites the same doc instead of inserting a
// duplicate.
export function newGifticonId(): string {
  return doc(collection(db, COLLECTION)).id;
}

export async function createGifticon(
  id: string,
  ownerId: string,
  data: NewGifticon,
): Promise<string> {
  await setDoc(doc(db, COLLECTION, id), {
    ...omitUndefined(data),
    ownerId,
    isUsed: false,
    createdAt: new Date().toISOString(),
  });
  return id;
}

// updateDoc leaves fields it isn't given untouched, unlike addDoc — so an
// optional field the user cleared (e.g. removed the barcode) must be written
// as `null` here, not omitted, or the old value would silently stick around.
export async function updateGifticon(id: string, data: NewGifticon): Promise<void> {
  await updateDoc(doc(db, COLLECTION, id), {
    name: data.name,
    brand: data.brand,
    category: data.category,
    imageUrl: data.imageUrl,
    expiresAt: data.expiresAt,
    barcode: data.barcode ?? null,
    amount: data.amount ?? null,
    location: data.location ?? null,
  });
}

export function subscribeToGifticons(
  ownerId: string,
  onChange: (items: Gifticon[]) => void,
  onError?: (error: Error) => void,
) {
  const q = query(
    collection(db, COLLECTION),
    where('ownerId', '==', ownerId),
    orderBy('expiresAt', 'asc'),
  );
  return onSnapshot(
    q,
    (snapshot) => {
      // A doc missing spaceId entirely doesn't match `where('spaceId','==',null)`,
      // so personal-vs-space filtering happens here instead of in the query.
      const items = snapshot.docs
        .map((d) => toGifticon(d.id, d.data()))
        .filter((item): item is Gifticon => item !== null && !item.spaceId);
      onChange(items);
    },
    onError,
  );
}

export function subscribeToSpaceGifticons(
  spaceId: string,
  onChange: (items: Gifticon[]) => void,
  onError?: (error: Error) => void,
) {
  const q = query(
    collection(db, COLLECTION),
    where('spaceId', '==', spaceId),
    orderBy('expiresAt', 'asc'),
  );
  return onSnapshot(
    q,
    (snapshot) => {
      const items = snapshot.docs
        .map((d) => toGifticon(d.id, d.data()))
        .filter((item): item is Gifticon => item !== null);
      onChange(items);
    },
    onError,
  );
}

export function subscribeToGifticon(
  id: string,
  onChange: (gifticon: Gifticon | null) => void,
  onError?: (error: Error) => void,
) {
  return onSnapshot(
    doc(db, COLLECTION, id),
    (snapshot) => {
      onChange(snapshot.exists() ? toGifticon(snapshot.id, snapshot.data()) : null);
    },
    onError,
  );
}

export async function markGifticonUsed(id: string, isUsed: boolean) {
  await updateDoc(doc(db, COLLECTION, id), {
    isUsed,
    usedAt: isUsed ? new Date().toISOString() : null,
  });
}

export async function setGifticonNotificationIds(id: string, notificationIds: string[]) {
  await updateDoc(doc(db, COLLECTION, id), { notificationIds });
}

export async function deleteGifticon(gifticon: Gifticon) {
  await deleteDoc(doc(db, COLLECTION, gifticon.id));
}
