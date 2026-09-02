import * as ImageManipulator from 'expo-image-manipulator';
import {
  deleteObject,
  getDownloadURL,
  storageRef,
  uploadBytes,
} from '../../../lib/firebase/storage';
import { deleteGifticonImage, uploadGifticonImage } from './gifticonImage';

jest.mock('../../../lib/firebase/storage', () => ({
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
