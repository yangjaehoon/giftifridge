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

// Set once the user dismisses the in-app disclosure below. An OS permission
// denial flips canAskAgain and rate-limits the system dialog, but a dismissed
// confirmAsync leaves the permission 'undetermined' — so without this latch
// useNearbyGifticons' focus effect would re-pop the disclosure on every return
// to the Home screen. Resets on app restart; an explicit retry from Settings
// still works because a granted status short-circuits before this check.
let disclosureDismissed = false;

// Same idea for the *background* permission, which Play treats as a separate,
// higher-risk grant with its own disclosure requirement. Latched so a declined
// disclosure isn't re-shown on every geofence sync.
let backgroundDisclosureDismissed = false;

/**
 * Checks/requests foreground location permission, returning whether it's
 * granted. Shared by getCurrentLocation and searchAddress — Android's native
 * geocoder refuses to run without this permission even though it isn't reading
 * GPS.
 */
async function ensureForegroundPermission(): Promise<boolean> {
  const current = await Location.getForegroundPermissionsAsync();
  if (current.status === 'granted') return true;
  if (!current.canAskAgain || disclosureDismissed) return false;
  // Google Play's prominent-disclosure rule: before the OS permission dialog,
  // spell out every way the app uses location. Both purposes below run through
  // this same gate, so the text has to cover the store-location case too — that
  // one *is* persisted to Firestore and shared with a space, unlike the nearby
  // check which stays on the device. Dismissing here skips the system prompt.
  const consented = await confirmAsync(
    '위치 접근 안내',
    '위치는 ①자주 가는 매장 근처에서 아직 안 쓴 기프티콘을 알려드릴 때와 ②기프티콘에 매장 ' +
      '위치를 저장하거나 매장을 검색할 때 사용해요. ①의 위치는 기기에서만 확인하고 저장하지 ' +
      '않아요. ②에서 저장한 좌표는 해당 기프티콘 정보와 함께 보관되고 스페이스 구성원에게 ' +
      '공유될 수 있어요. 앱을 열지 않은 동안에도 ①의 알림이 오게 하려면 다음 단계에서 ' +
      '백그라운드 위치 접근을 따로 허용할 수 있어요.',
    '계속',
  );
  if (!consented) {
    disclosureDismissed = true;
    return false;
  }
  const requested = await Location.requestForegroundPermissionsAsync();
  return requested.status === 'granted';
}

/**
 * Checks/requests *background* location permission, returning whether it's
 * granted. Needed for geofencing to keep working after the app is closed. The
 * foreground grant must already be in place (the OS won't show the background
 * dialog otherwise), and Play requires its own prominent disclosure — hence the
 * separate confirm before the request. Never re-pops after the user declines
 * (until app restart) via `backgroundDisclosureDismissed`.
 */
export async function ensureBackgroundLocationPermission(): Promise<boolean> {
  const fg = await Location.getForegroundPermissionsAsync();
  if (fg.status !== 'granted') return false;

  const current = await Location.getBackgroundPermissionsAsync();
  if (current.status === 'granted') return true;
  if (!current.canAskAgain || backgroundDisclosureDismissed) return false;

  const consented = await confirmAsync(
    '백그라운드 위치 접근 안내',
    '앱을 열지 않아도 자주 가는 매장 근처에 왔을 때 아직 안 쓴 기프티콘을 알려드리려면 ' +
      '백그라운드 위치 접근이 필요해요. 위치는 이 알림에만 쓰고 기기에서만 확인하며, ' +
      '서버로 보내거나 저장하지 않아요. 다음 화면에서 "항상 허용"을 선택해주세요.',
    '계속',
  );
  if (!consented) {
    backgroundDisclosureDismissed = true;
    return false;
  }
  const requested = await Location.requestBackgroundPermissionsAsync();
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
