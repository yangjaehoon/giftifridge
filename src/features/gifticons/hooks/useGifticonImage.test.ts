import { act, renderHook, waitFor } from '@testing-library/react-native';
import { Alert } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { recognizeText } from '../services/ocrService';
import type { RecognizedText } from '../services/ocrService';
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

const GIFTICON_TEXT = '스타벅스\n아메리카노 Tall\n금액 10,000원\n유효기간 2026.12.31까지';

function ocrResult(text: string): RecognizedText {
  return { text, lines: text.split('\n').map((line) => ({ text: line, height: 0 })) };
}

function setup() {
  return {
    onImageChosen: jest.fn(),
    onExpiryDetected: jest.fn(),
    onNameDetected: jest.fn(),
    onBrandDetected: jest.fn(),
    onBarcodeDetected: jest.fn(),
    onCategoryDetected: jest.fn(),
    onAmountDetected: jest.fn(),
    // useGifticonForm owns this in the real app; a mock here lets a test say
    // "the user has claimed field X" without a form.
    isFieldEdited: jest.fn((_field: string) => false),
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
    mockedRecognizeText.mockResolvedValue(ocrResult(GIFTICON_TEXT));
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
    expect(callbacks.onCategoryDetected).toHaveBeenCalledWith('cafe');
    expect(callbacks.onAmountDetected).toHaveBeenCalledWith(10000);
    expect(result.current.dateAutoDetected).toBe(true);
    expect(result.current.nameAutoDetected).toBe(true);
    expect(result.current.brandAutoDetected).toBe(true);
    expect(result.current.barcodeAutoDetected).toBe(true);
    expect(result.current.categoryAutoDetected).toBe(true);
    expect(result.current.amountAutoDetected).toBe(true);
  });

  it('falls back to a barcode number printed in the OCR text when the photo itself has none', async () => {
    mockedLibrary.mockResolvedValue({ canceled: false, assets: [{ uri: 'file:///a.jpg' }] });
    mockedRecognizeText.mockResolvedValue(
      ocrResult('스타벅스\n아메리카노 Tall\n바코드 8801234567890\n유효기간 2026.12.31까지'),
    );
    mockedRecognizeBarcode.mockResolvedValue(null);
    const callbacks = setup();
    const { result } = await renderHook(() => useGifticonImage(callbacks));

    await act(async () => {
      await result.current.pickFromLibrary();
    });

    await waitFor(() => expect(callbacks.onBarcodeDetected).toHaveBeenCalledWith('8801234567890'));
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
    const resolvers: ((v: RecognizedText | null) => void)[] = [];
    mockedRecognizeText.mockImplementation(
      () => new Promise<RecognizedText | null>((r) => resolvers.push(r)),
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

    await act(async () => resolvers[1](ocrResult('유효기간 2027.05.05까지')));
    await act(async () => resolvers[0](ocrResult('유효기간 2020.01.01까지')));

    expect(callbacks.onExpiryDetected).toHaveBeenCalledTimes(1);
    expect(callbacks.onExpiryDetected.mock.calls[0][0].getFullYear()).toBe(2027);
  });

  it('a field the user claims while its recognition is still in flight is left alone', async () => {
    const resolvers: ((v: RecognizedText | null) => void)[] = [];
    mockedRecognizeText.mockImplementation(
      () => new Promise<RecognizedText | null>((r) => resolvers.push(r)),
    );
    mockedLibrary.mockResolvedValue({ canceled: false, assets: [{ uri: 'file:///a.jpg' }] });
    const callbacks = setup();
    const { result } = await renderHook(() => useGifticonImage(callbacks));

    await act(async () => {
      await result.current.pickFromLibrary();
    });
    // The user edits the date field by hand before OCR resolves — the form now
    // reports it as claimed. isFieldEdited is read at detect time (after the
    // await), so this still takes effect.
    callbacks.isFieldEdited.mockImplementation((field: string) => field === 'expiresAt');
    await act(async () => resolvers[0](ocrResult(GIFTICON_TEXT)));

    expect(callbacks.onExpiryDetected).not.toHaveBeenCalled();
    expect(result.current.dateAutoDetected).toBe(false);
    // Only the date was claimed, so name/brand still auto-fill.
    expect(callbacks.onNameDetected).toHaveBeenCalledWith('아메리카노 Tall');
    expect(callbacks.onBrandDetected).toHaveBeenCalledWith('스타벅스');
  });

  it('a claimed field stays claimed when a different photo is picked afterward', async () => {
    const resolvers: ((v: RecognizedText | null) => void)[] = [];
    mockedRecognizeText.mockImplementation(
      () => new Promise<RecognizedText | null>((r) => resolvers.push(r)),
    );
    mockedLibrary.mockResolvedValue({ canceled: false, assets: [{ uri: 'file:///a.jpg' }] });
    const callbacks = setup();
    const { result } = await renderHook(() => useGifticonImage(callbacks));

    await act(async () => {
      await result.current.pickFromLibrary();
    });
    callbacks.isFieldEdited.mockImplementation((field: string) => field === 'name');
    await act(async () => resolvers[0](ocrResult(GIFTICON_TEXT)));
    expect(callbacks.onNameDetected).not.toHaveBeenCalled();

    // Picking a different photo afterward must not silently overwrite a name
    // the user has already committed to (typed, or claimed by useGifticonForm's
    // hydration because it came from an existing gifticon). The hook never
    // clears the claim on its own; only the form does, when the user edits.
    await act(async () => {
      await result.current.pickFromLibrary();
    });
    await act(async () => resolvers[1](ocrResult(GIFTICON_TEXT)));
    expect(callbacks.onNameDetected).not.toHaveBeenCalled();
  });

  it('leaves category and amount alone once the form reports them claimed', async () => {
    mockedRecognizeText.mockResolvedValue(ocrResult(GIFTICON_TEXT));
    mockedLibrary.mockResolvedValue({ canceled: false, assets: [{ uri: 'file:///a.jpg' }] });
    const callbacks = setup();
    callbacks.isFieldEdited.mockImplementation(
      (field: string) => field === 'category' || field === 'amount',
    );
    const { result } = await renderHook(() => useGifticonImage(callbacks));

    await act(async () => {
      await result.current.pickFromLibrary();
    });

    expect(callbacks.onCategoryDetected).not.toHaveBeenCalled();
    expect(callbacks.onAmountDetected).not.toHaveBeenCalled();
    expect(callbacks.onNameDetected).toHaveBeenCalledWith('아메리카노 Tall');
  });

  it('a field never auto-filled yet still gets filled by a later photo', async () => {
    mockedRecognizeText.mockResolvedValueOnce(null).mockResolvedValueOnce(ocrResult(GIFTICON_TEXT));
    mockedLibrary.mockResolvedValue({ canceled: false, assets: [{ uri: 'file:///a.jpg' }] });
    const callbacks = setup();
    const { result } = await renderHook(() => useGifticonImage(callbacks));

    await act(async () => {
      await result.current.pickFromLibrary();
    });
    expect(callbacks.onNameDetected).not.toHaveBeenCalled();

    await act(async () => {
      await result.current.pickFromLibrary();
    });
    expect(callbacks.onNameDetected).toHaveBeenCalledWith('아메리카노 Tall');
  });
});
