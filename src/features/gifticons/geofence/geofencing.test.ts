import * as Location from 'expo-location';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { clearGeofences, geofenceRegionsFor, MAX_GEOFENCES, syncGeofences } from './geofencing';
import { readGeofenceLabels } from './geofenceTask';
import type { Gifticon } from '../domain/types';

jest.mock('expo-task-manager', () => ({ defineTask: jest.fn() }));
jest.mock('expo-location', () => ({
  GeofencingEventType: { Enter: 1, Exit: 2 },
  hasStartedGeofencingAsync: jest.fn(),
  startGeofencingAsync: jest.fn(),
  stopGeofencingAsync: jest.fn(),
}));
jest.mock('expo-notifications', () => ({ scheduleNotificationAsync: jest.fn() }));

const mockedHasStarted = Location.hasStartedGeofencingAsync as jest.Mock;
const mockedStart = Location.startGeofencingAsync as jest.Mock;
const mockedStop = Location.stopGeofencingAsync as jest.Mock;

function g(overrides: Partial<Gifticon> & { id: string }): Gifticon {
  return {
    ownerId: 'u1',
    name: '아메리카노',
    brand: '스타벅스',
    category: 'cafe',
    imageUrl: 'https://x/y.jpg',
    expiresAt: '2027-01-10',
    isUsed: false,
    createdAt: '2026-01-01T00:00:00.000Z',
    location: { latitude: 37.5, longitude: 127 },
    ...overrides,
  };
}

beforeEach(async () => {
  jest.clearAllMocks();
  await AsyncStorage.clear();
  mockedHasStarted.mockResolvedValue(false);
});

describe('geofenceRegionsFor', () => {
  it('keeps only unused, located gifticons', () => {
    const regions = geofenceRegionsFor([
      g({ id: 'ok' }),
      g({ id: 'used', isUsed: true }),
      g({ id: 'no-loc', location: undefined }),
    ]);
    expect(regions.map((r) => r.identifier)).toEqual(['ok']);
    expect(regions[0]).toMatchObject({ notifyOnEnter: true, notifyOnExit: false });
  });

  it('caps at MAX_GEOFENCES, newest first', () => {
    const many = Array.from({ length: MAX_GEOFENCES + 5 }, (_, i) =>
      g({ id: `g${i}`, createdAt: `2026-01-${String(i + 1).padStart(2, '0')}T00:00:00.000Z` }),
    );
    const regions = geofenceRegionsFor(many);
    expect(regions).toHaveLength(MAX_GEOFENCES);
    // g22 (newest) is kept, g0 (oldest) is dropped.
    expect(regions[0].identifier).toBe(`g${MAX_GEOFENCES + 4}`);
    expect(regions.map((r) => r.identifier)).not.toContain('g0');
  });
});

describe('syncGeofences', () => {
  it('starts geofencing with the regions and stores their labels', async () => {
    await syncGeofences([g({ id: 'g1', brand: '스타벅스', name: '아메리카노' })]);

    expect(mockedStart).toHaveBeenCalledWith(
      'gifticon-store-geofence',
      expect.arrayContaining([expect.objectContaining({ identifier: 'g1' })]),
    );
    expect(await readGeofenceLabels()).toEqual({
      g1: { brand: '스타벅스', name: '아메리카노' },
    });
  });

  it('stops geofencing and clears labels when nothing qualifies', async () => {
    mockedHasStarted.mockResolvedValue(true);

    await syncGeofences([g({ id: 'used', isUsed: true })]);

    expect(mockedStop).toHaveBeenCalledWith('gifticon-store-geofence');
    expect(mockedStart).not.toHaveBeenCalled();
    expect(await readGeofenceLabels()).toEqual({});
  });

  it('swallows a native failure instead of throwing to the caller', async () => {
    mockedStart.mockRejectedValue(new Error('missing ACCESS_BACKGROUND_LOCATION'));
    await expect(syncGeofences([g({ id: 'g1' })])).resolves.toBeUndefined();
  });
});

describe('clearGeofences', () => {
  it('stops geofencing when it was running', async () => {
    mockedHasStarted.mockResolvedValue(true);
    await clearGeofences();
    expect(mockedStop).toHaveBeenCalledWith('gifticon-store-geofence');
  });

  it('is a no-op when geofencing was never started', async () => {
    mockedHasStarted.mockResolvedValue(false);
    await clearGeofences();
    expect(mockedStop).not.toHaveBeenCalled();
  });
});
