import {
  countByStatus,
  filterAndSortGifticons,
  isExpired,
  type ListCriteria,
} from './gifticonFilters';
import type { Gifticon } from './types';

function daysFromNow(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function g(overrides: Partial<Gifticon> & { id: string }): Gifticon {
  return {
    ownerId: 'u1',
    name: '아메리카노',
    brand: '스타벅스',
    category: 'cafe',
    imageUrl: 'https://x/y.jpg',
    expiresAt: daysFromNow(10),
    isUsed: false,
    createdAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

const criteria = (o: Partial<ListCriteria> = {}): ListCriteria => ({
  tab: 'active',
  category: 'all',
  query: '',
  sortKey: 'expiresAt',
  sortDir: 'asc',
  ...o,
});

const items: Gifticon[] = [
  g({ id: 'a1', name: '아메리카노', brand: '스타벅스', expiresAt: daysFromNow(10) }),
  g({ id: 'e1', name: '녹차', brand: '오설록', expiresAt: daysFromNow(-3) }),
  g({ id: 'u1', name: '라떼', brand: '이디야', isUsed: true }),
  g({
    id: 'a2',
    name: '기프트카드',
    brand: 'GS25',
    category: 'convenience',
    expiresAt: daysFromNow(2),
  }),
];

describe('isExpired', () => {
  it('is true only for a past calendar day', () => {
    expect(isExpired(g({ id: 'x', expiresAt: daysFromNow(-1) }))).toBe(true);
    expect(isExpired(g({ id: 'x', expiresAt: daysFromNow(0) }))).toBe(false);
  });
});

describe('countByStatus', () => {
  it('buckets by used / expired / active', () => {
    expect(countByStatus(items)).toEqual({ active: 2, expired: 1, used: 1 });
  });
});

describe('filterAndSortGifticons', () => {
  it('active tab: unused and not expired', () => {
    const out = filterAndSortGifticons(items, criteria({ tab: 'active' }));
    expect(out.map((x) => x.id)).toEqual(['a2', 'a1']); // sorted by expiresAt asc
  });

  it('expired tab: unused and past', () => {
    expect(filterAndSortGifticons(items, criteria({ tab: 'expired' })).map((x) => x.id)).toEqual([
      'e1',
    ]);
  });

  it('used tab: used regardless of expiry', () => {
    expect(filterAndSortGifticons(items, criteria({ tab: 'used' })).map((x) => x.id)).toEqual([
      'u1',
    ]);
  });

  it('category filter narrows within the tab', () => {
    const out = filterAndSortGifticons(items, criteria({ tab: 'active', category: 'convenience' }));
    expect(out.map((x) => x.id)).toEqual(['a2']);
  });

  it('query matches name or brand, case-insensitively', () => {
    expect(
      filterAndSortGifticons(items, criteria({ tab: 'active', query: 'gs25' })).map((x) => x.id),
    ).toEqual(['a2']);
  });

  it('sorts by name with Korean collation', () => {
    const out = filterAndSortGifticons(items, criteria({ tab: 'active', sortKey: 'name' }));
    expect(out.map((x) => x.name)).toEqual(['기프트카드', '아메리카노']);
  });

  it('sortDir desc reverses the order', () => {
    const asc = filterAndSortGifticons(items, criteria({ tab: 'active', sortKey: 'expiresAt' }));
    const desc = filterAndSortGifticons(
      items,
      criteria({ tab: 'active', sortKey: 'expiresAt', sortDir: 'desc' }),
    );
    expect(desc.map((x) => x.id)).toEqual([...asc.map((x) => x.id)].reverse());
  });

  it('does not mutate the input array', () => {
    const original = [...items];
    filterAndSortGifticons(items, criteria({ sortKey: 'name', sortDir: 'desc' }));
    expect(items).toEqual(original);
  });
});
