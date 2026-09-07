import { Image } from 'react-native';
import * as ImageManipulator from 'expo-image-manipulator';
import { prepareImageForOcr } from './prepareImage';

jest.mock('expo-image-manipulator', () => ({
  manipulateAsync: jest.fn(),
  SaveFormat: { JPEG: 'jpeg' },
}));

const mockedGetSize = jest.spyOn(Image, 'getSize');
const mockedManipulate = ImageManipulator.manipulateAsync as jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
});

describe('prepareImageForOcr', () => {
  it('returns the original uri when the image is already wide enough', async () => {
    mockedGetSize.mockImplementation((_uri, ok) => ok(1440, 3000));

    await expect(prepareImageForOcr('file:///big.jpg')).resolves.toBe('file:///big.jpg');
    expect(mockedManipulate).not.toHaveBeenCalled();
  });

  it('upscales a too-small image and returns the new uri', async () => {
    mockedGetSize.mockImplementation((_uri, ok) => ok(600, 900));
    mockedManipulate.mockResolvedValue({ uri: 'file:///up.jpg', width: 1600, height: 2400 });

    await expect(prepareImageForOcr('file:///small.jpg')).resolves.toBe('file:///up.jpg');
    expect(mockedManipulate).toHaveBeenCalledWith(
      'file:///small.jpg',
      [{ resize: { width: 1600 } }],
      { compress: 0.9, format: 'jpeg' },
    );
  });

  it('falls back to the original uri when the size lookup fails', async () => {
    mockedGetSize.mockImplementation((_uri, _ok, fail) => fail?.(new Error('no such file')));

    await expect(prepareImageForOcr('file:///gone.jpg')).resolves.toBe('file:///gone.jpg');
  });

  it('falls back to the original uri when the resize fails', async () => {
    mockedGetSize.mockImplementation((_uri, ok) => ok(400, 400));
    mockedManipulate.mockRejectedValue(new Error('decode failed'));

    await expect(prepareImageForOcr('file:///bad.jpg')).resolves.toBe('file:///bad.jpg');
  });
});
