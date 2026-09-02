import { useFirestoreDoc } from '../../../shared/hooks/useFirestoreDoc';
import { subscribeToGifticon } from '../services/gifticonService';
import type { Gifticon } from '../types';

export function useGifticon(id: string | undefined) {
  const { data, loading, error, refresh } = useFirestoreDoc<Gifticon>(id, subscribeToGifticon);
  return { gifticon: data, loading, error, refresh };
}
