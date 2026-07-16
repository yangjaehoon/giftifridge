import {
  collection,
  collectionGroup,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  setDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import { db } from '../../../lib/firebase/config';
import type { Space, SpaceMember } from '../types';

const SPACES_COLLECTION = 'spaces';
const MEMBERS_SUBCOLLECTION = 'members';

export async function createSpace(ownerId: string, name: string): Promise<string> {
  const spaceRef = doc(collection(db, SPACES_COLLECTION));
  const now = new Date().toISOString();

  const batch = writeBatch(db);
  batch.set(spaceRef, { name, ownerId, createdAt: now });
  batch.set(doc(db, SPACES_COLLECTION, spaceRef.id, MEMBERS_SUBCOLLECTION, ownerId), {
    uid: ownerId,
    role: 'owner',
    joinedAt: now,
  });
  await batch.commit();

  return spaceRef.id;
}

export async function getSpacePreview(spaceId: string): Promise<Space | null> {
  const snapshot = await getDoc(doc(db, SPACES_COLLECTION, spaceId));
  return snapshot.exists() ? ({ id: snapshot.id, ...snapshot.data() } as Space) : null;
}

export function subscribeToSpace(
  spaceId: string,
  onChange: (space: Space | null) => void,
  onError?: (error: Error) => void,
) {
  return onSnapshot(
    doc(db, SPACES_COLLECTION, spaceId),
    (snapshot) => {
      onChange(snapshot.exists() ? ({ id: snapshot.id, ...snapshot.data() } as Space) : null);
    },
    onError,
  );
}

export async function joinSpace(spaceId: string, uid: string): Promise<void> {
  await setDoc(doc(db, SPACES_COLLECTION, spaceId, MEMBERS_SUBCOLLECTION, uid), {
    uid,
    role: 'member',
    joinedAt: new Date().toISOString(),
  });
}

export async function leaveSpace(spaceId: string, uid: string): Promise<void> {
  await deleteDoc(doc(db, SPACES_COLLECTION, spaceId, MEMBERS_SUBCOLLECTION, uid));
}

const BATCH_WRITE_LIMIT = 500;

function chunk<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
}

// Deleting a space must also delete its gifticons — otherwise they become
// permanently orphaned (isSpaceMember() can never resolve true again for
// anyone once the space doc is gone, but the docs themselves would linger).
export async function deleteSpace(spaceId: string, memberUids: string[]): Promise<void> {
  const gifticonsSnapshot = await getDocs(
    query(collection(db, 'gifticons'), where('spaceId', '==', spaceId)),
  );

  const refsToDelete = [
    ...memberUids.map((uid) => doc(db, SPACES_COLLECTION, spaceId, MEMBERS_SUBCOLLECTION, uid)),
    ...gifticonsSnapshot.docs.map((d) => d.ref),
  ];

  // Chunk to stay under Firestore's 500-writes-per-batch limit; the space
  // doc itself is deleted last, in its own chunk, once everything else is gone.
  for (const group of chunk(refsToDelete, BATCH_WRITE_LIMIT)) {
    const batch = writeBatch(db);
    for (const ref of group) {
      batch.delete(ref);
    }
    await batch.commit();
  }

  await deleteDoc(doc(db, SPACES_COLLECTION, spaceId));
}

export function subscribeToSpaceMembers(
  spaceId: string,
  onChange: (members: SpaceMember[]) => void,
  onError?: (error: Error) => void,
) {
  return onSnapshot(
    collection(db, SPACES_COLLECTION, spaceId, MEMBERS_SUBCOLLECTION),
    (snapshot) => {
      onChange(snapshot.docs.map((d) => d.data() as SpaceMember));
    },
    onError,
  );
}

export function subscribeToMySpaces(
  uid: string,
  onChange: (spaces: Space[]) => void,
  onError?: (error: Error) => void,
) {
  const q = query(collectionGroup(db, MEMBERS_SUBCOLLECTION), where('uid', '==', uid));
  return onSnapshot(
    q,
    (snapshot) => {
      Promise.all(
        snapshot.docs.map(async (memberDoc) => {
          const spaceRef = memberDoc.ref.parent.parent;
          if (!spaceRef) return null;
          const spaceSnap = await getDoc(spaceRef);
          return spaceSnap.exists() ? ({ id: spaceSnap.id, ...spaceSnap.data() } as Space) : null;
        }),
      ).then((spaces) => {
        onChange(spaces.filter((space): space is Space => space !== null));
      }, onError);
    },
    onError,
  );
}
