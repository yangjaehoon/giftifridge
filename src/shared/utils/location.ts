import * as Location from 'expo-location';
import { confirmAsync } from './confirmAsync';

export interface Coordinates {
  latitude: number;
  longitude: number;
}

export interface AddressCandidate {
  coordinates: Coordinates;
  label: string;
}

interface GetLocationOptions {
  /**
   * Reuse the last fix if it's younger than this many ms instead of hitting the
   * GPS again. Callers that need a precise, current reading (e.g. saving a
   * store's location) should omit it; proximity checks that run on every screen
   * focus should pass a few minutes.
   */
  maxAgeMs?: number;
}

let lastFix: { coords: Coordinates; at: number } | null = null;

/**
 * Checks/requests foreground location permission, returning whether it's
 * granted. Shared by getCurrentLocation and searchAddress — Android's native
 * geocoder refuses to run without this permission even though it isn't reading
 * GPS.
 */
async function ensureForegroundPermission(): Promise<boolean> {
  const current = await Location.getForegroundPermissionsAsync();
  if (current.status === 'granted') return true;
  if (!current.canAskAgain) return false;
  // Google Play's prominent-disclosure rule: before the OS permission dialog,
  // tell the user in-app what location is used for and that it never leaves the
  // device or runs in the background. Declining here skips the system prompt.
  const consented = await confirmAsync(
    '위치 접근 안내',
    '자주 가는 매장 근처에서 아직 쓰지 않은 기프티콘을 알려드리려고 기기의 위치를 사용해요. ' +
      '위치 정보는 이 기기 안에서만 쓰이고, 서버로 전송되거나 앱이 꺼진 동안 수집되지 않아요.',
    '계속',
  );
  if (!consented) return false;
  const requested = await Location.requestForegroundPermissionsAsync();
  return requested.status === 'granted';
}

/**
 * Checks/requests foreground location permission and returns the current
 * position, or null if permission isn't granted. Shared by AddGifticonScreen
 * (saving a gifticon's store location) and useNearbyGifticons (checking
 * proximity to saved locations) so the two don't silently drift on when to
 * re-prompt.
 */
export async function getCurrentLocation(
  options: GetLocationOptions = {},
): Promise<Coordinates | null> {
  const { maxAgeMs } = options;
  if (maxAgeMs != null && lastFix && Date.now() - lastFix.at <= maxAgeMs) {
    return lastFix.coords;
  }

  if (!(await ensureForegroundPermission())) return null;

  const position = await Location.getCurrentPositionAsync({
    accuracy: Location.Accuracy.Balanced,
  });
  const coords = { latitude: position.coords.latitude, longitude: position.coords.longitude };
  lastFix = { coords, at: Date.now() };
  return coords;
}

function formatAddress(address: Location.LocationGeocodedAddress): string {
  return (
    address.formattedAddress ??
    [address.name, address.street, address.city, address.region].filter(Boolean).join(' ')
  );
}

/**
 * Resolves a free-text address/place query to coordinate candidates with a
 * human-readable label, so the user can pick the right match instead of only
 * ever saving their current GPS fix. Returns null if location permission
 * isn't granted (required by Android's native geocoder even though this
 * doesn't read GPS), or [] if nothing matched.
 */
export async function searchAddress(query: string): Promise<AddressCandidate[] | null> {
  const trimmed = query.trim();
  if (!trimmed) return [];
  if (!(await ensureForegroundPermission())) return null;

  const matches = await Location.geocodeAsync(trimmed);
  return Promise.all(
    matches.map(async (match) => {
      const coordinates = { latitude: match.latitude, longitude: match.longitude };
      const [address] = await Location.reverseGeocodeAsync(coordinates);
      const label = address ? formatAddress(address) : '';
      return { coordinates, label: label || trimmed };
    }),
  );
}
