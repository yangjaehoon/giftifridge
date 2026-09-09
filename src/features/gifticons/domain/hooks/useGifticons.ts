import { useFirestoreList } from '../../../../shared/hooks/useFirestoreList';
import { subscribeToGifticons } from '../services/gifticonService';
import { gifticonListCache } from '../services/gifticonCache';
import type { Gifticon } from '../types';

const OWNER_CACHE = gifticonListCache('owner');

export function useGifticons(ownerId: string | undefined) {
  return useFirestoreList<Gifticon>(ownerId, subscribeToGifticons, OWNER_CACHE);
}
