import {
  collection,
  collectionGroup,
  deleteDoc,
  doc,
  getDoc,
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

export async function deleteSpace(spaceId: string, memberUids: string[]): Promise<void> {
  const batch = writeBatch(db);
  for (const uid of memberUids) {
    batch.delete(doc(db, SPACES_COLLECTION, spaceId, MEMBERS_SUBCOLLECTION, uid));
  }
  batch.delete(doc(db, SPACES_COLLECTION, spaceId));
  await batch.commit();
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
