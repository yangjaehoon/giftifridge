jest.mock('expo-location', () => ({
  getForegroundPermissionsAsync: jest.fn(),
  requestForegroundPermissionsAsync: jest.fn(),
  getBackgroundPermissionsAsync: jest.fn(),
  requestBackgroundPermissionsAsync: jest.fn(),
  getCurrentPositionAsync: jest.fn(),
  geocodeAsync: jest.fn(),
  reverseGeocodeAsync: jest.fn(),
  Accuracy: { Balanced: 3 },
}));
jest.mock('./confirmAsync', () => ({ confirmAsync: jest.fn() }));

function position(latitude: number, longitude: number) {
  return { coords: { latitude, longitude } };
}

type LocationMock = {
  getForegroundPermissionsAsync: jest.Mock;
  requestForegroundPermissionsAsync: jest.Mock;
  getBackgroundPermissionsAsync: jest.Mock;
  requestBackgroundPermissionsAsync: jest.Mock;
  getCurrentPositionAsync: jest.Mock;
  geocodeAsync: jest.Mock;
  reverseGeocodeAsync: jest.Mock;
};

let Location: LocationMock;
let confirmAsync: jest.Mock;
let getCurrentLocation: typeof import('./location').getCurrentLocation;
let searchAddress: typeof import('./location').searchAddress;
let ensureBackgroundLocationPermission: typeof import('./location').ensureBackgroundLocationPermission;

beforeEach(() => {
  // Reset so location.ts's module-level `lastFix` cache starts empty each test;
  // require() (not import) is what picks up the freshly-registered modules.
  jest.resetModules();
  /* eslint-disable @typescript-eslint/no-require-imports */
  Location = require('expo-location');
  ({ confirmAsync } = require('./confirmAsync'));
  ({
    getCurrentLocation,
    searchAddress,
    ensureBackgroundLocationPermission,
  } = require('./location'));
  /* eslint-enable @typescript-eslint/no-require-imports */
  // The prominent-disclosure prompt only shows when permission isn't granted yet;
  // default it to "accepted" so the existing request-path tests are unaffected.
  confirmAsync.mockResolvedValue(true);
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
    expect(confirmAsync).toHaveBeenCalledTimes(1);
    expect(Location.requestForegroundPermissionsAsync).toHaveBeenCalledTimes(1);
  });

  it('shows the prominent disclosure before the OS prompt and aborts if declined', async () => {
    Location.getForegroundPermissionsAsync.mockResolvedValue({
      status: 'undetermined',
      canAskAgain: true,
    });
    confirmAsync.mockResolvedValue(false);

    await expect(getCurrentLocation()).resolves.toBeNull();
    expect(Location.requestForegroundPermissionsAsync).not.toHaveBeenCalled();
    expect(Location.getCurrentPositionAsync).not.toHaveBeenCalled();
  });

  it('does not re-show the disclosure after the user dismisses it once', async () => {
    Location.getForegroundPermissionsAsync.mockResolvedValue({
      status: 'undetermined',
      canAskAgain: true,
    });
    confirmAsync.mockResolvedValue(false);

    await expect(getCurrentLocation()).resolves.toBeNull();
    await expect(getCurrentLocation()).resolves.toBeNull();

    expect(confirmAsync).toHaveBeenCalledTimes(1);
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

describe('searchAddress', () => {
  it('returns [] without geocoding for a blank query', async () => {
    await expect(searchAddress('   ')).resolves.toEqual([]);
    expect(Location.getForegroundPermissionsAsync).not.toHaveBeenCalled();
  });

  it('returns null when permission is denied and cannot be asked again', async () => {
    Location.getForegroundPermissionsAsync.mockResolvedValue({
      status: 'denied',
      canAskAgain: false,
    });

    await expect(searchAddress('스타벅스 강남점')).resolves.toBeNull();
    expect(Location.geocodeAsync).not.toHaveBeenCalled();
  });

  it('pairs each geocoded match with its reverse-geocoded label', async () => {
    Location.getForegroundPermissionsAsync.mockResolvedValue({
      status: 'granted',
      canAskAgain: false,
    });
    Location.geocodeAsync.mockResolvedValue([{ latitude: 37.5, longitude: 127 }]);
    Location.reverseGeocodeAsync.mockResolvedValue([
      { formattedAddress: '서울 강남구 테헤란로 1' },
    ]);

    await expect(searchAddress('스타벅스 강남점')).resolves.toEqual([
      { coordinates: { latitude: 37.5, longitude: 127 }, label: '서울 강남구 테헤란로 1' },
    ]);
  });

  it('falls back to the query text when reverse geocoding finds no address', async () => {
    Location.getForegroundPermissionsAsync.mockResolvedValue({
      status: 'granted',
      canAskAgain: false,
    });
    Location.geocodeAsync.mockResolvedValue([{ latitude: 37.5, longitude: 127 }]);
    Location.reverseGeocodeAsync.mockResolvedValue([]);

    await expect(searchAddress('스타벅스 강남점')).resolves.toEqual([
      { coordinates: { latitude: 37.5, longitude: 127 }, label: '스타벅스 강남점' },
    ]);
  });

  it('composes a label from address parts when formattedAddress is unavailable (iOS)', async () => {
    Location.getForegroundPermissionsAsync.mockResolvedValue({
      status: 'granted',
      canAskAgain: false,
    });
    Location.geocodeAsync.mockResolvedValue([{ latitude: 37.5, longitude: 127 }]);
    Location.reverseGeocodeAsync.mockResolvedValue([
      {
        formattedAddress: null,
        name: '스타벅스 강남점',
        street: '테헤란로',
        city: '서울',
        region: null,
      },
    ]);

    await expect(searchAddress('스타벅스 강남점')).resolves.toEqual([
      {
        coordinates: { latitude: 37.5, longitude: 127 },
        label: '스타벅스 강남점 테헤란로 서울',
      },
    ]);
  });

  it('falls back to the query text when the address has no usable fields', async () => {
    Location.getForegroundPermissionsAsync.mockResolvedValue({
      status: 'granted',
      canAskAgain: false,
    });
    Location.geocodeAsync.mockResolvedValue([{ latitude: 37.5, longitude: 127 }]);
    Location.reverseGeocodeAsync.mockResolvedValue([
      { formattedAddress: null, name: null, street: null, city: null, region: null },
    ]);

    await expect(searchAddress('스타벅스 강남점')).resolves.toEqual([
      { coordinates: { latitude: 37.5, longitude: 127 }, label: '스타벅스 강남점' },
    ]);
  });
});

describe('ensureBackgroundLocationPermission', () => {
  it('is false when foreground permission is not granted (OS never shows the dialog)', async () => {
    Location.getForegroundPermissionsAsync.mockResolvedValue({ status: 'denied' });

    await expect(ensureBackgroundLocationPermission()).resolves.toBe(false);
    expect(Location.getBackgroundPermissionsAsync).not.toHaveBeenCalled();
  });

  it('returns true without prompting when background is already granted', async () => {
    Location.getForegroundPermissionsAsync.mockResolvedValue({ status: 'granted' });
    Location.getBackgroundPermissionsAsync.mockResolvedValue({ status: 'granted' });

    await expect(ensureBackgroundLocationPermission()).resolves.toBe(true);
    expect(confirmAsync).not.toHaveBeenCalled();
  });

  it('shows the disclosure then requests, and reports the grant', async () => {
    Location.getForegroundPermissionsAsync.mockResolvedValue({ status: 'granted' });
    Location.getBackgroundPermissionsAsync.mockResolvedValue({
      status: 'denied',
      canAskAgain: true,
    });
    Location.requestBackgroundPermissionsAsync.mockResolvedValue({ status: 'granted' });

    await expect(ensureBackgroundLocationPermission()).resolves.toBe(true);
    expect(confirmAsync).toHaveBeenCalled();
    expect(Location.requestBackgroundPermissionsAsync).toHaveBeenCalled();
  });

  it('does not re-prompt after the user dismisses the disclosure', async () => {
    Location.getForegroundPermissionsAsync.mockResolvedValue({ status: 'granted' });
    Location.getBackgroundPermissionsAsync.mockResolvedValue({
      status: 'denied',
      canAskAgain: true,
    });
    confirmAsync.mockResolvedValue(false);

    await expect(ensureBackgroundLocationPermission()).resolves.toBe(false);
    await expect(ensureBackgroundLocationPermission()).resolves.toBe(false);
    expect(confirmAsync).toHaveBeenCalledTimes(1);
    expect(Location.requestBackgroundPermissionsAsync).not.toHaveBeenCalled();
  });

  it('is false when the OS has locked further requests', async () => {
    Location.getForegroundPermissionsAsync.mockResolvedValue({ status: 'granted' });
    Location.getBackgroundPermissionsAsync.mockResolvedValue({
      status: 'denied',
      canAskAgain: false,
    });

    await expect(ensureBackgroundLocationPermission()).resolves.toBe(false);
    expect(confirmAsync).not.toHaveBeenCalled();
  });
});
