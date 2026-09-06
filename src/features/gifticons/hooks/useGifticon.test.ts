import { act, renderHook, waitFor } from '@testing-library/react-native';
import { useGifticon } from './useGifticon';
import { subscribeToGifticon } from '../services/gifticonService';
import { readCachedGifticon } from '../services/gifticonCache';
import type { Gifticon } from '../types';

jest.mock('../services/gifticonService', () => ({
  subscribeToGifticon: jest.fn(),
}));
jest.mock('../services/gifticonCache', () => ({
  readCachedGifticon: jest.fn(async () => null),
}));

const mockedSubscribe = subscribeToGifticon as jest.Mock;
const mockedReadCache = readCachedGifticon as jest.Mock;

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
  mockedReadCache.mockResolvedValue(null);
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

  it('shows the cached gifticon while the live doc is still loading (offline cold start)', async () => {
    captureCallbacks();
    mockedReadCache.mockResolvedValue({
      id: 'g1',
      name: '캐시된 아메리카노',
      barcode: '123',
    } as Gifticon);

    const { result } = await renderHook(() => useGifticon('g1'));

    await waitFor(() => expect(result.current.gifticon).toMatchObject({ barcode: '123' }));
    // A cached copy means the screen shouldn't sit on a skeleton.
    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it('prefers the live doc over the cache once a snapshot arrives', async () => {
    captureCallbacks();
    mockedReadCache.mockResolvedValue({ id: 'g1', name: '캐시', barcode: 'old' } as Gifticon);

    const { result } = await renderHook(() => useGifticon('g1'));
    await waitFor(() => expect(result.current.gifticon).toMatchObject({ barcode: 'old' }));

    await act(async () => {
      lastCallbacks.onChange({ id: 'g1', name: '라이브', barcode: 'new' } as Gifticon);
    });

    expect(result.current.gifticon).toMatchObject({ name: '라이브', barcode: 'new' });
  });

  it('drops the stale cache once the live listener confirms the doc is gone', async () => {
    captureCallbacks();
    mockedReadCache.mockResolvedValue({ id: 'g1', name: '삭제된 것' } as Gifticon);

    const { result } = await renderHook(() => useGifticon('g1'));
    await waitFor(() => expect(result.current.gifticon).toMatchObject({ id: 'g1' }));

    await act(async () => {
      lastCallbacks.onChange(null); // snapshot: does not exist
    });

    expect(result.current.gifticon).toBeNull();
  });

  it('falls back to the cache when the live listener errors', async () => {
    captureCallbacks();
    mockedReadCache.mockResolvedValue({ id: 'g1', name: '캐시', barcode: '999' } as Gifticon);

    const { result } = await renderHook(() => useGifticon('g1'));
    await waitFor(() => expect(result.current.gifticon).toMatchObject({ barcode: '999' }));

    await act(async () => {
      lastCallbacks.onError(new Error('unavailable'));
    });

    expect(result.current.gifticon).toMatchObject({ barcode: '999' });
    expect(result.current.error).toBeNull();
  });
});
