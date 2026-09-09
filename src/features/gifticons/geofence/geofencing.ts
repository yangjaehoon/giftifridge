import * as Location from 'expo-location';
import type { Gifticon } from '../types';
import { GEOFENCE_TASK_NAME, saveGeofenceLabels, type GeofenceLabel } from './geofenceTask';

// Keeps the OS geofence registration in step with the user's located, unused
// gifticons. The headless crossing handler lives in geofenceTask.ts; this is
// the "which regions should be armed right now" half.

/** iOS monitors at most 20 regions per app and silently drops extras; stay
 *  under that. Android's limit is far higher but the same cap keeps behaviour
 *  identical across platforms. */
export const MAX_GEOFENCES = 18;

/** Metres. Big enough that a GPS fix near the store reliably falls inside,
 *  small enough that "near" still means near. */
export const GEOFENCE_RADIUS_M = 160;

type LocatedGifticon = Gifticon & { location: NonNullable<Gifticon['location']> };

function locatedUnused(items: Gifticon[]): LocatedGifticon[] {
  return items.filter((g): g is LocatedGifticon => !g.isUsed && g.location != null);
}

/** The regions we'd arm for this list — exported for tests and so the sync
 *  can diff without re-deriving. Newest gifticons win the cap. */
export function geofenceRegionsFor(items: Gifticon[]): Location.LocationRegion[] {
  return locatedUnused(items)
    .slice()
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
    .slice(0, MAX_GEOFENCES)
    .map((g) => ({
      identifier: g.id,
      latitude: g.location.latitude,
      longitude: g.location.longitude,
      radius: GEOFENCE_RADIUS_M,
      notifyOnEnter: true,
      notifyOnExit: false,
    }));
}

/**
 * Arms geofences for the current located/unused gifticons, or clears them all
 * when there are none. Caller must have background location permission — check
 * it first; without it startGeofencingAsync throws on Android. Best-effort:
 * failures are swallowed so a save flow never fails because geofencing didn't
 * take.
 */
export async function syncGeofences(items: Gifticon[]): Promise<void> {
  try {
    const regions = geofenceRegionsFor(items);
    const running = await Location.hasStartedGeofencingAsync(GEOFENCE_TASK_NAME);

    if (regions.length === 0) {
      if (running) await Location.stopGeofencingAsync(GEOFENCE_TASK_NAME);
      await saveGeofenceLabels({});
      return;
    }

    const labels: Record<string, GeofenceLabel> = {};
    for (const g of items) {
      if (regions.some((r) => r.identifier === g.id)) {
        labels[g.id] = { brand: g.brand, name: g.name };
      }
    }
    await saveGeofenceLabels(labels);

    // startGeofencingAsync replaces the previous set, so there's no separate
    // "update" path — just (re)start with the full list.
    await Location.startGeofencingAsync(GEOFENCE_TASK_NAME, regions);
  } catch {
    // geofencing is a nice-to-have; never let it break the caller
  }
}

/** Tears down all geofences (e.g. the user revoked background permission). */
export async function clearGeofences(): Promise<void> {
  try {
    if (await Location.hasStartedGeofencingAsync(GEOFENCE_TASK_NAME)) {
      await Location.stopGeofencingAsync(GEOFENCE_TASK_NAME);
    }
    await saveGeofenceLabels({});
  } catch {
    // already stopped / never started
  }
}
