import { useFirestoreList } from '../../../shared/hooks/useFirestoreList';
import { subscribeToSpaceGifticons } from '../services/gifticonService';
import { gifticonListCache } from '../services/gifticonCache';
import type { Gifticon } from '../types';

const SPACE_CACHE = gifticonListCache('space');

export function useSpaceGifticons(spaceId: string | undefined) {
  return useFirestoreList<Gifticon>(spaceId, subscribeToSpaceGifticons, SPACE_CACHE);
}
