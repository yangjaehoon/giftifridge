jest.mock('expo-location', () => ({
  getForegroundPermissionsAsync: jest.fn(),
  requestForegroundPermissionsAsync: jest.fn(),
  getCurrentPositionAsync: jest.fn(),
  geocodeAsync: jest.fn(),
  reverseGeocodeAsync: jest.fn(),
  Accuracy: { Balanced: 3 },
}));

function position(latitude: number, longitude: number) {
  return { coords: { latitude, longitude } };
}

type LocationMock = {
  getForegroundPermissionsAsync: jest.Mock;
  requestForegroundPermissionsAsync: jest.Mock;
  getCurrentPositionAsync: jest.Mock;
  geocodeAsync: jest.Mock;
  reverseGeocodeAsync: jest.Mock;
};

let Location: LocationMock;
let getCurrentLocation: typeof import('./location').getCurrentLocation;
let searchAddress: typeof import('./location').searchAddress;

beforeEach(() => {
  // Reset so location.ts's module-level `lastFix` cache starts empty each test;
  // require() (not import) is what picks up the freshly-registered modules.
  jest.resetModules();
  /* eslint-disable @typescript-eslint/no-require-imports */
  Location = require('expo-location');
  ({ getCurrentLocation, searchAddress } = require('./location'));
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
