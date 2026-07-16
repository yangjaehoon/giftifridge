import { createGifticon, markGifticonUsed } from './gifticonService';
import type { NewGifticon } from '../types';

function daysFromNow(days: number) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString();
}

const DUMMY_GIFTICONS: (NewGifticon & { used?: boolean })[] = [
  {
    name: '아메리카노 Tall',
    brand: '스타벅스',
    category: 'cafe',
    amount: 5000,
    imageUrl: 'https://picsum.photos/seed/starbucks/200',
    expiresAt: daysFromNow(20),
  },
  {
    name: '모바일 상품권 1만원',
    brand: 'GS25',
    category: 'convenience',
    amount: 10000,
    imageUrl: 'https://picsum.photos/seed/gs25/200',
    expiresAt: daysFromNow(2),
  },
  {
    name: '허니콤보',
    brand: '교촌치킨',
    category: 'restaurant',
    amount: 20000,
    imageUrl: 'https://picsum.photos/seed/kyochon/200',
    expiresAt: daysFromNow(-3),
  },
  {
    name: '영화관람권',
    brand: 'CGV',
    category: 'culture',
    imageUrl: 'https://picsum.photos/seed/cgv/200',
    expiresAt: daysFromNow(45),
  },
  {
    name: '문화상품권 5만원',
    brand: '이마트',
    category: 'etc',
    amount: 50000,
    imageUrl: 'https://picsum.photos/seed/emart/200',
    expiresAt: daysFromNow(-10),
    used: true,
  },
];

export async function seedDummyGifticons(ownerId: string) {
  for (const { used, ...data } of DUMMY_GIFTICONS) {
    const id = await createGifticon(ownerId, data);
    if (used) {
      await markGifticonUsed(id, true);
    }
  }
}
