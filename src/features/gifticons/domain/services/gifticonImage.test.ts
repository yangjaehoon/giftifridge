import * as ImageManipulator from 'expo-image-manipulator';
import {
  deleteObject,
  getDownloadURL,
  storageRef,
  uploadBytes,
} from '../../../../lib/firebase/storage';
import { deleteGifticonImage, uploadGifticonImage } from './gifticonImage';

jest.mock('../../../../lib/firebase/storage', () => ({
  storageRef: jest.fn((path: string) => `ref:${path}`),
  uploadBytes: jest.fn(),
  getDownloadURL: jest.fn(),
  deleteObject: jest.fn(),
}));

jest.mock('expo-image-manipulator', () => ({
  manipulateAsync: jest.fn(),
  SaveFormat: { JPEG: 'jpeg' },
}));

const mockedManipulateAsync = ImageManipulator.manipulateAsync as jest.Mock;
const mockedUploadBytes = uploadBytes as jest.Mock;
const mockedGetDownloadURL = getDownloadURL as jest.Mock;
const mockedDeleteObject = deleteObject as jest.Mock;
const mockedRef = storageRef as jest.Mock;

const originalFetch = global.fetch;
beforeAll(() => {
  global.fetch = jest.fn(async () => ({
    blob: async () => 'mock-blob',
  })) as unknown as typeof fetch;
});
afterAll(() => {
  global.fetch = originalFetch;
});

beforeEach(() => {
  jest.clearAllMocks();
});

describe('uploadGifticonImage', () => {
  beforeEach(() => {
    mockedManipulateAsync.mockResolvedValue({ uri: 'file:///resized.jpg' });
    mockedUploadBytes.mockResolvedValue(undefined);
    mockedGetDownloadURL.mockResolvedValue(
      'https://storage.example/gifticons/gift-1.jpg?token=abc',
    );
  });

  it('resizes, uploads to the id-keyed path, and returns the download URL', async () => {
    const url = await uploadGifticonImage('gift-1', 'file:///photo.jpg');

    expect(mockedManipulateAsync).toHaveBeenCalledWith(
      'file:///photo.jpg',
      [{ resize: { width: 900 } }],
      expect.objectContaining({ compress: 0.5, format: 'jpeg' }),
    );
    expect(global.fetch).toHaveBeenCalledWith('file:///resized.jpg');
    expect(mockedRef).toHaveBeenCalledWith('gifticons/gift-1.jpg');
    expect(mockedUploadBytes).toHaveBeenCalledWith('ref:gifticons/gift-1.jpg', 'mock-blob', {
      contentType: 'image/jpeg',
    });
    expect(url).toBe('https://storage.example/gifticons/gift-1.jpg?token=abc');
  });

  it('overwrites the same object on a retry (id-keyed path)', async () => {
    await uploadGifticonImage('gift-1', 'file:///a.jpg');
    await uploadGifticonImage('gift-1', 'file:///b.jpg');

    expect(mockedUploadBytes.mock.calls[0][0]).toBe('ref:gifticons/gift-1.jpg');
    expect(mockedUploadBytes.mock.calls[1][0]).toBe('ref:gifticons/gift-1.jpg');
  });

  it('re-encodes once, at a ratio-scaled quality, when the first encode is over the cap', async () => {
    mockedManipulateAsync.mockImplementation(async (_uri, [op], opts) => ({
      uri: `w${op.resize.width}-q${opts.compress}`,
    }));
    // The starting encode is ~3x the cap; any lower-quality re-encode fits.
    (global.fetch as jest.Mock).mockImplementation(async (uri: string) => ({
      blob: async () => ({ size: uri === 'w900-q0.5' ? 3_000_000 : 300_000 }),
    }));

    try {
      await uploadGifticonImage('gift-1', 'file:///big.jpg');

      const calls = mockedManipulateAsync.mock.calls.map(([, [op], opts]) => [
        op.resize.width,
        opts.compress,
      ]);
      expect(calls).toHaveLength(2);
      expect(calls[0]).toEqual([900, 0.5]);
      expect(calls[1][0]).toBe(900); // dimension untouched — only quality scaled
      expect(calls[1][1]).toBeGreaterThanOrEqual(0.2);
      expect(calls[1][1]).toBeLessThan(0.5);
      expect(mockedUploadBytes).toHaveBeenCalledWith(
        'ref:gifticons/gift-1.jpg',
        { size: 300_000 },
        { contentType: 'image/jpeg' },
      );
    } finally {
      (global.fetch as jest.Mock).mockImplementation(async () => ({
        blob: async () => 'mock-blob',
      }));
    }
  });

  it('stops re-encoding once quality and dimension both hit their floor', async () => {
    mockedManipulateAsync.mockImplementation(async (_uri, [op], opts) => ({
      uri: `w${op.resize.width}-q${opts.compress}`,
    }));
    (global.fetch as jest.Mock).mockImplementation(async () => ({
      blob: async () => ({ size: 5_000_000 }),
    }));

    try {
      await uploadGifticonImage('gift-1', 'file:///huge.jpg');

      const lastCall = mockedManipulateAsync.mock.calls.at(-1);
      expect(lastCall?.[1][0].resize.width).toBe(480);
      expect(lastCall?.[2].compress).toBeCloseTo(0.2);
      // The over-cap blob is uploaded anyway rather than looping forever.
      expect(mockedUploadBytes).toHaveBeenCalledWith(
        'ref:gifticons/gift-1.jpg',
        { size: 5_000_000 },
        { contentType: 'image/jpeg' },
      );
    } finally {
      (global.fetch as jest.Mock).mockImplementation(async () => ({
        blob: async () => 'mock-blob',
      }));
    }
  });
});

describe('deleteGifticonImage', () => {
  it('deletes the id-keyed object', async () => {
    mockedDeleteObject.mockResolvedValue(undefined);

    await deleteGifticonImage('gift-1');

    expect(mockedRef).toHaveBeenCalledWith('gifticons/gift-1.jpg');
    expect(mockedDeleteObject).toHaveBeenCalledWith('ref:gifticons/gift-1.jpg');
  });

  it('swallows a missing-object error', async () => {
    mockedDeleteObject.mockRejectedValue(new Error('not found'));

    await expect(deleteGifticonImage('gift-9')).resolves.toBeUndefined();
  });
});
