import { act, renderHook, waitFor } from '@testing-library/react-native';
import { Alert } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { recognizeText } from '../services/ocrService';
import { recognizeBarcodeFromImage } from '../services/barcodeRecognition';
import { useGifticonImage } from './useGifticonImage';

jest.mock('expo-image-picker', () => ({
  launchImageLibraryAsync: jest.fn(),
  launchCameraAsync: jest.fn(),
}));
jest.mock('../services/ocrService', () => ({
  ...jest.requireActual('../services/ocrService'),
  recognizeText: jest.fn(),
}));
jest.mock('../services/barcodeRecognition', () => ({ recognizeBarcodeFromImage: jest.fn() }));

const mockedLibrary = ImagePicker.launchImageLibraryAsync as jest.Mock;
const mockedCamera = ImagePicker.launchCameraAsync as jest.Mock;
const mockedRecognizeText = recognizeText as jest.Mock;
const mockedRecognizeBarcode = recognizeBarcodeFromImage as jest.Mock;

const GIFTICON_TEXT = '스타벅스\n아메리카노 Tall\n유효기간 2026.12.31까지';

function setup() {
  return {
    onImageChosen: jest.fn(),
    onExpiryDetected: jest.fn(),
    onNameDetected: jest.fn(),
    onBrandDetected: jest.fn(),
    onBarcodeDetected: jest.fn(),
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  mockedRecognizeText.mockResolvedValue(null);
  mockedRecognizeBarcode.mockResolvedValue(null);
});

describe('useGifticonImage', () => {
  it('reports the chosen library image and auto-fills every field it can read', async () => {
    mockedLibrary.mockResolvedValue({ canceled: false, assets: [{ uri: 'file:///a.jpg' }] });
    mockedRecognizeText.mockResolvedValue(GIFTICON_TEXT);
    mockedRecognizeBarcode.mockResolvedValue('8801234567890');
    const callbacks = setup();
    const { result } = await renderHook(() => useGifticonImage(callbacks));

    await act(async () => {
      await result.current.pickFromLibrary();
    });

    expect(callbacks.onImageChosen).toHaveBeenCalledWith('file:///a.jpg');
    await waitFor(() => expect(callbacks.onExpiryDetected).toHaveBeenCalledWith(expect.any(Date)));
    expect(callbacks.onExpiryDetected.mock.calls[0][0].getFullYear()).toBe(2026);
    expect(callbacks.onNameDetected).toHaveBeenCalledWith('아메리카노 Tall');
    expect(callbacks.onBrandDetected).toHaveBeenCalledWith('스타벅스');
    expect(callbacks.onBarcodeDetected).toHaveBeenCalledWith('8801234567890');
    expect(result.current.dateAutoDetected).toBe(true);
    expect(result.current.nameAutoDetected).toBe(true);
    expect(result.current.brandAutoDetected).toBe(true);
    expect(result.current.barcodeAutoDetected).toBe(true);
  });

  it('does the same for a camera photo', async () => {
    mockedCamera.mockResolvedValue({ canceled: false, assets: [{ uri: 'file:///cam.jpg' }] });
    const callbacks = setup();
    const { result } = await renderHook(() => useGifticonImage(callbacks));

    await act(async () => {
      await result.current.takePhoto();
    });

    expect(callbacks.onImageChosen).toHaveBeenCalledWith('file:///cam.jpg');
  });

  it('offers a way to Settings when the photo library throws', async () => {
    mockedLibrary.mockRejectedValue(new Error('permission denied'));
    const callbacks = setup();
    const { result } = await renderHook(() => useGifticonImage(callbacks));

    await act(async () => {
      await result.current.pickFromLibrary();
    });

    expect(Alert.alert).toHaveBeenCalledWith(
      '오류',
      '사진첩에 접근하지 못했어요. 권한을 확인해주세요.',
      expect.any(Array),
    );
    expect(callbacks.onImageChosen).not.toHaveBeenCalled();
  });

  it('offers a way to Settings when the camera throws', async () => {
    mockedCamera.mockRejectedValue(new Error('permission denied'));
    const callbacks = setup();
    const { result } = await renderHook(() => useGifticonImage(callbacks));

    await act(async () => {
      await result.current.takePhoto();
    });

    expect(Alert.alert).toHaveBeenCalledWith(
      '오류',
      '카메라를 사용하지 못했어요. 권한을 확인해주세요.',
      expect.any(Array),
    );
    expect(callbacks.onImageChosen).not.toHaveBeenCalled();
  });

  it('ignores a stale recognition result when a newer image was picked', async () => {
    const resolvers: ((v: string | null) => void)[] = [];
    mockedRecognizeText.mockImplementation(
      () => new Promise<string | null>((r) => resolvers.push(r)),
    );
    mockedLibrary
      .mockResolvedValueOnce({ canceled: false, assets: [{ uri: 'file:///a.jpg' }] })
      .mockResolvedValueOnce({ canceled: false, assets: [{ uri: 'file:///b.jpg' }] });
    const callbacks = setup();
    const { result } = await renderHook(() => useGifticonImage(callbacks));

    await act(async () => {
      await result.current.pickFromLibrary();
    });
    await act(async () => {
      await result.current.pickFromLibrary();
    });

    await act(async () => resolvers[1]('유효기간 2027.05.05까지'));
    await act(async () => resolvers[0]('유효기간 2020.01.01까지'));

    expect(callbacks.onExpiryDetected).toHaveBeenCalledTimes(1);
    expect(callbacks.onExpiryDetected.mock.calls[0][0].getFullYear()).toBe(2027);
  });

  it('marking a field edited while its recognition is still in flight suppresses only that field', async () => {
    const resolvers: ((v: string | null) => void)[] = [];
    mockedRecognizeText.mockImplementation(
      () => new Promise<string | null>((r) => resolvers.push(r)),
    );
    mockedLibrary.mockResolvedValue({ canceled: false, assets: [{ uri: 'file:///a.jpg' }] });
    const callbacks = setup();
    const { result } = await renderHook(() => useGifticonImage(callbacks));

    await act(async () => {
      await result.current.pickFromLibrary();
    });
    // The user edits the date field by hand before OCR resolves.
    await act(() => result.current.markDateManuallyEdited());
    await act(async () => resolvers[0](GIFTICON_TEXT));

    expect(callbacks.onExpiryDetected).not.toHaveBeenCalled();
    expect(result.current.dateAutoDetected).toBe(false);
    // Name/brand aren't guarded by the same ref, so they still auto-fill.
    expect(callbacks.onNameDetected).toHaveBeenCalledWith('아메리카노 Tall');
    expect(callbacks.onBrandDetected).toHaveBeenCalledWith('스타벅스');
  });

  it('picking a new photo resets every manually-edited guard from the previous one', async () => {
    const resolvers: ((v: string | null) => void)[] = [];
    mockedRecognizeText.mockImplementation(
      () => new Promise<string | null>((r) => resolvers.push(r)),
    );
    mockedLibrary.mockResolvedValue({ canceled: false, assets: [{ uri: 'file:///a.jpg' }] });
    const callbacks = setup();
    const { result } = await renderHook(() => useGifticonImage(callbacks));

    await act(async () => {
      await result.current.pickFromLibrary();
    });
    await act(() => result.current.markNameManuallyEdited());
    await act(async () => resolvers[0](GIFTICON_TEXT));
    expect(callbacks.onNameDetected).not.toHaveBeenCalled();

    // A newly picked photo is a fresh start — the guard from the previous
    // photo shouldn't carry over and suppress this one's own guess.
    await act(async () => {
      await result.current.pickFromLibrary();
    });
    await act(async () => resolvers[1](GIFTICON_TEXT));
    expect(callbacks.onNameDetected).toHaveBeenCalledWith('아메리카노 Tall');
  });
});
