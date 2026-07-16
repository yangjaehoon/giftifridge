import { useEffect, useState } from 'react';
import { subscribeToSpaceGifticons } from '../services/gifticonService';
import type { Gifticon } from '../types';

export function useSpaceGifticons(spaceId: string | undefined) {
  const [items, setItems] = useState<Gifticon[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    if (!spaceId) return;
    const unsubscribe = subscribeToSpaceGifticons(
      spaceId,
      (next) => {
        setItems(next);
        setLoading(false);
        setRefreshing(false);
        setError(null);
      },
      (err) => {
        setError(err);
        setLoading(false);
        setRefreshing(false);
      },
    );
    return unsubscribe;
  }, [spaceId, refreshKey]);

  return {
    items: spaceId ? items : [],
    loading: spaceId ? loading : false,
    refreshing,
    error,
    refresh: () => {
      setRefreshing(true);
      setRefreshKey((k) => k + 1);
    },
  };
}
