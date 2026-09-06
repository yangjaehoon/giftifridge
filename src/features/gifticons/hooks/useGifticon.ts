import { useEffect, useState } from 'react';
import { useFirestoreDoc } from '../../../shared/hooks/useFirestoreDoc';
import { subscribeToGifticon } from '../services/gifticonService';
import { readCachedGifticon } from '../services/gifticonCache';
import type { Gifticon } from '../types';

export function useGifticon(id: string | undefined) {
  const { data, loading, error, refresh } = useFirestoreDoc<Gifticon>(id, subscribeToGifticon);
  const [cached, setCached] = useState<Gifticon | null>(null);
  const [prevId, setPrevId] = useState(id);

  // Drop a previous id's cached copy synchronously so it never flashes on the
  // next gifticon's screen (mirrors useFirestoreDoc's own key-change reset).
  if (id !== prevId) {
    setPrevId(id);
    setCached(null);
  }

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    readCachedGifticon(id).then((g) => {
      if (!cancelled) setCached(g);
    });
    return () => {
      cancelled = true;
    };
  }, [id]);

  // Live data always wins. The cached copy (mirrored from the list) fills the
  // gap on a cold offline start or a listener error, so the barcode is still
  // there — but only until the live listener gives a definitive answer: once
  // it confirms the doc is gone, the stale cache is dropped.
  const settled = !loading && !error;
  const gifticon = data ?? (settled ? null : cached);

  return {
    gifticon,
    loading: loading && !cached,
    error: gifticon ? null : error,
    refresh,
  };
}
