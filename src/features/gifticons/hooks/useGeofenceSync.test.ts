import { renderHook, waitFor } from '@testing-library/react-native';
import { useGeofenceSync } from './useGeofenceSync';
import { ensureBackgroundLocationPermission } from '../../../shared/utils/location';
import { clearGeofences, syncGeofences } from '../services/geofencing';
import type { Gifticon } from '../types';

jest.mock('../../../shared/utils/location', () => ({
  ensureBackgroundLocationPermission: jest.fn(),
}));
jest.mock('../services/geofencing', () => ({
  syncGeofences: jest.fn(),
  clearGeofences: jest.fn(),
}));

const mockedPermission = ensureBackgroundLocationPermission as jest.Mock;
const mockedSync = syncGeofences as jest.Mock;
const mockedClear = clearGeofences as jest.Mock;

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
    location: { latitude: 1, longitude: 2 },
    ...overrides,
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  mockedPermission.mockResolvedValue(true);
});

describe('useGeofenceSync', () => {
  it('does nothing while disabled (space context)', async () => {
    await renderHook(() => useGeofenceSync([g({ id: 'a' })], false));
    await Promise.resolve();
    expect(mockedPermission).not.toHaveBeenCalled();
    expect(mockedSync).not.toHaveBeenCalled();
  });

  it('asks for background permission once, then syncs the located gifticons', async () => {
    await renderHook(() => useGeofenceSync([g({ id: 'a' })], true));

    await waitFor(() => expect(mockedSync).toHaveBeenCalledTimes(1));
    expect(mockedPermission).toHaveBeenCalledTimes(1);
  });

  it('clears geofences when there are no located gifticons', async () => {
    await renderHook(() => useGeofenceSync([g({ id: 'a', location: undefined })], true));

    await waitFor(() => expect(mockedClear).toHaveBeenCalledTimes(1));
    expect(mockedSync).not.toHaveBeenCalled();
  });

  it('does not sync when background permission is refused', async () => {
    mockedPermission.mockResolvedValue(false);
    await renderHook(() => useGeofenceSync([g({ id: 'a' })], true));

    await waitFor(() => expect(mockedPermission).toHaveBeenCalled());
    await Promise.resolve();
    expect(mockedSync).not.toHaveBeenCalled();
  });

  it('re-checks permission after a refusal (not cached), and syncs once it is granted', async () => {
    mockedPermission.mockResolvedValueOnce(false).mockResolvedValue(true);
    const { rerender } = await renderHook(
      ({ items }: { items: Gifticon[] }) => useGeofenceSync(items, true),
      { initialProps: { items: [g({ id: 'a' })] } },
    );
    await waitFor(() => expect(mockedPermission).toHaveBeenCalledTimes(1));
    expect(mockedSync).not.toHaveBeenCalled();

    rerender({ items: [g({ id: 'a' }), g({ id: 'b' })] });
    await waitFor(() => expect(mockedSync).toHaveBeenCalledTimes(1));
    expect(mockedPermission).toHaveBeenCalledTimes(2);
  });

  it('does not re-check permission once granted', async () => {
    const { rerender } = await renderHook(
      ({ items }: { items: Gifticon[] }) => useGeofenceSync(items, true),
      { initialProps: { items: [g({ id: 'a' })] } },
    );
    await waitFor(() => expect(mockedSync).toHaveBeenCalledTimes(1));

    rerender({ items: [g({ id: 'a' }), g({ id: 'b' })] });
    await waitFor(() => expect(mockedSync).toHaveBeenCalledTimes(2));
    expect(mockedPermission).toHaveBeenCalledTimes(1);
  });

  it('coalesces overlapping permission checks into one prompt', async () => {
    let resolve!: (v: boolean) => void;
    mockedPermission.mockReturnValue(new Promise<boolean>((r) => (resolve = r)));

    const { rerender } = await renderHook(
      ({ items }: { items: Gifticon[] }) => useGeofenceSync(items, true),
      { initialProps: { items: [g({ id: 'a' })] } },
    );
    // Second located gifticon arrives while the disclosure is still pending.
    rerender({ items: [g({ id: 'a' }), g({ id: 'b' })] });
    await Promise.resolve();
    expect(mockedPermission).toHaveBeenCalledTimes(1);

    resolve(true);
    await waitFor(() => expect(mockedSync).toHaveBeenCalled());
    expect(mockedPermission).toHaveBeenCalledTimes(1);
  });

  it('re-syncs when the located set changes but not on an unrelated re-render', async () => {
    const { rerender } = await renderHook(
      ({ items }: { items: Gifticon[] }) => useGeofenceSync(items, true),
      { initialProps: { items: [g({ id: 'a' })] } },
    );
    await waitFor(() => expect(mockedSync).toHaveBeenCalledTimes(1));

    // Same ids/locations, new array reference → no re-sync.
    rerender({ items: [g({ id: 'a' })] });
    await Promise.resolve();
    expect(mockedSync).toHaveBeenCalledTimes(1);

    // A new located gifticon → re-sync.
    rerender({ items: [g({ id: 'a' }), g({ id: 'b' })] });
    await waitFor(() => expect(mockedSync).toHaveBeenCalledTimes(2));
  });
});
