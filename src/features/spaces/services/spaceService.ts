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
  type Unsubscribe,
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

  // Gifticons first: deleting a member's shared gifticon needs isSpaceMember()
  // to still resolve true, which it can't once that member's doc is gone. With
  // >500 total writes the member docs would otherwise land in an earlier chunk
  // and strand the rest.
  const refsToDelete = [
    ...gifticonsSnapshot.docs.map((d) => d.ref),
    ...memberUids.map((uid) => doc(db, SPACES_COLLECTION, spaceId, MEMBERS_SUBCOLLECTION, uid)),
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

/**
 * Live view of every space the user belongs to. The membership collection-group
 * query tells us *which* spaces; each space then gets its own document
 * subscription, so a rename propagates immediately and there's no per-snapshot
 * fan-out of one-shot getDoc reads (the previous approach, which also raced when
 * two snapshots overlapped).
 */
export function subscribeToMySpaces(
  uid: string,
  onChange: (spaces: Space[]) => void,
  onError?: (error: Error) => void,
) {
  const q = query(collectionGroup(db, MEMBERS_SUBCOLLECTION), where('uid', '==', uid));

  const spaceSubs = new Map<string, Unsubscribe>();
  const spaceById = new Map<string, Space>();
  // Space ids whose first snapshot hasn't arrived yet — hold the initial emit
  // until every newly-added space has reported, so the switcher doesn't flash
  // empty then fill in one space at a time.
  const pending = new Set<string>();
  let stopped = false;

  const emit = () => {
    if (stopped || pending.size > 0) return;
    onChange([...spaceById.values()].sort((a, b) => (a.createdAt < b.createdAt ? -1 : 1)));
  };

  const dropSpace = (spaceId: string) => {
    spaceSubs.get(spaceId)?.();
    spaceSubs.delete(spaceId);
    spaceById.delete(spaceId);
    pending.delete(spaceId);
  };

  const membersUnsub = onSnapshot(
    q,
    (snapshot) => {
      const currentIds = new Set<string>();
      for (const memberDoc of snapshot.docs) {
        const spaceRef = memberDoc.ref.parent.parent;
        if (!spaceRef) continue;
        currentIds.add(spaceRef.id);
        if (spaceSubs.has(spaceRef.id)) continue;

        pending.add(spaceRef.id);
        spaceSubs.set(
          spaceRef.id,
          onSnapshot(
            spaceRef,
            (spaceSnap) => {
              pending.delete(spaceSnap.id);
              if (spaceSnap.exists()) {
                spaceById.set(spaceSnap.id, { id: spaceSnap.id, ...spaceSnap.data() } as Space);
              } else {
                spaceById.delete(spaceSnap.id);
              }
              emit();
            },
            () => {
              // One space becoming unreadable (a race with leaving it) shouldn't
              // blank the whole switcher — drop just that one.
              dropSpace(spaceRef.id);
              emit();
            },
          ),
        );
      }

      for (const spaceId of [...spaceSubs.keys()]) {
        if (!currentIds.has(spaceId)) dropSpace(spaceId);
      }
      emit();
    },
    onError,
  );

  return () => {
    stopped = true;
    membersUnsub();
    for (const unsub of spaceSubs.values()) unsub();
    spaceSubs.clear();
    spaceById.clear();
    pending.clear();
  };
}
