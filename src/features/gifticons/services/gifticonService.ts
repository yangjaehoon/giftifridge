import {
  arrayRemove,
  arrayUnion,
  collectionRef,
  deleteDoc,
  docRef,
  newId,
  onSnapshot,
  orderBy,
  query,
  setDoc,
  updateDoc,
  where,
} from '../../../lib/firebase/firestore';
import { deleteGifticonImage } from './gifticonImage';
import { omitUndefined, toGifticon } from './gifticonMapper';
import type { Gifticon, NewGifticon, UsageRecord } from '../types';

const COLLECTION = 'gifticons';

// A client-side id, so a create that is retried after a timeout (which doesn't
// cancel the original write) overwrites the same doc instead of inserting a
// duplicate.
export function newGifticonId(): string {
  return newId(COLLECTION);
}

// Same idea as newGifticonId, for one usage-history entry: a stable id so a
// retried add-record write is recognised as the same arrayUnion element
// instead of logging the spend twice. Not itself a doc anywhere, so the
// collection name is nominal — newId just needs to hand back a random,
// collision-safe string with no network call.
export function newUsageRecordId(): string {
  return newId('gifticonUsageRecords');
}

export async function createGifticon(
  id: string,
  ownerId: string,
  data: NewGifticon,
): Promise<string> {
  await setDoc(docRef(COLLECTION, id), {
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
  await updateDoc(docRef(COLLECTION, id), {
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
    collectionRef(COLLECTION),
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
    collectionRef(COLLECTION),
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
    docRef(COLLECTION, id),
    (snapshot) => {
      onChange(snapshot.exists() ? toGifticon(snapshot.id, snapshot.data()) : null);
    },
    onError,
  );
}

export async function markGifticonUsed(id: string, isUsed: boolean) {
  await updateDoc(docRef(COLLECTION, id), {
    isUsed,
    usedAt: isUsed ? new Date().toISOString() : null,
  });
}

export async function setGifticonNotificationIds(id: string, notificationIds: string[]) {
  await updateDoc(docRef(COLLECTION, id), { notificationIds });
}

// arrayUnion/arrayRemove match array entries by deep equality, so a record is
// removed by passing back the exact { id, amount, usedAt } it was added with.
export async function addGifticonUsageRecord(id: string, record: UsageRecord) {
  await updateDoc(docRef(COLLECTION, id), { usageHistory: arrayUnion(record) });
}

// Same write as addGifticonUsageRecord, plus closing the gifticon out, as one
// atomic update — so a spend that exactly exhausts the balance can't land the
// usage record but then fail (or time out) before isUsed also flips, which
// would leave the balance reading 0 while the tab still shows it as active.
export async function addGifticonUsageRecordAndClose(id: string, record: UsageRecord) {
  await updateDoc(docRef(COLLECTION, id), {
    usageHistory: arrayUnion(record),
    isUsed: true,
    usedAt: new Date().toISOString(),
  });
}

export async function removeGifticonUsageRecord(id: string, record: UsageRecord) {
  await updateDoc(docRef(COLLECTION, id), { usageHistory: arrayRemove(record) });
}

export async function deleteGifticon(gifticon: Gifticon) {
  await deleteDoc(docRef(COLLECTION, gifticon.id));
  // The doc is what matters and is now gone; clean the image up in the
  // background so a slow/failed Storage delete can't make the delete look
  // like it failed (deleteGifticonImage swallows its own errors).
  void deleteGifticonImage(gifticon.id);
}
