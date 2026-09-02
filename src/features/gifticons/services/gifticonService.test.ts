import {
  deleteDoc,
  docRef,
  onSnapshot,
  orderBy,
  setDoc,
  updateDoc,
  where,
} from '../../../lib/firebase/firestore';
import { deleteGifticonImage } from './gifticonImage';
import {
  createGifticon,
  deleteGifticon,
  markGifticonUsed,
  newGifticonId,
  setGifticonNotificationIds,
  subscribeToGifticon,
  subscribeToGifticons,
  subscribeToSpaceGifticons,
  updateGifticon,
} from './gifticonService';
import type { Gifticon, NewGifticon } from '../types';

jest.mock('../../../lib/firebase/firestore', () => ({
  collectionRef: jest.fn((...path: string[]) => `collection:${path.join('/')}`),
  deleteDoc: jest.fn(),
  docRef: jest.fn((...path: string[]) => `doc:${path.join('/')}`),
  newId: jest.fn(() => 'generated-id'),
  onSnapshot: jest.fn(),
  orderBy: jest.fn((field, direction) => `orderBy:${field}:${direction}`),
  query: jest.fn((...args) => ['query', ...args]),
  setDoc: jest.fn(),
  updateDoc: jest.fn(),
  where: jest.fn((field, op, value) => `where:${field}${op}${value}`),
}));

jest.mock('./gifticonImage', () => ({
  deleteGifticonImage: jest.fn(),
}));

const mockedSetDoc = setDoc as jest.Mock;
const mockedDeleteDoc = deleteDoc as jest.Mock;
const mockedOnSnapshot = onSnapshot as jest.Mock;
const mockedUpdateDoc = updateDoc as jest.Mock;
const mockedDeleteGifticonImage = deleteGifticonImage as jest.Mock;

function makeNewGifticon(overrides: Partial<NewGifticon> = {}): NewGifticon {
  return {
    name: '아메리카노',
    brand: '스타벅스',
    category: 'cafe',
    imageUrl: 'https://storage.example/gifticons/x.jpg',
    expiresAt: '2026-08-01T00:00:00.000Z',
    ...overrides,
  };
}

// A stored gifticon doc shape that passes toGifticon()'s validity guard.
function storedDoc(overrides: Record<string, unknown> = {}) {
  return {
    ownerId: 'owner-1',
    name: '아메리카노',
    brand: '스타벅스',
    category: 'cafe',
    imageUrl: 'https://storage.example/gifticons/x.jpg',
    expiresAt: '2026-08-01T00:00:00.000Z',
    isUsed: false,
    createdAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe('newGifticonId', () => {
  it('returns a client-side id from an empty doc ref', () => {
    expect(newGifticonId()).toBe('generated-id');
  });
});

describe('createGifticon', () => {
  it('writes to the given id with ownerId, isUsed:false, and a createdAt timestamp', async () => {
    const id = await createGifticon('gift-x', 'owner-1', makeNewGifticon());

    expect(id).toBe('gift-x');
    expect(docRef).toHaveBeenCalledWith('gifticons', 'gift-x');
    const [ref, written] = mockedSetDoc.mock.calls[0];
    expect(ref).toBe('doc:gifticons/gift-x');
    expect(written).toMatchObject({ ownerId: 'owner-1', isUsed: false });
    expect(typeof written.createdAt).toBe('string');
  });

  it('omits undefined optional fields instead of writing them as undefined', async () => {
    await createGifticon(
      'gift-x',
      'owner-1',
      makeNewGifticon({ amount: undefined, barcode: undefined }),
    );

    const [, written] = mockedSetDoc.mock.calls[0];
    expect('amount' in written).toBe(false);
    expect('barcode' in written).toBe(false);
  });

  it('keeps defined optional fields', async () => {
    await createGifticon('gift-x', 'owner-1', makeNewGifticon({ amount: 5000 }));

    const [, written] = mockedSetDoc.mock.calls[0];
    expect(written.amount).toBe(5000);
  });

  it('reuses the same doc id when retried (idempotent under timeout)', async () => {
    await createGifticon('gift-x', 'owner-1', makeNewGifticon());
    await createGifticon('gift-x', 'owner-1', makeNewGifticon());

    expect(mockedSetDoc.mock.calls[0][0]).toBe('doc:gifticons/gift-x');
    expect(mockedSetDoc.mock.calls[1][0]).toBe('doc:gifticons/gift-x');
  });
});

describe('updateGifticon', () => {
  it('writes cleared optional fields as null rather than omitting them', async () => {
    await updateGifticon('gift-1', makeNewGifticon({ barcode: undefined, amount: undefined }));

    expect(docRef).toHaveBeenCalledWith('gifticons', 'gift-1');
    const [, update] = mockedUpdateDoc.mock.calls[0];
    expect(update).toEqual({
      name: '아메리카노',
      brand: '스타벅스',
      category: 'cafe',
      imageUrl: 'https://storage.example/gifticons/x.jpg',
      expiresAt: '2026-08-01T00:00:00.000Z',
      barcode: null,
      amount: null,
      location: null,
    });
  });

  it('keeps provided optional values', async () => {
    await updateGifticon(
      'gift-1',
      makeNewGifticon({
        barcode: '8801234',
        amount: 5000,
        location: { latitude: 1, longitude: 2 },
      }),
    );

    const [, update] = mockedUpdateDoc.mock.calls[0];
    expect(update).toMatchObject({
      barcode: '8801234',
      amount: 5000,
      location: { latitude: 1, longitude: 2 },
    });
  });
});

describe('subscribeToGifticons', () => {
  it('queries by ownerId ordered by expiresAt', () => {
    subscribeToGifticons('owner-1', jest.fn());

    expect(where).toHaveBeenCalledWith('ownerId', '==', 'owner-1');
    expect(orderBy).toHaveBeenCalledWith('expiresAt', 'asc');
  });

  it('filters out gifticons that belong to a space', () => {
    const onChange = jest.fn();
    subscribeToGifticons('owner-1', onChange);
    const [, onSuccess] = mockedOnSnapshot.mock.calls[0];

    onSuccess({
      docs: [
        { id: 'a', data: () => storedDoc({ name: 'personal' }) },
        { id: 'b', data: () => storedDoc({ name: 'shared', spaceId: 'space-1' }) },
      ],
    });

    expect(onChange).toHaveBeenCalledWith([expect.objectContaining({ id: 'a', name: 'personal' })]);
  });

  it('drops docs that are missing required fields instead of yielding them', () => {
    const onChange = jest.fn();
    subscribeToGifticons('owner-1', onChange);
    const [, onSuccess] = mockedOnSnapshot.mock.calls[0];

    onSuccess({
      docs: [
        { id: 'a', data: () => storedDoc() },
        { id: 'bad', data: () => ({ name: 'no owner, no dates' }) },
        { id: 'baddate', data: () => storedDoc({ expiresAt: 'not-a-date' }) },
      ],
    });

    expect(onChange).toHaveBeenCalledWith([expect.objectContaining({ id: 'a' })]);
  });

  it('forwards listener errors to onError', () => {
    const onError = jest.fn();
    subscribeToGifticons('owner-1', jest.fn(), onError);
    const [, , passedOnError] = mockedOnSnapshot.mock.calls[0];

    expect(passedOnError).toBe(onError);
  });
});

describe('subscribeToSpaceGifticons', () => {
  it('queries by spaceId and does not filter results', () => {
    const onChange = jest.fn();
    subscribeToSpaceGifticons('space-1', onChange);

    expect(where).toHaveBeenCalledWith('spaceId', '==', 'space-1');

    const [, onSuccess] = mockedOnSnapshot.mock.calls[0];
    onSuccess({
      docs: [{ id: 'a', data: () => storedDoc({ name: 'shared', spaceId: 'space-1' }) }],
    });
    expect(onChange).toHaveBeenCalledWith([
      expect.objectContaining({ id: 'a', name: 'shared', spaceId: 'space-1' }),
    ]);
  });
});

describe('subscribeToGifticon', () => {
  it('maps an existing doc snapshot to a Gifticon', () => {
    const onChange = jest.fn();
    subscribeToGifticon('gift-1', onChange);
    const [, onSuccess] = mockedOnSnapshot.mock.calls[0];

    onSuccess({ exists: () => true, id: 'gift-1', data: () => storedDoc({ name: 'x' }) });

    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ id: 'gift-1', name: 'x' }));
  });

  it('passes null when the stored doc is malformed', () => {
    const onChange = jest.fn();
    subscribeToGifticon('gift-1', onChange);
    const [, onSuccess] = mockedOnSnapshot.mock.calls[0];

    onSuccess({ exists: () => true, id: 'gift-1', data: () => ({ name: 'x' }) });

    expect(onChange).toHaveBeenCalledWith(null);
  });

  it('passes null when the doc does not exist', () => {
    const onChange = jest.fn();
    subscribeToGifticon('gift-1', onChange);
    const [, onSuccess] = mockedOnSnapshot.mock.calls[0];

    onSuccess({ exists: () => false });

    expect(onChange).toHaveBeenCalledWith(null);
  });
});

describe('markGifticonUsed', () => {
  it('sets isUsed and usedAt when marking used', async () => {
    await markGifticonUsed('gift-1', true);

    expect(docRef).toHaveBeenCalledWith('gifticons', 'gift-1');
    const [, update] = mockedUpdateDoc.mock.calls[0];
    expect(update.isUsed).toBe(true);
    expect(typeof update.usedAt).toBe('string');
  });

  it('clears usedAt when marking unused', async () => {
    await markGifticonUsed('gift-1', false);

    const [, update] = mockedUpdateDoc.mock.calls[0];
    expect(update).toEqual({ isUsed: false, usedAt: null });
  });
});

describe('setGifticonNotificationIds', () => {
  it('writes the notificationIds array', async () => {
    await setGifticonNotificationIds('gift-1', ['n1', 'n2']);

    const [, update] = mockedUpdateDoc.mock.calls[0];
    expect(update).toEqual({ notificationIds: ['n1', 'n2'] });
  });
});

describe('deleteGifticon', () => {
  it('deletes the Firestore doc and hands the image off for best-effort cleanup', async () => {
    mockedDeleteGifticonImage.mockResolvedValue(undefined);

    await deleteGifticon({ id: 'gift-1' } as Gifticon);

    expect(docRef).toHaveBeenCalledWith('gifticons', 'gift-1');
    expect(mockedDeleteDoc).toHaveBeenCalledTimes(1);
    expect(mockedDeleteGifticonImage).toHaveBeenCalledWith('gift-1');
  });

  it('does not await the image cleanup (delete succeeds before it settles)', async () => {
    let resolveCleanup: () => void = () => {};
    mockedDeleteGifticonImage.mockReturnValue(
      new Promise<void>((resolve) => {
        resolveCleanup = resolve;
      }),
    );

    await expect(deleteGifticon({ id: 'gift-1' } as Gifticon)).resolves.toBeUndefined();
    expect(mockedDeleteDoc).toHaveBeenCalledTimes(1);
    resolveCleanup();
  });
});
