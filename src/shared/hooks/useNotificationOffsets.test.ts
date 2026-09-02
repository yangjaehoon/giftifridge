import { Alert } from 'react-native';
import { act, renderHook, waitFor } from '@testing-library/react-native';
import { useNotificationOffsets } from './useNotificationOffsets';
import { getNotificationOffsets, setNotificationOffsets } from '../utils/notificationPrefs';

jest.mock('../utils/notificationPrefs', () => ({
  getNotificationOffsets: jest.fn(),
  setNotificationOffsets: jest.fn(),
}));

const mockedGet = getNotificationOffsets as jest.Mock;
const mockedSet = setNotificationOffsets as jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
  jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  mockedGet.mockResolvedValue([7, 3]);
  mockedSet.mockResolvedValue(undefined);
});

describe('useNotificationOffsets', () => {
  it('exposes the loaded offsets once the initial read resolves', async () => {
    const { result } = await renderHook(() => useNotificationOffsets());

    await waitFor(() => expect(result.current.offsets).toEqual([7, 3]));
  });

  it('adds an offset (kept sorted descending) and persists it', async () => {
    const { result } = await renderHook(() => useNotificationOffsets());
    await waitFor(() => expect(result.current.offsets).toEqual([7, 3]));

    await act(async () => {
      await result.current.toggle(1);
    });

    expect(result.current.offsets).toEqual([7, 3, 1]);
    expect(mockedSet).toHaveBeenCalledWith([7, 3, 1]);
  });

  it('removes an already-selected offset', async () => {
    const { result } = await renderHook(() => useNotificationOffsets());
    await waitFor(() => expect(result.current.offsets).toEqual([7, 3]));

    await act(async () => {
      await result.current.toggle(7);
    });

    expect(result.current.offsets).toEqual([3]);
    expect(mockedSet).toHaveBeenCalledWith([3]);
  });

  it('rolls back and alerts when the write fails', async () => {
    mockedSet.mockRejectedValue(new Error('disk full'));
    const { result } = await renderHook(() => useNotificationOffsets());
    await waitFor(() => expect(result.current.offsets).toEqual([7, 3]));

    await act(async () => {
      await result.current.toggle(1);
    });

    expect(result.current.offsets).toEqual([7, 3]);
    expect(Alert.alert).toHaveBeenCalledWith(
      '오류',
      '알림 설정을 저장하지 못했어요. 다시 시도해주세요.',
    );
  });

  it('is a no-op when toggled before the initial load resolves', async () => {
    mockedGet.mockReturnValue(new Promise(() => {}));
    const { result } = await renderHook(() => useNotificationOffsets());

    await act(async () => {
      await result.current.toggle(1);
    });

    expect(mockedSet).not.toHaveBeenCalled();
    expect(result.current.offsets).toBeNull();
  });
});
