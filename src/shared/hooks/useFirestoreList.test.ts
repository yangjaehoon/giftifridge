import { act, renderHook } from '@testing-library/react-native';
import { useFirestoreList } from './useFirestoreList';

function createMockSubscribe<T>() {
  const calls: {
    onChange: (items: T[]) => void;
    onError: (error: Error) => void;
  }[] = [];
  const unsubscribe = jest.fn();
  const subscribe = jest.fn(
    (_key: string, onChange: (items: T[]) => void, onError: (error: Error) => void) => {
      calls.push({ onChange, onError });
      return unsubscribe;
    },
  );
  return { subscribe, unsubscribe, calls };
}

describe('useFirestoreList', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('starts in a loading state with no items', async () => {
    const { subscribe } = createMockSubscribe<{ id: string }>();
    const { result } = await renderHook(() => useFirestoreList('owner-1', subscribe));

    expect(result.current.loading).toBe(true);
    expect(result.current.items).toEqual([]);
  });

  it('does not subscribe while the key is undefined', async () => {
    const { subscribe } = createMockSubscribe<{ id: string }>();
    const { result } = await renderHook(() => useFirestoreList(undefined, subscribe));

    expect(subscribe).not.toHaveBeenCalled();
    expect(result.current.loading).toBe(false);
    expect(result.current.items).toEqual([]);
  });

  it('returns items and clears loading/error once the subscription succeeds', async () => {
    const { subscribe, calls } = createMockSubscribe<{ id: string }>();
    const { result } = await renderHook(() => useFirestoreList('owner-1', subscribe));

    await act(async () => {
      calls[0].onChange([{ id: 'a' }]);
    });

    expect(result.current.items).toEqual([{ id: 'a' }]);
    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it('retries with exponential backoff after a listener error', async () => {
    const { subscribe, calls } = createMockSubscribe<{ id: string }>();
    const { result } = await renderHook(() => useFirestoreList('owner-1', subscribe));

    await act(async () => {
      calls[0].onError(new Error('boom'));
    });
    expect(result.current.error?.message).toBe('boom');
    expect(subscribe).toHaveBeenCalledTimes(1);

    await act(async () => {
      jest.advanceTimersByTime(999);
    });
    expect(subscribe).toHaveBeenCalledTimes(1);

    await act(async () => {
      jest.advanceTimersByTime(1);
    });
    expect(subscribe).toHaveBeenCalledTimes(2);

    await act(async () => {
      calls[1].onError(new Error('boom again'));
    });
    await act(async () => {
      jest.advanceTimersByTime(1999);
    });
    expect(subscribe).toHaveBeenCalledTimes(2);

    await act(async () => {
      jest.advanceTimersByTime(1);
    });
    expect(subscribe).toHaveBeenCalledTimes(3);
  });

  it('resets the retry delay back to the base after a successful snapshot', async () => {
    const { subscribe, calls } = createMockSubscribe<{ id: string }>();
    const { result } = await renderHook(() => useFirestoreList('owner-1', subscribe));

    await act(async () => {
      calls[0].onError(new Error('first failure'));
    });
    await act(async () => {
      jest.advanceTimersByTime(1000);
    });
    expect(subscribe).toHaveBeenCalledTimes(2);

    await act(async () => {
      calls[1].onChange([]);
    });
    expect(result.current.error).toBeNull();

    await act(async () => {
      calls[1].onError(new Error('second failure'));
    });
    await act(async () => {
      jest.advanceTimersByTime(999);
    });
    expect(subscribe).toHaveBeenCalledTimes(2);

    await act(async () => {
      jest.advanceTimersByTime(1);
    });
    expect(subscribe).toHaveBeenCalledTimes(3);
  });

  it('resets items and loading when the key changes', async () => {
    const { subscribe, calls } = createMockSubscribe<{ id: string }>();
    const { result, rerender } = await renderHook(
      ({ key }: { key: string }) => useFirestoreList(key, subscribe),
      { initialProps: { key: 'owner-1' } },
    );

    await act(async () => {
      calls[0].onChange([{ id: 'a' }]);
    });
    expect(result.current.items).toEqual([{ id: 'a' }]);

    await rerender({ key: 'owner-2' });

    expect(result.current.items).toEqual([]);
    expect(result.current.loading).toBe(true);
  });

  it('refresh() marks refreshing and triggers a resubscribe', async () => {
    const { subscribe, calls } = createMockSubscribe<{ id: string }>();
    const { result } = await renderHook(() => useFirestoreList('owner-1', subscribe));

    await act(async () => {
      calls[0].onChange([]);
    });
    await act(async () => {
      result.current.refresh();
    });

    expect(result.current.refreshing).toBe(true);
    expect(subscribe).toHaveBeenCalledTimes(2);
  });

  it('unsubscribes and cancels the pending retry on unmount', async () => {
    const { subscribe, unsubscribe, calls } = createMockSubscribe<{ id: string }>();
    const { unmount } = await renderHook(() => useFirestoreList('owner-1', subscribe));

    await act(async () => {
      calls[0].onError(new Error('boom'));
    });
    await unmount();
    expect(unsubscribe).toHaveBeenCalledTimes(1);

    await act(async () => {
      jest.advanceTimersByTime(5000);
    });
    expect(subscribe).toHaveBeenCalledTimes(1);
  });
});
