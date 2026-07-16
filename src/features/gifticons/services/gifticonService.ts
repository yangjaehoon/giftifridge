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
import { deleteObject, getDownloadURL, ref, uploadBytes } from 'firebase/storage';
import { db, storage } from '../../../lib/firebase/config';
import type { Gifticon, NewGifticon } from '../types';

const COLLECTION = 'gifticons';

export async function uploadGifticonImage(ownerId: string, localUri: string): Promise<string> {
  const response = await fetch(localUri);
  const blob = await response.blob();
  const filename = `${Date.now()}.jpg`;
  const storageRef = ref(storage, `gifticons/${ownerId}/${filename}`);
  await uploadBytes(storageRef, blob);
  return getDownloadURL(storageRef);
}

export async function createGifticon(ownerId: string, data: NewGifticon): Promise<string> {
  const docRef = await addDoc(collection(db, COLLECTION), {
    ...data,
    ownerId,
    isUsed: false,
    createdAt: new Date().toISOString(),
  });
  return docRef.id;
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

export async function setGifticonNotificationId(id: string, notificationId: string | null) {
  await updateDoc(doc(db, COLLECTION, id), { notificationId });
}

export async function deleteGifticon(gifticon: Gifticon) {
  await deleteDoc(doc(db, COLLECTION, gifticon.id));
  if (gifticon.imageUrl) {
    try {
      await deleteObject(ref(storage, gifticon.imageUrl));
    } catch {
      // image may already be removed; ignore
    }
  }
}
