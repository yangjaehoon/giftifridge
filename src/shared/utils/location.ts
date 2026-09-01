import * as Location from 'expo-location';

export interface Coordinates {
  latitude: number;
  longitude: number;
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

  const current = await Location.getForegroundPermissionsAsync();
  let granted = current.status === 'granted';
  if (!granted && current.canAskAgain) {
    const requested = await Location.requestForegroundPermissionsAsync();
    granted = requested.status === 'granted';
  }
  if (!granted) return null;

  const position = await Location.getCurrentPositionAsync({
    accuracy: Location.Accuracy.Balanced,
  });
  const coords = { latitude: position.coords.latitude, longitude: position.coords.longitude };
  lastFix = { coords, at: Date.now() };
  return coords;
}
