import {
  collectionGroup,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  setDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import {
  createSpace,
  deleteSpace,
  getSpacePreview,
  joinSpace,
  leaveSpace,
  subscribeToMySpaces,
  subscribeToSpace,
  subscribeToSpaceMembers,
} from './spaceService';
import type { Space } from '../types';

jest.mock('../../../lib/firebase/config', () => ({ db: 'mock-db' }));

jest.mock('firebase/firestore', () => ({
  collection: jest.fn((_db, ...segments) => `collection:${segments.join('/')}`),
  collectionGroup: jest.fn((_db, name) => `collectionGroup:${name}`),
  deleteDoc: jest.fn(),
  doc: jest.fn((_db, ...segments) =>
    segments.length === 0 ? { id: 'generated-space-id' } : `doc:${segments.join('/')}`,
  ),
  getDoc: jest.fn(),
  getDocs: jest.fn(),
  onSnapshot: jest.fn(),
  query: jest.fn((...args) => ['query', ...args]),
  setDoc: jest.fn(),
  where: jest.fn((field, op, value) => `where:${field}${op}${value}`),
  writeBatch: jest.fn(),
}));

const mockedDoc = doc as jest.Mock;
const mockedGetDoc = getDoc as jest.Mock;
const mockedGetDocs = getDocs as jest.Mock;
const mockedOnSnapshot = onSnapshot as jest.Mock;
const mockedSetDoc = setDoc as jest.Mock;
const mockedDeleteDoc = deleteDoc as jest.Mock;
const mockedWriteBatch = writeBatch as jest.Mock;

function makeBatch() {
  return {
    set: jest.fn(),
    delete: jest.fn(),
    commit: jest.fn().mockResolvedValue(undefined),
  };
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe('createSpace', () => {
  it('batch-writes the space doc and an owner member doc, then returns the new id', async () => {
    const batch = makeBatch();
    mockedWriteBatch.mockReturnValue(batch);

    const id = await createSpace('owner-1', '우리집 냉장고');

    expect(id).toBe('generated-space-id');
    expect(batch.set).toHaveBeenCalledTimes(2);

    const [spaceRef, spaceData] = batch.set.mock.calls[0];
    expect(spaceRef).toEqual({ id: 'generated-space-id' });
    expect(spaceData).toMatchObject({ name: '우리집 냉장고', ownerId: 'owner-1' });
    expect(typeof spaceData.createdAt).toBe('string');

    const [memberRef, memberData] = batch.set.mock.calls[1];
    expect(memberRef).toBe('doc:spaces/generated-space-id/members/owner-1');
    expect(memberData).toMatchObject({ uid: 'owner-1', role: 'owner' });
    expect(batch.commit).toHaveBeenCalledTimes(1);
  });
});

describe('getSpacePreview', () => {
  it('returns the space with its id when the doc exists', async () => {
    mockedGetDoc.mockResolvedValue({
      exists: () => true,
      id: 'space-1',
      data: () => ({ name: '집', ownerId: 'owner-1', createdAt: 't' }),
    });

    await expect(getSpacePreview('space-1')).resolves.toEqual({
      id: 'space-1',
      name: '집',
      ownerId: 'owner-1',
      createdAt: 't',
    });
  });

  it('returns null when the doc does not exist', async () => {
    mockedGetDoc.mockResolvedValue({ exists: () => false });
    await expect(getSpacePreview('missing')).resolves.toBeNull();
  });
});

describe('subscribeToSpace', () => {
  it('maps an existing snapshot to a Space and forwards onError', () => {
    const onChange = jest.fn();
    const onError = jest.fn();
    subscribeToSpace('space-1', onChange, onError);

    const [ref, onNext, passedOnError] = mockedOnSnapshot.mock.calls[0];
    expect(ref).toBe('doc:spaces/space-1');
    expect(passedOnError).toBe(onError);

    onNext({ exists: () => true, id: 'space-1', data: () => ({ name: '집' }) });
    expect(onChange).toHaveBeenCalledWith({ id: 'space-1', name: '집' });
  });

  it('passes null when the space no longer exists', () => {
    const onChange = jest.fn();
    subscribeToSpace('space-1', onChange);
    const [, onNext] = mockedOnSnapshot.mock.calls[0];

    onNext({ exists: () => false });
    expect(onChange).toHaveBeenCalledWith(null);
  });
});

describe('joinSpace', () => {
  it('writes a member doc with the member role', async () => {
    await joinSpace('space-1', 'user-2');

    const [ref, data] = mockedSetDoc.mock.calls[0];
    expect(ref).toBe('doc:spaces/space-1/members/user-2');
    expect(data).toMatchObject({ uid: 'user-2', role: 'member' });
    expect(typeof data.joinedAt).toBe('string');
  });
});

describe('leaveSpace', () => {
  it('deletes the caller’s member doc', async () => {
    await leaveSpace('space-1', 'user-2');
    expect(mockedDoc).toHaveBeenCalledWith('mock-db', 'spaces', 'space-1', 'members', 'user-2');
    expect(mockedDeleteDoc).toHaveBeenCalledWith('doc:spaces/space-1/members/user-2');
  });
});

describe('deleteSpace', () => {
  it('deletes the space gifticons and members in one batch, then the space doc last', async () => {
    mockedGetDocs.mockResolvedValue({
      docs: [{ ref: 'gifticon-ref-1' }, { ref: 'gifticon-ref-2' }],
    });
    const batch = makeBatch();
    mockedWriteBatch.mockReturnValue(batch);

    await deleteSpace('space-1', ['owner-1', 'member-2']);

    expect(where).toHaveBeenCalledWith('spaceId', '==', 'space-1');
    // 2 gifticons + 2 members = 4 deletes in the batch
    expect(batch.delete).toHaveBeenCalledTimes(4);
    expect(batch.delete).toHaveBeenNthCalledWith(1, 'gifticon-ref-1');
    expect(batch.delete).toHaveBeenNthCalledWith(3, 'doc:spaces/space-1/members/owner-1');
    expect(batch.commit).toHaveBeenCalledTimes(1);
    // The space doc itself is removed after the batch commits.
    expect(mockedDeleteDoc).toHaveBeenCalledWith('doc:spaces/space-1');
  });

  it('splits the deletes across multiple batches past the 500-write limit', async () => {
    const gifticonDocs = Array.from({ length: 600 }, (_, i) => ({ ref: `g-${i}` }));
    mockedGetDocs.mockResolvedValue({ docs: gifticonDocs });
    const batches = [makeBatch(), makeBatch(), makeBatch()];
    let call = 0;
    mockedWriteBatch.mockImplementation(() => batches[call++]);

    await deleteSpace('space-1', ['owner-1']);

    // 601 refs -> chunks of 500 -> two batches (500 + 101).
    expect(batches[0].delete).toHaveBeenCalledTimes(500);
    expect(batches[1].delete).toHaveBeenCalledTimes(101);
    expect(batches[0].commit).toHaveBeenCalledTimes(1);
    expect(batches[1].commit).toHaveBeenCalledTimes(1);
  });
});

describe('subscribeToSpaceMembers', () => {
  it('maps each member doc through and forwards onError', () => {
    const onChange = jest.fn();
    const onError = jest.fn();
    subscribeToSpaceMembers('space-1', onChange, onError);

    const [ref, onNext, passedOnError] = mockedOnSnapshot.mock.calls[0];
    expect(ref).toBe('collection:spaces/space-1/members');
    expect(passedOnError).toBe(onError);

    onNext({
      docs: [{ data: () => ({ uid: 'a', role: 'owner' }) }, { data: () => ({ uid: 'b' }) }],
    });
    expect(onChange).toHaveBeenCalledWith([{ uid: 'a', role: 'owner' }, { uid: 'b' }]);
  });
});

describe('subscribeToMySpaces', () => {
  type SnapCall = {
    ref: unknown;
    onNext: (snap: unknown) => void;
    onError?: (err: Error) => void;
    unsub: jest.Mock;
  };

  let snaps: SnapCall[];

  function spaceRef(id: string) {
    return { id };
  }
  function memberDoc(id: string | null) {
    return { ref: { parent: { parent: id === null ? null : spaceRef(id) } } };
  }
  function spaceSnap(id: string, data: Record<string, unknown> | null) {
    return { id, exists: () => data !== null, data: () => data };
  }
  // The space subscription for a given id (created after the members snapshot).
  function subFor(id: string): SnapCall {
    const call = snaps.find((s) => (s.ref as { id?: string })?.id === id);
    if (!call) throw new Error(`no space subscription for ${id}`);
    return call;
  }

  beforeEach(() => {
    snaps = [];
    mockedOnSnapshot.mockImplementation(
      (ref: unknown, onNext: (s: unknown) => void, onError?: (e: Error) => void) => {
        const unsub = jest.fn();
        snaps.push({ ref, onNext, onError, unsub });
        return unsub;
      },
    );
  });

  it('queries the members collection group by uid', () => {
    subscribeToMySpaces('user-1', jest.fn());
    expect(collectionGroup).toHaveBeenCalledWith('mock-db', 'members');
    expect(where).toHaveBeenCalledWith('uid', '==', 'user-1');
  });

  it('subscribes per space and emits them (sorted by createdAt) once all have reported', () => {
    const onChange = jest.fn();
    subscribeToMySpaces('user-1', onChange);

    // members snapshot: user is in space-b and space-a
    snaps[0].onNext({ docs: [memberDoc('space-b'), memberDoc('space-a'), memberDoc(null)] });

    // one space still pending → no emit yet
    subFor('space-b').onNext(spaceSnap('space-b', { name: 'B', createdAt: '2026-02-01' }));
    expect(onChange).not.toHaveBeenCalled();

    subFor('space-a').onNext(spaceSnap('space-a', { name: 'A', createdAt: '2026-01-01' }));
    expect(onChange).toHaveBeenCalledWith([
      { id: 'space-a', name: 'A', createdAt: '2026-01-01' },
      { id: 'space-b', name: 'B', createdAt: '2026-02-01' },
    ]);
  });

  it('reflects a later space rename without re-reading every space', () => {
    const onChange = jest.fn();
    subscribeToMySpaces('user-1', onChange);
    snaps[0].onNext({ docs: [memberDoc('space-a')] });
    subFor('space-a').onNext(spaceSnap('space-a', { name: '옛이름', createdAt: '2026-01-01' }));
    onChange.mockClear();

    subFor('space-a').onNext(spaceSnap('space-a', { name: '새이름', createdAt: '2026-01-01' }));

    expect(onChange).toHaveBeenCalledWith([
      { id: 'space-a', name: '새이름', createdAt: '2026-01-01' },
    ]);
  });

  it('drops a space whose document no longer exists', () => {
    const onChange = jest.fn();
    subscribeToMySpaces('user-1', onChange);
    snaps[0].onNext({ docs: [memberDoc('space-a'), memberDoc('space-b')] });
    subFor('space-a').onNext(spaceSnap('space-a', { name: 'A', createdAt: '2026-01-01' }));
    subFor('space-b').onNext(spaceSnap('space-b', null));

    expect(onChange).toHaveBeenLastCalledWith([
      { id: 'space-a', name: 'A', createdAt: '2026-01-01' },
    ]);
  });

  it('drops just the unreadable space when its subscription errors', () => {
    const onChange = jest.fn();
    subscribeToMySpaces('user-1', onChange);
    snaps[0].onNext({ docs: [memberDoc('space-a'), memberDoc('space-b')] });
    subFor('space-a').onNext(spaceSnap('space-a', { name: 'A', createdAt: '2026-01-01' }));
    subFor('space-b').onError?.(new Error('permission-denied'));

    expect(onChange).toHaveBeenLastCalledWith([
      { id: 'space-a', name: 'A', createdAt: '2026-01-01' },
    ]);
  });

  it('tears down the subscription for a space the user has left', () => {
    const onChange = jest.fn();
    subscribeToMySpaces('user-1', onChange);
    snaps[0].onNext({ docs: [memberDoc('space-a'), memberDoc('space-b')] });
    subFor('space-a').onNext(spaceSnap('space-a', { name: 'A', createdAt: '2026-01-01' }));
    subFor('space-b').onNext(spaceSnap('space-b', { name: 'B', createdAt: '2026-02-01' }));
    const bUnsub = subFor('space-b').unsub;

    // next members snapshot: only space-a remains
    snaps[0].onNext({ docs: [memberDoc('space-a')] });

    expect(bUnsub).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenLastCalledWith([
      { id: 'space-a', name: 'A', createdAt: '2026-01-01' },
    ]);
  });

  it('the returned unsubscribe stops every subscription and silences later emits', () => {
    const onChange = jest.fn();
    const unsubscribe = subscribeToMySpaces('user-1', onChange);
    snaps[0].onNext({ docs: [memberDoc('space-a')] });
    const spaceSub = subFor('space-a');
    spaceSub.onNext(spaceSnap('space-a', { name: 'A', createdAt: '2026-01-01' }));
    onChange.mockClear();

    unsubscribe();

    expect(snaps[0].unsub).toHaveBeenCalledTimes(1);
    expect(spaceSub.unsub).toHaveBeenCalledTimes(1);

    // a straggler snapshot after teardown must not call onChange
    spaceSub.onNext(spaceSnap('space-a', { name: 'A2', createdAt: '2026-01-01' }));
    expect(onChange).not.toHaveBeenCalled();
  });
});
