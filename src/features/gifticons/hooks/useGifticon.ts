import { useEffect, useState } from 'react';
import { subscribeToGifticon } from '../services/gifticonService';
import type { Gifticon } from '../types';

export function useGifticon(id: string | undefined) {
  const [gifticon, setGifticon] = useState<Gifticon | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [prevId, setPrevId] = useState(id);

  // Reset to a clean loading state when the id changes, so the screen doesn't
  // flash the previous gifticon (or a stale "not found") until the new
  // subscription's first snapshot lands.
  if (id !== prevId) {
    setPrevId(id);
    setGifticon(null);
    setLoading(Boolean(id));
    setError(null);
  }

  useEffect(() => {
    if (!id) return;
    const unsubscribe = subscribeToGifticon(
      id,
      (next) => {
        setGifticon(next);
        setLoading(false);
        setError(null);
      },
      (err) => {
        setError(err);
        setLoading(false);
      },
    );
    return unsubscribe;
  }, [id, refreshKey]);

  return {
    gifticon: id ? gifticon : null,
    loading: id ? loading : false,
    error,
    refresh: () => setRefreshKey((k) => k + 1),
  };
}
