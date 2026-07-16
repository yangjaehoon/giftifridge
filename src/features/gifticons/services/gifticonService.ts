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
import { Directory, File, Paths } from 'expo-file-system';
import { db } from '../../../lib/firebase/config';
import type { Gifticon, NewGifticon } from '../types';

const COLLECTION = 'gifticons';

export async function saveGifticonImage(ownerId: string, localUri: string): Promise<string> {
  const directory = new Directory(Paths.document, 'gifticons', ownerId);
  directory.create({ intermediates: true, idempotent: true });
  const destination = new File(directory, `${Date.now()}.jpg`);
  await new File(localUri).copy(destination);
  return destination.uri;
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
  if (gifticon.imageUrl.startsWith(Paths.document.uri)) {
    try {
      new File(gifticon.imageUrl).delete();
    } catch {
      // image may already be removed; ignore
    }
  }
}
