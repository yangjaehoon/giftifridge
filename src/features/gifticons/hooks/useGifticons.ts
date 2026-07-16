import { useFirestoreList } from '../../../shared/hooks/useFirestoreList';
import { subscribeToGifticons } from '../services/gifticonService';
import type { Gifticon } from '../types';

export function useGifticons(ownerId: string | undefined) {
  return useFirestoreList<Gifticon>(ownerId, subscribeToGifticons);
}
