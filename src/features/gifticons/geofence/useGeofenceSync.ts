import { useEffect, useMemo, useRef } from 'react';
import type { Gifticon } from '../domain/types';
import { ensureBackgroundLocationPermission } from '../../../shared/utils/location';
import { clearGeofences, syncGeofences } from './geofencing';

/**
 * Keeps OS geofences in step with the user's located, unused gifticons so the
 * "you're near a store" notification fires even with the app closed. Runs only
 * for the personal list (space gifticons aren't geofenced, same boundary as the
 * nearby banner and report).
 *
 * The first time there's a located gifticon to watch, it asks for background
 * location permission (with the Play-required disclosure). If that's declined
 * it stays quiet and never nags again this session; the in-app nearby banner
 * still works on foreground permission alone.
 */
export function useGeofenceSync(items: Gifticon[], enabled: boolean) {
  // Re-run only when the located/unused set actually changes, not on every
  // Firestore snapshot (which hands back a fresh array each time).
  const key = useMemo(() => {
    if (!enabled) return '';
    return items
      .filter((g) => !g.isUsed && g.location != null)
      .map((g) => `${g.id}:${g.location!.latitude},${g.location!.longitude}`)
      .sort()
      .join('|');
  }, [items, enabled]);

  // Once we've been granted background permission it stays granted for the
  // session — cache that so we don't re-check on every geofence sync. A *false*
  // result is not cached: it can be false only because the foreground grant
  // isn't in place yet, and re-calling ensureBackgroundLocationPermission is
  // cheap and self-guarding (it won't re-prompt once the disclosure has been
  // dismissed or the OS has locked further requests).
  const grantedRef = useRef(false);
  // A single in-flight permission check, shared by overlapping effect runs so a
  // second `key` change while the disclosure dialog is open can't stack a
  // second dialog / OS request.
  const pendingRef = useRef<Promise<boolean> | null>(null);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;

    (async () => {
      if (key === '') {
        await clearGeofences();
        return;
      }
      if (!grantedRef.current) {
        pendingRef.current ??= ensureBackgroundLocationPermission();
        let ok = false;
        try {
          ok = await pendingRef.current;
        } finally {
          pendingRef.current = null;
        }
        grantedRef.current = ok;
      }
      if (cancelled || !grantedRef.current) return;
      await syncGeofences(items);
    })();

    return () => {
      cancelled = true;
    };
    // `items` is intentionally omitted — `key` is its meaningful projection, and
    // syncGeofences re-reads the current list when it runs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, enabled]);
}
