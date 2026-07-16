import * as Location from 'expo-location';

export interface Coordinates {
  latitude: number;
  longitude: number;
}

/**
 * Checks/requests foreground location permission and returns the current
 * position, or null if permission isn't granted. Shared by AddGifticonScreen
 * (saving a gifticon's store location) and useNearbyGifticons (checking
 * proximity to saved locations) so the two don't silently drift on when to
 * re-prompt.
 */
export async function getCurrentLocation(): Promise<Coordinates | null> {
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
  return { latitude: position.coords.latitude, longitude: position.coords.longitude };
}
