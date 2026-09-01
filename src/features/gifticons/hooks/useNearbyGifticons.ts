import { useCallback, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import type { Gifticon } from '../types';
import { distanceInMeters } from '../../../shared/utils/geo';
import { getCurrentLocation } from '../../../shared/utils/location';

const NEARBY_RADIUS_METERS = 300;
const LOCATION_MAX_AGE_MS = 5 * 60 * 1000;

function isUnusedWithLocation(
  item: Gifticon,
): item is Gifticon & { location: NonNullable<Gifticon['location']> } {
  return !item.isUsed && item.location != null;
}

export function useNearbyGifticons(items: Gifticon[]) {
  const [nearby, setNearby] = useState<Gifticon[]>([]);

  const candidates = items.filter(isUnusedWithLocation);
  // Firestore's realtime snapshots hand back a fresh `items` array on every
  // write, which would otherwise re-run this (and re-hit the GPS) on every
  // snapshot. Key off the located set's contents so it only re-runs when that
  // actually changes.
  const candidatesKey = candidates
    .map((item) => `${item.id}:${item.location.latitude},${item.location.longitude}`)
    .sort()
    .join('|');

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;

      if (candidates.length === 0) {
        setNearby([]);
        return;
      }

      (async () => {
        try {
          const coords = await getCurrentLocation({ maxAgeMs: LOCATION_MAX_AGE_MS });
          if (cancelled) return;
          if (!coords) {
            setNearby([]);
            return;
          }

          setNearby(
            candidates.filter(
              (item) => distanceInMeters(coords, item.location) <= NEARBY_RADIUS_METERS,
            ),
          );
        } catch {
          if (!cancelled) setNearby([]);
        }
      })();

      return () => {
        cancelled = true;
      };
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [candidatesKey]),
  );

  return nearby;
}
