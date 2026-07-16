export type GifticonCategory = 'cafe' | 'convenience' | 'restaurant' | 'culture' | 'etc';

export const CATEGORY_LABELS: Record<GifticonCategory, string> = {
  cafe: '카페',
  convenience: '편의점',
  restaurant: '음식점',
  culture: '문화/여가',
  etc: '기타',
};

export interface Gifticon {
  id: string;
  ownerId: string;
  name: string;
  brand: string;
  category: GifticonCategory;
  barcode?: string;
  amount?: number;
  imageUrl: string;
  expiresAt: string;
  isUsed: boolean;
  usedAt?: string;
  notificationIds?: string[];
  location?: { latitude: number; longitude: number };
  spaceId?: string;
  createdAt: string;
}

export type NewGifticon = Omit<
  Gifticon,
  'id' | 'ownerId' | 'createdAt' | 'isUsed' | 'usedAt' | 'notificationIds'
>;
