import * as TaskManager from 'expo-task-manager';
import * as Location from 'expo-location';
import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';

// TaskManager requires defineTask to run in the JS bundle's global scope (not
// inside a component), so this module is imported once at the top of index.ts —
// before registerRootComponent — so the task is defined on every launch,
// including a headless one the OS wakes to deliver a geofence crossing.

export const GEOFENCE_TASK_NAME = 'gifticon-store-geofence';

// The geofence region identifier is just the gifticon id; the headless task has
// no other way to know the brand/name for the notification text, so syncGeofences
// writes this id → label map alongside registering the regions.
const LABELS_KEY = 'geofenceLabels';

export interface GeofenceLabel {
  brand: string;
  name: string;
}

export async function saveGeofenceLabels(labels: Record<string, GeofenceLabel>): Promise<void> {
  await AsyncStorage.setItem(LABELS_KEY, JSON.stringify(labels));
}

export async function readGeofenceLabels(): Promise<Record<string, GeofenceLabel>> {
  try {
    const raw = await AsyncStorage.getItem(LABELS_KEY);
    const parsed = raw ? JSON.parse(raw) : null;
    return parsed && typeof parsed === 'object' ? (parsed as Record<string, GeofenceLabel>) : {};
  } catch {
    return {};
  }
}

/**
 * Fires the "you're near a store you have a gifticon for" notification for one
 * geofence crossing. Exported (and kept free of the TaskManager wrapper) so it
 * can be unit-tested without the native task runtime.
 */
export async function handleGeofenceEnter(regionIdentifier: string): Promise<void> {
  const labels = await readGeofenceLabels();
  const label = labels[regionIdentifier];
  if (!label) return;

  await Notifications.scheduleNotificationAsync({
    content: {
      title: '근처에 쓸 수 있는 기프티콘이 있어요',
      body: `${label.brand} ${label.name} — 지금 이 근처 매장에서 쓸 수 있어요.`,
      data: { gifticonId: regionIdentifier },
    },
    trigger: null,
  });
}

TaskManager.defineTask(GEOFENCE_TASK_NAME, async ({ data, error }) => {
  if (error) return;
  const { eventType, region } = (data ?? {}) as {
    eventType?: Location.GeofencingEventType;
    region?: Location.LocationRegion;
  };
  if (eventType !== Location.GeofencingEventType.Enter || !region?.identifier) return;
  try {
    await handleGeofenceEnter(region.identifier);
  } catch {
    // A missed notification isn't worth crashing a headless task over.
  }
});
