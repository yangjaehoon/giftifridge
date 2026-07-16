import { useCallback, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import type { Gifticon } from '../types';
import { distanceInMeters } from '../../../shared/utils/geo';
import { getCurrentLocation } from '../../../shared/utils/location';

const NEARBY_RADIUS_METERS = 300;

function isUnusedWithLocation(
  item: Gifticon,
): item is Gifticon & { location: NonNullable<Gifticon['location']> } {
  return !item.isUsed && item.location != null;
}

export function useNearbyGifticons(items: Gifticon[]) {
  const [nearby, setNearby] = useState<Gifticon[]>([]);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;

      (async () => {
        const candidates = items.filter(isUnusedWithLocation);
        if (candidates.length === 0) {
          if (!cancelled) setNearby([]);
          return;
        }

        try {
          const coords = await getCurrentLocation();
          if (!coords) {
            if (!cancelled) setNearby([]);
            return;
          }

          const near = candidates.filter(
            (item) => distanceInMeters(coords, item.location) <= NEARBY_RADIUS_METERS,
          );
          if (!cancelled) setNearby(near);
        } catch {
          if (!cancelled) setNearby([]);
        }
      })();

      return () => {
        cancelled = true;
      };
    }, [items]),
  );

  return nearby;
}
