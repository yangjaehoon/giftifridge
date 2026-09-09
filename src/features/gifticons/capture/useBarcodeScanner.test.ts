import { Alert } from 'react-native';
import { act, renderHook } from '@testing-library/react-native';
import { useCameraPermissions } from 'expo-camera';
import { useBarcodeScanner } from './useBarcodeScanner';

jest.mock('expo-camera', () => ({ useCameraPermissions: jest.fn() }));

const mockedUsePermissions = useCameraPermissions as jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
  jest.spyOn(Alert, 'alert').mockImplementation(() => {});
});

describe('useBarcodeScanner', () => {
  it('opens directly when camera permission is already granted', async () => {
    mockedUsePermissions.mockReturnValue([{ granted: true }, jest.fn()]);
    const { result } = await renderHook(() => useBarcodeScanner(jest.fn()));

    await act(async () => {
      await result.current.open();
    });

    expect(result.current.visible).toBe(true);
  });

  it('requests permission first, then opens when granted', async () => {
    const request = jest.fn().mockResolvedValue({ granted: true });
    mockedUsePermissions.mockReturnValue([{ granted: false }, request]);
    const { result } = await renderHook(() => useBarcodeScanner(jest.fn()));

    await act(async () => {
      await result.current.open();
    });

    expect(request).toHaveBeenCalledTimes(1);
    expect(result.current.visible).toBe(true);
  });

  it('alerts and stays closed when permission is denied', async () => {
    mockedUsePermissions.mockReturnValue([
      { granted: false },
      jest.fn().mockResolvedValue({ granted: false }),
    ]);
    const { result } = await renderHook(() => useBarcodeScanner(jest.fn()));

    await act(async () => {
      await result.current.open();
    });

    expect(Alert.alert).toHaveBeenCalledWith(
      '알림',
      '바코드 스캔을 위해 카메라 권한이 필요해요.',
      expect.any(Array),
    );
    expect(result.current.visible).toBe(false);
  });

  it('handleScanned forwards the code and closes the modal', async () => {
    mockedUsePermissions.mockReturnValue([{ granted: true }, jest.fn()]);
    const onScanned = jest.fn();
    const { result } = await renderHook(() => useBarcodeScanner(onScanned));

    await act(async () => {
      await result.current.open();
    });
    await act(async () => result.current.handleScanned({ data: '8801234567' }));

    expect(onScanned).toHaveBeenCalledWith('8801234567');
    expect(result.current.visible).toBe(false);
  });
});
