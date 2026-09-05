export type GifticonCategory = 'cafe' | 'convenience' | 'restaurant' | 'culture' | 'etc';

export const CATEGORY_LABELS: Record<GifticonCategory, string> = {
  cafe: '카페',
  convenience: '편의점',
  restaurant: '음식점',
  culture: '문화/여가',
  etc: '기타',
};

/**
 * One partial spend logged against an amount-based (금액권) gifticon.
 * `id` is a client-generated id pinned for the life of one add-record form
 * session (see GifticonUsagePanel) — like newGifticonId()/newSpaceId(), it's
 * what lets a retry after a timeout overwrite the same arrayUnion entry
 * instead of double-logging the spend.
 */
export interface UsageRecord {
  id: string;
  amount: number;
  /** Full ISO instant. */
  usedAt: string;
}

export interface Gifticon {
  id: string;
  ownerId: string;
  name: string;
  brand: string;
  category: GifticonCategory;
  barcode?: string;
  amount?: number;
  imageUrl: string;
  /** Calendar day, "YYYY-MM-DD" (see shared/utils/date). */
  expiresAt: string;
  isUsed: boolean;
  /** Full ISO instant. */
  usedAt?: string;
  /**
   * Partial spends against `amount`, most useful for a gift-card-style voucher
   * that gets used over several visits instead of all at once. See
   * ../usage.ts for how this and `isUsed` combine into a remaining balance.
   */
  usageHistory?: UsageRecord[];
  notificationIds?: string[];
  location?: { latitude: number; longitude: number };
  spaceId?: string;
  createdAt: string;
}

export type NewGifticon = Omit<
  Gifticon,
  'id' | 'ownerId' | 'createdAt' | 'isUsed' | 'usedAt' | 'notificationIds' | 'usageHistory'
>;
