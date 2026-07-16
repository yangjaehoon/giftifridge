import * as ImageManipulator from 'expo-image-manipulator';
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  updateDoc,
  where,
} from 'firebase/firestore';
import {
  createGifticon,
  deleteGifticon,
  encodeGifticonImage,
  markGifticonUsed,
  setGifticonNotificationIds,
  subscribeToGifticon,
  subscribeToGifticons,
  subscribeToSpaceGifticons,
} from './gifticonService';
import type { Gifticon, NewGifticon } from '../types';

jest.mock('../../../lib/firebase/config', () => ({ db: 'mock-db' }));

jest.mock('firebase/firestore', () => ({
  addDoc: jest.fn(),
  collection: jest.fn((_db, name) => `collection:${name}`),
  deleteDoc: jest.fn(),
  doc: jest.fn((_db, name, id) => `doc:${name}/${id}`),
  onSnapshot: jest.fn(),
  orderBy: jest.fn((field, direction) => `orderBy:${field}:${direction}`),
  query: jest.fn((...args) => ['query', ...args]),
  updateDoc: jest.fn(),
  where: jest.fn((field, op, value) => `where:${field}${op}${value}`),
}));

jest.mock('expo-image-manipulator', () => ({
  manipulateAsync: jest.fn(),
  SaveFormat: { JPEG: 'jpeg' },
}));

const mockedAddDoc = addDoc as jest.Mock;
const mockedDeleteDoc = deleteDoc as jest.Mock;
const mockedOnSnapshot = onSnapshot as jest.Mock;
const mockedUpdateDoc = updateDoc as jest.Mock;
const mockedManipulateAsync = ImageManipulator.manipulateAsync as jest.Mock;

function makeNewGifticon(overrides: Partial<NewGifticon> = {}): NewGifticon {
  return {
    name: '아메리카노',
    brand: '스타벅스',
    category: 'cafe',
    imageUrl: 'data:image/jpeg;base64,xyz',
    expiresAt: '2026-08-01T00:00:00.000Z',
    ...overrides,
  };
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe('createGifticon', () => {
  it('writes ownerId, isUsed:false, and a createdAt timestamp', async () => {
    mockedAddDoc.mockResolvedValue({ id: 'new-id' });

    const id = await createGifticon('owner-1', makeNewGifticon());

    expect(id).toBe('new-id');
    expect(collection).toHaveBeenCalledWith('mock-db', 'gifticons');
    const [, written] = mockedAddDoc.mock.calls[0];
    expect(written).toMatchObject({ ownerId: 'owner-1', isUsed: false });
    expect(typeof written.createdAt).toBe('string');
  });

  it('omits undefined optional fields instead of writing them as undefined', async () => {
    mockedAddDoc.mockResolvedValue({ id: 'new-id' });

    await createGifticon('owner-1', makeNewGifticon({ amount: undefined, barcode: undefined }));

    const [, written] = mockedAddDoc.mock.calls[0];
    expect('amount' in written).toBe(false);
    expect('barcode' in written).toBe(false);
  });

  it('keeps defined optional fields', async () => {
    mockedAddDoc.mockResolvedValue({ id: 'new-id' });

    await createGifticon('owner-1', makeNewGifticon({ amount: 5000 }));

    const [, written] = mockedAddDoc.mock.calls[0];
    expect(written.amount).toBe(5000);
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
        { id: 'a', data: () => ({ name: 'personal' }) },
        { id: 'b', data: () => ({ name: 'shared', spaceId: 'space-1' }) },
      ],
    });

    expect(onChange).toHaveBeenCalledWith([{ id: 'a', name: 'personal' }]);
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
      docs: [{ id: 'a', data: () => ({ name: 'shared', spaceId: 'space-1' }) }],
    });
    expect(onChange).toHaveBeenCalledWith([{ id: 'a', name: 'shared', spaceId: 'space-1' }]);
  });
});

describe('subscribeToGifticon', () => {
  it('maps an existing doc snapshot to a Gifticon', () => {
    const onChange = jest.fn();
    subscribeToGifticon('gift-1', onChange);
    const [, onSuccess] = mockedOnSnapshot.mock.calls[0];

    onSuccess({ exists: () => true, id: 'gift-1', data: () => ({ name: 'x' }) });

    expect(onChange).toHaveBeenCalledWith({ id: 'gift-1', name: 'x' });
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

    expect(doc).toHaveBeenCalledWith('mock-db', 'gifticons', 'gift-1');
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
  it('deletes the Firestore doc by id', async () => {
    const gifticon = { id: 'gift-1' } as Gifticon;

    await deleteGifticon(gifticon);

    expect(doc).toHaveBeenCalledWith('mock-db', 'gifticons', 'gift-1');
    expect(mockedDeleteDoc).toHaveBeenCalledTimes(1);
  });
});

describe('encodeGifticonImage', () => {
  it('resizes, compresses, and returns a base64 data URL', async () => {
    mockedManipulateAsync.mockResolvedValue({ base64: 'abc123' });

    const result = await encodeGifticonImage('file:///photo.jpg');

    expect(result).toBe('data:image/jpeg;base64,abc123');
    expect(mockedManipulateAsync).toHaveBeenCalledWith(
      'file:///photo.jpg',
      [{ resize: { width: 900 } }],
      expect.objectContaining({ compress: 0.5, format: 'jpeg', base64: true }),
    );
  });

  it('throws when the manipulator does not return base64 data', async () => {
    mockedManipulateAsync.mockResolvedValue({ base64: undefined });

    await expect(encodeGifticonImage('file:///photo.jpg')).rejects.toThrow(
      'Failed to encode gifticon image',
    );
  });
});
