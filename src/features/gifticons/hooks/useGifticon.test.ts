import { act, renderHook } from '@testing-library/react-native';
import { useGifticon } from './useGifticon';
import { subscribeToGifticon } from '../services/gifticonService';
import type { Gifticon } from '../types';

jest.mock('../services/gifticonService', () => ({
  subscribeToGifticon: jest.fn(),
}));

const mockedSubscribe = subscribeToGifticon as jest.Mock;

function captureCallbacks() {
  const unsubscribe = jest.fn();
  mockedSubscribe.mockImplementation((_id, onChange, onError) => {
    lastCallbacks = { onChange, onError };
    return unsubscribe;
  });
  return unsubscribe;
}

let lastCallbacks: {
  onChange: (g: Gifticon | null) => void;
  onError: (e: Error) => void;
};

beforeEach(() => {
  jest.clearAllMocks();
});

describe('useGifticon', () => {
  it('does not subscribe and reports not-loading when id is undefined', async () => {
    const { result } = await renderHook(() => useGifticon(undefined));

    expect(mockedSubscribe).not.toHaveBeenCalled();
    expect(result.current.loading).toBe(false);
    expect(result.current.gifticon).toBeNull();
  });

  it('starts loading, then exposes the gifticon from the first snapshot', async () => {
    captureCallbacks();
    const { result } = await renderHook(() => useGifticon('g1'));
    expect(result.current.loading).toBe(true);

    await act(async () => {
      lastCallbacks.onChange({ id: 'g1', name: '아메리카노' } as Gifticon);
    });

    expect(result.current.gifticon).toEqual({ id: 'g1', name: '아메리카노' });
    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it('surfaces listener errors and stops loading', async () => {
    captureCallbacks();
    const { result } = await renderHook(() => useGifticon('g1'));

    await act(async () => {
      lastCallbacks.onError(new Error('denied'));
    });

    expect(result.current.error?.message).toBe('denied');
    expect(result.current.loading).toBe(false);
  });

  it('resets to a clean loading state and resubscribes when the id changes', async () => {
    const unsubscribe = captureCallbacks();
    const { result, rerender } = await renderHook(({ id }: { id: string }) => useGifticon(id), {
      initialProps: { id: 'g1' },
    });

    await act(async () => {
      lastCallbacks.onChange({ id: 'g1', name: 'first' } as Gifticon);
    });
    expect(result.current.gifticon).toMatchObject({ id: 'g1' });

    await rerender({ id: 'g2' });

    expect(result.current.gifticon).toBeNull();
    expect(result.current.loading).toBe(true);
    expect(unsubscribe).toHaveBeenCalledTimes(1);
    expect(mockedSubscribe).toHaveBeenCalledTimes(2);
  });

  it('refresh() forces a resubscribe', async () => {
    captureCallbacks();
    const { result } = await renderHook(() => useGifticon('g1'));

    await act(async () => {
      lastCallbacks.onChange(null);
    });
    await act(async () => {
      result.current.refresh();
    });

    expect(mockedSubscribe).toHaveBeenCalledTimes(2);
  });
});
