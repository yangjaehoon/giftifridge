import { act, renderHook, waitFor } from '@testing-library/react-native';
import { Alert } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { recognizeExpiryDate } from '../services/ocrService';
import { useGifticonImage } from './useGifticonImage';

jest.mock('expo-image-picker', () => ({
  launchImageLibraryAsync: jest.fn(),
  launchCameraAsync: jest.fn(),
}));
jest.mock('../services/ocrService', () => ({ recognizeExpiryDate: jest.fn() }));

const mockedLibrary = ImagePicker.launchImageLibraryAsync as jest.Mock;
const mockedCamera = ImagePicker.launchCameraAsync as jest.Mock;
const mockedRecognize = recognizeExpiryDate as jest.Mock;

function setup() {
  const onImageChosen = jest.fn();
  const onExpiryDetected = jest.fn();
  return { onImageChosen, onExpiryDetected };
}

beforeEach(() => {
  jest.clearAllMocks();
  jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  mockedRecognize.mockResolvedValue(null);
});

describe('useGifticonImage', () => {
  it('reports the chosen library image and runs OCR against it', async () => {
    mockedLibrary.mockResolvedValue({ canceled: false, assets: [{ uri: 'file:///a.jpg' }] });
    mockedRecognize.mockResolvedValue('2026-12-31');
    const { onImageChosen, onExpiryDetected } = setup();
    const { result } = await renderHook(() =>
      useGifticonImage({ onImageChosen, onExpiryDetected }),
    );

    await act(async () => {
      await result.current.pickFromLibrary();
    });

    expect(onImageChosen).toHaveBeenCalledWith('file:///a.jpg');
    await waitFor(() => expect(onExpiryDetected).toHaveBeenCalledWith(expect.any(Date)));
    expect(result.current.dateAutoDetected).toBe(true);
  });

  it('does the same for a camera photo', async () => {
    mockedCamera.mockResolvedValue({ canceled: false, assets: [{ uri: 'file:///cam.jpg' }] });
    const { onImageChosen, onExpiryDetected } = setup();
    const { result } = await renderHook(() =>
      useGifticonImage({ onImageChosen, onExpiryDetected }),
    );

    await act(async () => {
      await result.current.takePhoto();
    });

    expect(onImageChosen).toHaveBeenCalledWith('file:///cam.jpg');
  });

  it('offers a way to Settings when the photo library throws', async () => {
    mockedLibrary.mockRejectedValue(new Error('permission denied'));
    const { onImageChosen, onExpiryDetected } = setup();
    const { result } = await renderHook(() =>
      useGifticonImage({ onImageChosen, onExpiryDetected }),
    );

    await act(async () => {
      await result.current.pickFromLibrary();
    });

    expect(Alert.alert).toHaveBeenCalledWith(
      '오류',
      '사진첩에 접근하지 못했어요. 권한을 확인해주세요.',
      expect.any(Array),
    );
    expect(onImageChosen).not.toHaveBeenCalled();
  });

  it('offers a way to Settings when the camera throws', async () => {
    mockedCamera.mockRejectedValue(new Error('permission denied'));
    const { onImageChosen, onExpiryDetected } = setup();
    const { result } = await renderHook(() =>
      useGifticonImage({ onImageChosen, onExpiryDetected }),
    );

    await act(async () => {
      await result.current.takePhoto();
    });

    expect(Alert.alert).toHaveBeenCalledWith(
      '오류',
      '카메라를 사용하지 못했어요. 권한을 확인해주세요.',
      expect.any(Array),
    );
    expect(onImageChosen).not.toHaveBeenCalled();
  });

  it('ignores a stale OCR result when a newer image was picked', async () => {
    const resolvers: ((v: string | null) => void)[] = [];
    mockedRecognize.mockImplementation(() => new Promise<string | null>((r) => resolvers.push(r)));
    mockedLibrary
      .mockResolvedValueOnce({ canceled: false, assets: [{ uri: 'file:///a.jpg' }] })
      .mockResolvedValueOnce({ canceled: false, assets: [{ uri: 'file:///b.jpg' }] });
    const { onImageChosen, onExpiryDetected } = setup();
    const { result } = await renderHook(() =>
      useGifticonImage({ onImageChosen, onExpiryDetected }),
    );

    await act(async () => {
      await result.current.pickFromLibrary();
    });
    await act(async () => {
      await result.current.pickFromLibrary();
    });

    await act(async () => resolvers[1]('2027-05-05'));
    await act(async () => resolvers[0]('2020-01-01'));

    expect(onExpiryDetected).toHaveBeenCalledTimes(1);
    expect(onExpiryDetected.mock.calls[0][0].getFullYear()).toBe(2027);
  });

  it('markDateManuallyEdited() suppresses a later OCR result', async () => {
    const resolvers: ((v: string | null) => void)[] = [];
    mockedRecognize.mockImplementation(() => new Promise<string | null>((r) => resolvers.push(r)));
    mockedLibrary.mockResolvedValue({ canceled: false, assets: [{ uri: 'file:///a.jpg' }] });
    const { onImageChosen, onExpiryDetected } = setup();
    const { result } = await renderHook(() =>
      useGifticonImage({ onImageChosen, onExpiryDetected }),
    );

    await act(async () => {
      await result.current.pickFromLibrary();
    });
    await act(async () => result.current.markDateManuallyEdited());
    await act(async () => resolvers[0]('2027-05-05'));

    expect(onExpiryDetected).not.toHaveBeenCalled();
    expect(result.current.dateAutoDetected).toBe(false);
  });
});
