import { act, renderHook } from '@testing-library/react-native';
import { useFirestoreDoc } from './useFirestoreDoc';

function createMockSubscribe<T>() {
  const calls: {
    onChange: (doc: T | null) => void;
    onError: (error: Error) => void;
  }[] = [];
  const unsubscribe = jest.fn();
  const subscribe = jest.fn(
    (_key: string, onChange: (doc: T | null) => void, onError: (error: Error) => void) => {
      calls.push({ onChange, onError });
      return unsubscribe;
    },
  );
  return { subscribe, unsubscribe, calls };
}

describe('useFirestoreDoc', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it('starts loading with no data', async () => {
    const { subscribe } = createMockSubscribe<{ id: string }>();
    const { result } = await renderHook(() => useFirestoreDoc('g1', subscribe));

    expect(result.current.loading).toBe(true);
    expect(result.current.data).toBeNull();
  });

  it('does not subscribe and is not loading while the key is undefined', async () => {
    const { subscribe } = createMockSubscribe<{ id: string }>();
    const { result } = await renderHook(() => useFirestoreDoc(undefined, subscribe));

    expect(subscribe).not.toHaveBeenCalled();
    expect(result.current.loading).toBe(false);
  });

  it('exposes the document from the first snapshot', async () => {
    const { subscribe, calls } = createMockSubscribe<{ id: string }>();
    const { result } = await renderHook(() => useFirestoreDoc('g1', subscribe));

    await act(async () => calls[0].onChange({ id: 'g1' }));

    expect(result.current.data).toEqual({ id: 'g1' });
    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it('passes null through (document not found)', async () => {
    const { subscribe, calls } = createMockSubscribe<{ id: string }>();
    const { result } = await renderHook(() => useFirestoreDoc('g1', subscribe));

    await act(async () => calls[0].onChange(null));

    expect(result.current.data).toBeNull();
    expect(result.current.loading).toBe(false);
  });

  it('retries a listener error with exponential backoff', async () => {
    const { subscribe, calls } = createMockSubscribe<{ id: string }>();
    await renderHook(() => useFirestoreDoc('g1', subscribe));

    await act(async () => calls[0].onError(new Error('boom')));
    await act(async () => jest.advanceTimersByTime(999));
    expect(subscribe).toHaveBeenCalledTimes(1);
    await act(async () => jest.advanceTimersByTime(1));
    expect(subscribe).toHaveBeenCalledTimes(2);

    await act(async () => calls[1].onError(new Error('boom 2')));
    await act(async () => jest.advanceTimersByTime(2000));
    expect(subscribe).toHaveBeenCalledTimes(3);
  });

  it('resets data and loading, and the backoff budget, when the key changes', async () => {
    const { subscribe, calls } = createMockSubscribe<{ id: string }>();
    const { result, rerender } = await renderHook(
      ({ key }: { key: string }) => useFirestoreDoc(key, subscribe),
      { initialProps: { key: 'g1' } },
    );

    await act(async () => calls[0].onChange({ id: 'g1' }));
    await act(async () => calls[0].onError(new Error('g1 fail')));
    await act(async () => jest.advanceTimersByTime(1000));
    expect(subscribe).toHaveBeenCalledTimes(2);

    await rerender({ key: 'g2' });
    expect(result.current.data).toBeNull();
    expect(result.current.loading).toBe(true);
    expect(subscribe).toHaveBeenCalledTimes(3);

    await act(async () => calls[2].onError(new Error('g2 blip')));
    await act(async () => jest.advanceTimersByTime(1000));
    expect(subscribe).toHaveBeenCalledTimes(4);
  });

  it('unsubscribes and cancels the pending retry on unmount', async () => {
    const { subscribe, unsubscribe, calls } = createMockSubscribe<{ id: string }>();
    const { unmount } = await renderHook(() => useFirestoreDoc('g1', subscribe));

    await act(async () => calls[0].onError(new Error('boom')));
    await unmount();
    expect(unsubscribe).toHaveBeenCalledTimes(1);

    await act(async () => jest.advanceTimersByTime(5000));
    expect(subscribe).toHaveBeenCalledTimes(1);
  });

  it('refresh() forces a resubscribe', async () => {
    const { subscribe, calls } = createMockSubscribe<{ id: string }>();
    const { result } = await renderHook(() => useFirestoreDoc('g1', subscribe));

    await act(async () => calls[0].onChange({ id: 'g1' }));
    await act(async () => result.current.refresh());

    expect(subscribe).toHaveBeenCalledTimes(2);
  });
});
