import { act, renderHook } from '@testing-library/react-native';
import NetInfo from '@react-native-community/netinfo';
import { useNetworkStatus } from './useNetworkStatus';

jest.mock('@react-native-community/netinfo', () => ({
  __esModule: true,
  default: { addEventListener: jest.fn() },
}));

const mockedAddEventListener = NetInfo.addEventListener as jest.Mock;

let emit: (state: { isConnected: boolean | null }) => void;

beforeEach(() => {
  jest.clearAllMocks();
  mockedAddEventListener.mockImplementation((listener) => {
    emit = listener;
    return jest.fn();
  });
});

describe('useNetworkStatus', () => {
  it('assumes connected before the first NetInfo event', async () => {
    const { result } = await renderHook(() => useNetworkStatus());
    expect(result.current).toBe(true);
  });

  it('reflects a disconnected state', async () => {
    const { result } = await renderHook(() => useNetworkStatus());

    await act(async () => {
      emit({ isConnected: false });
    });

    expect(result.current).toBe(false);
  });

  it('treats an unknown (null) connection state as connected', async () => {
    const { result } = await renderHook(() => useNetworkStatus());

    await act(async () => {
      emit({ isConnected: null });
    });

    expect(result.current).toBe(true);
  });

  it('unsubscribes from NetInfo on unmount', async () => {
    const unsubscribe = jest.fn();
    mockedAddEventListener.mockReturnValue(unsubscribe);

    const { unmount } = await renderHook(() => useNetworkStatus());
    await unmount();

    expect(unsubscribe).toHaveBeenCalledTimes(1);
  });
});
