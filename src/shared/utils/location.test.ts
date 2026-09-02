jest.mock('expo-location', () => ({
  getForegroundPermissionsAsync: jest.fn(),
  requestForegroundPermissionsAsync: jest.fn(),
  getCurrentPositionAsync: jest.fn(),
  Accuracy: { Balanced: 3 },
}));

function position(latitude: number, longitude: number) {
  return { coords: { latitude, longitude } };
}

type LocationMock = {
  getForegroundPermissionsAsync: jest.Mock;
  requestForegroundPermissionsAsync: jest.Mock;
  getCurrentPositionAsync: jest.Mock;
};

let Location: LocationMock;
let getCurrentLocation: typeof import('./location').getCurrentLocation;

beforeEach(() => {
  // Reset so location.ts's module-level `lastFix` cache starts empty each test;
  // require() (not import) is what picks up the freshly-registered modules.
  jest.resetModules();
  /* eslint-disable @typescript-eslint/no-require-imports */
  Location = require('expo-location');
  ({ getCurrentLocation } = require('./location'));
  /* eslint-enable @typescript-eslint/no-require-imports */
});

describe('getCurrentLocation', () => {
  it('returns the current position when permission is already granted', async () => {
    Location.getForegroundPermissionsAsync.mockResolvedValue({
      status: 'granted',
      canAskAgain: false,
    });
    Location.getCurrentPositionAsync.mockResolvedValue(position(37.5, 127.0));

    await expect(getCurrentLocation()).resolves.toEqual({ latitude: 37.5, longitude: 127.0 });
    expect(Location.requestForegroundPermissionsAsync).not.toHaveBeenCalled();
  });

  it('requests permission when not yet granted but still askable', async () => {
    Location.getForegroundPermissionsAsync.mockResolvedValue({
      status: 'undetermined',
      canAskAgain: true,
    });
    Location.requestForegroundPermissionsAsync.mockResolvedValue({ status: 'granted' });
    Location.getCurrentPositionAsync.mockResolvedValue(position(1, 2));

    await expect(getCurrentLocation()).resolves.toEqual({ latitude: 1, longitude: 2 });
    expect(Location.requestForegroundPermissionsAsync).toHaveBeenCalledTimes(1);
  });

  it('returns null when permission is denied and cannot be asked again', async () => {
    Location.getForegroundPermissionsAsync.mockResolvedValue({
      status: 'denied',
      canAskAgain: false,
    });

    await expect(getCurrentLocation()).resolves.toBeNull();
    expect(Location.getCurrentPositionAsync).not.toHaveBeenCalled();
  });

  it('returns null when the permission request is rejected', async () => {
    Location.getForegroundPermissionsAsync.mockResolvedValue({
      status: 'undetermined',
      canAskAgain: true,
    });
    Location.requestForegroundPermissionsAsync.mockResolvedValue({ status: 'denied' });

    await expect(getCurrentLocation()).resolves.toBeNull();
    expect(Location.getCurrentPositionAsync).not.toHaveBeenCalled();
  });

  it('reuses the last fix when it is younger than maxAgeMs instead of hitting GPS again', async () => {
    Location.getForegroundPermissionsAsync.mockResolvedValue({
      status: 'granted',
      canAskAgain: false,
    });
    Location.getCurrentPositionAsync.mockResolvedValue(position(10, 20));

    await getCurrentLocation();
    await getCurrentLocation({ maxAgeMs: 60_000 });

    expect(Location.getCurrentPositionAsync).toHaveBeenCalledTimes(1);
  });

  it('re-reads GPS when the cached fix is older than maxAgeMs', async () => {
    Location.getForegroundPermissionsAsync.mockResolvedValue({
      status: 'granted',
      canAskAgain: false,
    });
    Location.getCurrentPositionAsync.mockResolvedValue(position(10, 20));

    const nowSpy = jest.spyOn(Date, 'now').mockReturnValue(0);
    await getCurrentLocation({ maxAgeMs: 1000 });

    nowSpy.mockReturnValue(5000);
    await getCurrentLocation({ maxAgeMs: 1000 });

    expect(Location.getCurrentPositionAsync).toHaveBeenCalledTimes(2);
    nowSpy.mockRestore();
  });
});
