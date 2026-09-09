import { renderHook, waitFor } from '@testing-library/react-native';
import { useNearbyGifticons } from './useNearbyGifticons';
import { getCurrentLocation } from '../../../shared/utils/location';
import type { Gifticon } from '../types';

jest.mock('../../../shared/utils/location', () => ({
  getCurrentLocation: jest.fn(),
}));

// useFocusEffect isn't wrapped in a navigator here, so run its callback like a
// plain effect and honour the cleanup it returns.
jest.mock('@react-navigation/native', () => ({
  useFocusEffect: (cb: () => void | (() => void)) => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { useEffect } = require('react');
    useEffect(() => cb(), [cb]);
  },
}));

const mockedGetCurrentLocation = getCurrentLocation as jest.Mock;

function located(id: string, latitude: number, longitude: number): Gifticon {
  return {
    id,
    ownerId: 'owner',
    name: '아메리카노',
    brand: '스타벅스',
    category: 'cafe',
    imageUrl: 'https://example.com/x.jpg',
    expiresAt: new Date().toISOString(),
    isUsed: false,
    createdAt: new Date().toISOString(),
    location: { latitude, longitude },
  };
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe('useNearbyGifticons', () => {
  it('returns an empty list and never reads GPS when no item has a location', async () => {
    const noLocation = { ...located('1', 0, 0), location: undefined };
    const { result } = await renderHook(() => useNearbyGifticons([noLocation]));

    expect(result.current).toEqual([]);
    expect(mockedGetCurrentLocation).not.toHaveBeenCalled();
  });

  it('keeps only unused located gifticons within 300m of the current position', async () => {
    mockedGetCurrentLocation.mockResolvedValue({ latitude: 37.5665, longitude: 126.978 });

    const near = located('near', 37.5666, 126.9781); // ~15m away
    const far = located('far', 37.6, 127.05); // several km away
    const used = { ...located('used', 37.5665, 126.978), isUsed: true };

    const { result } = await renderHook(() => useNearbyGifticons([near, far, used]));

    await waitFor(() => expect(result.current).toHaveLength(1));
    expect(result.current[0].id).toBe('near');
  });

  it('returns an empty list when the location permission yields no coordinates', async () => {
    mockedGetCurrentLocation.mockResolvedValue(null);
    const { result } = await renderHook(() => useNearbyGifticons([located('1', 37.5, 127)]));

    await waitFor(() => expect(mockedGetCurrentLocation).toHaveBeenCalled());
    expect(result.current).toEqual([]);
  });

  it('swallows a location lookup failure and stays empty', async () => {
    mockedGetCurrentLocation.mockRejectedValue(new Error('gps error'));
    const { result } = await renderHook(() => useNearbyGifticons([located('1', 37.5, 127)]));

    await waitFor(() => expect(mockedGetCurrentLocation).toHaveBeenCalled());
    expect(result.current).toEqual([]);
  });
});
