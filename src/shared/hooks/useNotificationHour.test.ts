import { Alert } from 'react-native';
import { act, renderHook, waitFor } from '@testing-library/react-native';
import { useNotificationHour } from './useNotificationHour';
import { getNotificationHour, setNotificationHour } from '../utils/notificationPrefs';

jest.mock('../utils/notificationPrefs', () => ({
  getNotificationHour: jest.fn(),
  setNotificationHour: jest.fn(),
}));

const mockedGet = getNotificationHour as jest.Mock;
const mockedSet = setNotificationHour as jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
  jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  mockedGet.mockResolvedValue(9);
  mockedSet.mockResolvedValue(undefined);
});

describe('useNotificationHour', () => {
  it('exposes the loaded hour once the initial read resolves', async () => {
    const { result } = await renderHook(() => useNotificationHour());

    await waitFor(() => expect(result.current.hour).toBe(9));
  });

  it('selects a new hour and persists it', async () => {
    const { result } = await renderHook(() => useNotificationHour());
    await waitFor(() => expect(result.current.hour).toBe(9));

    await act(async () => {
      await result.current.select(21);
    });

    expect(result.current.hour).toBe(21);
    expect(mockedSet).toHaveBeenCalledWith(21);
  });

  it('ignores a re-select of the current hour', async () => {
    const { result } = await renderHook(() => useNotificationHour());
    await waitFor(() => expect(result.current.hour).toBe(9));

    await act(async () => {
      await result.current.select(9);
    });

    expect(mockedSet).not.toHaveBeenCalled();
  });

  it('rolls back and alerts when the write fails', async () => {
    mockedSet.mockRejectedValue(new Error('disk full'));
    const { result } = await renderHook(() => useNotificationHour());
    await waitFor(() => expect(result.current.hour).toBe(9));

    await act(async () => {
      await result.current.select(18);
    });

    expect(result.current.hour).toBe(9);
    expect(Alert.alert).toHaveBeenCalledWith(
      '오류',
      '알림 설정을 저장하지 못했어요. 다시 시도해주세요.',
    );
  });

  it('is a no-op when selected before the initial load resolves', async () => {
    mockedGet.mockReturnValue(new Promise(() => {}));
    const { result } = await renderHook(() => useNotificationHour());

    await act(async () => {
      await result.current.select(21);
    });

    expect(mockedSet).not.toHaveBeenCalled();
    expect(result.current.hour).toBeNull();
  });
});
