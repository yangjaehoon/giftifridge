import { useFirestoreList } from '../../../shared/hooks/useFirestoreList';
import { subscribeToSpaceGifticons } from '../services/gifticonService';
import type { Gifticon } from '../types';

export function useSpaceGifticons(spaceId: string | undefined) {
  return useFirestoreList<Gifticon>(spaceId, subscribeToSpaceGifticons);
}
