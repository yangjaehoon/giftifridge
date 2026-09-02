import {
  collectionGroupRef,
  collectionRef,
  deleteDoc,
  docRef,
  getDoc,
  getDocs,
  newId,
  onSnapshot,
  query,
  setDoc,
  where,
  writeBatch,
} from '../../../lib/firebase/firestore';
import { subscribeJoined } from '../../../lib/firebase/subscribeJoined';
import type { Space, SpaceMember } from '../types';

const SPACES_COLLECTION = 'spaces';
const MEMBERS_SUBCOLLECTION = 'members';

// A client-side id so a create retried after a timeout (which doesn't cancel the
// original write) overwrites the same doc instead of making a second space.
export function newSpaceId(): string {
  return newId(SPACES_COLLECTION);
}

export async function createSpace(id: string, ownerId: string, name: string): Promise<string> {
  const now = new Date().toISOString();

  const batch = writeBatch();
  batch.set(docRef(SPACES_COLLECTION, id), { name, ownerId, createdAt: now });
  batch.set(docRef(SPACES_COLLECTION, id, MEMBERS_SUBCOLLECTION, ownerId), {
    uid: ownerId,
    role: 'owner',
    joinedAt: now,
  });
  await batch.commit();

  return id;
}

export async function getSpacePreview(spaceId: string): Promise<Space | null> {
  const snapshot = await getDoc(docRef(SPACES_COLLECTION, spaceId));
  return snapshot.exists() ? ({ id: snapshot.id, ...snapshot.data() } as Space) : null;
}

export function subscribeToSpace(
  spaceId: string,
  onChange: (space: Space | null) => void,
  onError?: (error: Error) => void,
) {
  return onSnapshot(
    docRef(SPACES_COLLECTION, spaceId),
    (snapshot) => {
      onChange(snapshot.exists() ? ({ id: snapshot.id, ...snapshot.data() } as Space) : null);
    },
    onError,
  );
}

export async function joinSpace(spaceId: string, uid: string): Promise<void> {
  await setDoc(docRef(SPACES_COLLECTION, spaceId, MEMBERS_SUBCOLLECTION, uid), {
    uid,
    role: 'member',
    joinedAt: new Date().toISOString(),
  });
}

export async function leaveSpace(spaceId: string, uid: string): Promise<void> {
  await deleteDoc(docRef(SPACES_COLLECTION, spaceId, MEMBERS_SUBCOLLECTION, uid));
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
    query(collectionRef('gifticons'), where('spaceId', '==', spaceId)),
  );

  // Gifticons first: deleting a member's shared gifticon needs isSpaceMember()
  // to still resolve true, which it can't once that member's doc is gone. With
  // >500 total writes the member docs would otherwise land in an earlier chunk
  // and strand the rest.
  const refsToDelete = [
    ...gifticonsSnapshot.docs.map((d) => d.ref),
    ...memberUids.map((uid) => docRef(SPACES_COLLECTION, spaceId, MEMBERS_SUBCOLLECTION, uid)),
  ];

  // Chunk to stay under Firestore's 500-writes-per-batch limit; the space
  // doc itself is deleted last, in its own chunk, once everything else is gone.
  for (const group of chunk(refsToDelete, BATCH_WRITE_LIMIT)) {
    const batch = writeBatch();
    for (const ref of group) {
      batch.delete(ref);
    }
    await batch.commit();
  }

  await deleteDoc(docRef(SPACES_COLLECTION, spaceId));
}

export function subscribeToSpaceMembers(
  spaceId: string,
  onChange: (members: SpaceMember[]) => void,
  onError?: (error: Error) => void,
) {
  return onSnapshot(
    collectionRef(SPACES_COLLECTION, spaceId, MEMBERS_SUBCOLLECTION),
    (snapshot) => {
      onChange(snapshot.docs.map((d) => d.data() as SpaceMember));
    },
    onError,
  );
}

/**
 * Live view of every space the user belongs to. The membership collection-group
 * query supplies *which* space ids; subscribeJoined then gives each one its own
 * document subscription (via subscribeToSpace), so a rename propagates
 * immediately, a departed space is torn down, and one unreadable space doesn't
 * blank the list. The coordination — holding the emit until every new space has
 * reported, teardown, error isolation — lives in subscribeJoined.
 */
export function subscribeToMySpaces(
  uid: string,
  onChange: (spaces: Space[]) => void,
  onError?: (error: Error) => void,
) {
  return subscribeJoined<Space>(
    {
      subscribeKeys: (onKeys, onKeysError) =>
        onSnapshot(
          query(collectionGroupRef(MEMBERS_SUBCOLLECTION), where('uid', '==', uid)),
          (snapshot) => {
            const ids: string[] = [];
            for (const memberDoc of snapshot.docs) {
              const spaceRef = memberDoc.ref.parent.parent;
              if (spaceRef) ids.push(spaceRef.id);
            }
            onKeys(ids);
          },
          onKeysError,
        ),
      subscribeItem: (spaceId, onItem, onItemError) =>
        subscribeToSpace(spaceId, onItem, onItemError),
      compare: (a, b) => (a.createdAt < b.createdAt ? -1 : a.createdAt > b.createdAt ? 1 : 0),
    },
    onChange,
    onError,
  );
}
