import { act, renderHook } from '@testing-library/react-native';
import { useMySpaces } from './useMySpaces';
import { subscribeToMySpaces } from '../services/spaceService';
import type { Space } from '../types';

jest.mock('../services/spaceService', () => ({
  subscribeToMySpaces: jest.fn(),
}));

const mockedSubscribe = subscribeToMySpaces as jest.Mock;

let callbacks: { onChange: (s: Space[]) => void; onError: (e: Error) => void };

function wireMock() {
  const unsubscribe = jest.fn();
  mockedSubscribe.mockImplementation((_uid, onChange, onError) => {
    callbacks = { onChange, onError };
    return unsubscribe;
  });
  return unsubscribe;
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe('useMySpaces', () => {
  it('does not subscribe and returns empty state when uid is undefined', async () => {
    const { result } = await renderHook(() => useMySpaces(undefined));

    expect(mockedSubscribe).not.toHaveBeenCalled();
    expect(result.current.loading).toBe(false);
    expect(result.current.spaces).toEqual([]);
  });

  it('exposes the spaces list once the snapshot arrives', async () => {
    wireMock();
    const { result } = await renderHook(() => useMySpaces('user-1'));
    expect(result.current.loading).toBe(true);

    await act(async () => {
      callbacks.onChange([{ id: 's1', name: '집' } as Space]);
    });

    expect(result.current.spaces).toEqual([{ id: 's1', name: '집' }]);
    expect(result.current.loading).toBe(false);
  });

  it('surfaces a listener error and stops loading', async () => {
    wireMock();
    const { result } = await renderHook(() => useMySpaces('user-1'));

    await act(async () => {
      callbacks.onError(new Error('boom'));
    });

    expect(result.current.error?.message).toBe('boom');
    expect(result.current.loading).toBe(false);
  });

  it('unsubscribes on unmount', async () => {
    const unsubscribe = wireMock();
    const { unmount } = await renderHook(() => useMySpaces('user-1'));

    await unmount();

    expect(unsubscribe).toHaveBeenCalledTimes(1);
  });
});
