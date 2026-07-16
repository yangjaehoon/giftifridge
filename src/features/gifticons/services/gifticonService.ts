import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  updateDoc,
  where,
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

export async function createGifticon(ownerId: string, data: NewGifticon): Promise<string> {
  const docRef = await addDoc(collection(db, COLLECTION), {
    ...omitUndefined(data),
    ownerId,
    isUsed: false,
    createdAt: new Date().toISOString(),
  });
  return docRef.id;
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
        .map((d) => ({ id: d.id, ...d.data() }) as Gifticon)
        .filter((item) => !item.spaceId);
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
      const items = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }) as Gifticon);
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
      onChange(snapshot.exists() ? ({ id: snapshot.id, ...snapshot.data() } as Gifticon) : null);
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
