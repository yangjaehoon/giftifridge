import { useEffect, useState } from 'react';
import { subscribeToGifticons } from '../services/gifticonService';
import type { Gifticon } from '../types';

export function useGifticons(ownerId: string | undefined) {
  const [items, setItems] = useState<Gifticon[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!ownerId) return;
    const unsubscribe = subscribeToGifticons(
      ownerId,
      (next) => {
        setItems(next);
        setLoading(false);
      },
      (err) => {
        setError(err);
        setLoading(false);
      },
    );
    return unsubscribe;
  }, [ownerId]);

  return {
    items: ownerId ? items : [],
    loading: ownerId ? loading : false,
    error,
  };
}
