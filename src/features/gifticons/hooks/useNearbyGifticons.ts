import { useCallback, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import * as Location from 'expo-location';
import type { Gifticon } from '../types';
import { distanceInMeters } from '../../../shared/utils/geo';

const NEARBY_RADIUS_METERS = 300;

export function useNearbyGifticons(items: Gifticon[]) {
  const [nearby, setNearby] = useState<Gifticon[]>([]);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;

      (async () => {
        const candidates = items.filter((item) => !item.isUsed && item.location);
        if (candidates.length === 0) {
          if (!cancelled) setNearby([]);
          return;
        }

        const current = await Location.getForegroundPermissionsAsync();
        let granted = current.status === 'granted';
        if (!granted && current.canAskAgain) {
          const requested = await Location.requestForegroundPermissionsAsync();
          granted = requested.status === 'granted';
        }
        if (!granted) {
          if (!cancelled) setNearby([]);
          return;
        }

        try {
          const position = await Location.getCurrentPositionAsync({
            accuracy: Location.Accuracy.Balanced,
          });
          const near = candidates.filter(
            (item) => distanceInMeters(position.coords, item.location!) <= NEARBY_RADIUS_METERS,
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
