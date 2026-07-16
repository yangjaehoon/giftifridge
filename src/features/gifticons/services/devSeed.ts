import { createGifticon, markGifticonUsed } from './gifticonService';
import type { GifticonCategory, NewGifticon } from '../types';

function daysFromNow(days: number) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString();
}

const TEMPLATES: {
  name: string;
  brand: string;
  category: GifticonCategory;
  amount?: number;
  seed: string;
}[] = [
  { name: '아메리카노 Tall', brand: '스타벅스', category: 'cafe', amount: 5000, seed: 'starbucks' },
  { name: '카페라떼', brand: '이디야', category: 'cafe', amount: 4500, seed: 'ediya' },
  {
    name: '모바일 상품권 1만원',
    brand: 'GS25',
    category: 'convenience',
    amount: 10000,
    seed: 'gs25',
  },
  { name: '모바일 상품권 3만원', brand: 'CU', category: 'convenience', amount: 30000, seed: 'cu' },
  { name: '허니콤보', brand: '교촌치킨', category: 'restaurant', amount: 20000, seed: 'kyochon' },
  { name: '스테이크 세트', brand: 'VIPS', category: 'restaurant', amount: 35000, seed: 'vips' },
  { name: '영화관람권', brand: 'CGV', category: 'culture', seed: 'cgv' },
  { name: '영화관람권', brand: '메가박스', category: 'culture', seed: 'megabox' },
  { name: '문화상품권 5만원', brand: '이마트', category: 'etc', amount: 50000, seed: 'emart' },
  { name: '베이커리 세트', brand: '파리바게뜨', category: 'etc', amount: 15000, seed: 'paris' },
];

export const DUMMY_GIFTICON_COUNT = 100;

function buildDummyGifticons(): (NewGifticon & { used?: boolean })[] {
  return Array.from({ length: DUMMY_GIFTICON_COUNT }, (_, i) => {
    const template = TEMPLATES[i % TEMPLATES.length];
    const expiresInDays = ((i * 7) % 60) - 15;
    return {
      name: template.name,
      brand: template.brand,
      category: template.category,
      amount: template.amount,
      imageUrl: `https://picsum.photos/seed/${template.seed}-${i}/200`,
      expiresAt: daysFromNow(expiresInDays),
      used: i % 5 === 0,
    };
  });
}

export async function seedDummyGifticons(
  ownerId: string,
): Promise<{ succeeded: number; failed: number }> {
  const results = await Promise.allSettled(
    buildDummyGifticons().map(async ({ used, ...data }) => {
      const id = await createGifticon(ownerId, data);
      if (used) {
        await markGifticonUsed(id, true);
      }
    }),
  );
  const succeeded = results.filter((r) => r.status === 'fulfilled').length;
  return { succeeded, failed: results.length - succeeded };
}
