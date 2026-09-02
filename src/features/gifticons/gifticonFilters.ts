import type { Gifticon, GifticonCategory } from './types';
import { CATEGORY_LABELS } from './types';
import { daysUntil } from '../../shared/utils/date';

export type FilterTab = 'active' | 'expired' | 'used';
export type CategoryFilter = GifticonCategory | 'all';
export type SortKey = 'name' | 'createdAt' | 'expiresAt';
export type SortDir = 'asc' | 'desc';

export interface ListCriteria {
  tab: FilterTab;
  category: CategoryFilter;
  query: string;
  sortKey: SortKey;
  sortDir: SortDir;
}

export const SORT_LABELS: Record<SortKey, string> = {
  name: '이름',
  createdAt: '등록일',
  expiresAt: '만료일',
};
export const SORT_KEYS = Object.keys(SORT_LABELS) as SortKey[];

export const EMPTY_TEXT: Record<FilterTab, string> = {
  active: '등록된 기프티콘이 없어요',
  expired: '만료된 기프티콘이 없어요',
  used: '사용완료된 기프티콘이 없어요',
};

export const CATEGORY_FILTERS: CategoryFilter[] = [
  'all',
  ...(Object.keys(CATEGORY_LABELS) as GifticonCategory[]),
];

export function isExpired(item: Gifticon): boolean {
  return daysUntil(item.expiresAt) < 0;
}

export function countByStatus(items: Gifticon[]): Record<FilterTab, number> {
  const counts: Record<FilterTab, number> = { active: 0, expired: 0, used: 0 };
  for (const item of items) {
    if (item.isUsed) counts.used += 1;
    else if (isExpired(item)) counts.expired += 1;
    else counts.active += 1;
  }
  return counts;
}

// Adding a sort key means adding one entry here — the sort itself stays closed.
// createdAt/expiresAt values sort lexically = chronologically (ISO / YYYY-MM-DD).
const byField =
  (get: (g: Gifticon) => string) =>
  (a: Gifticon, b: Gifticon): number => {
    const x = get(a);
    const y = get(b);
    return x < y ? -1 : x > y ? 1 : 0;
  };

const SORT_COMPARATORS: Record<SortKey, (a: Gifticon, b: Gifticon) => number> = {
  name: (a, b) => a.name.localeCompare(b.name, 'ko'),
  createdAt: byField((g) => g.createdAt),
  expiresAt: byField((g) => g.expiresAt),
};

function matchesTab(item: Gifticon, tab: FilterTab): boolean {
  if (tab === 'used') return item.isUsed;
  return !item.isUsed && isExpired(item) === (tab === 'expired');
}

export function filterAndSortGifticons(items: Gifticon[], c: ListCriteria): Gifticon[] {
  const q = c.query.trim().toLowerCase();
  const direction = c.sortDir === 'asc' ? 1 : -1;
  return items
    .filter((item) => matchesTab(item, c.tab))
    .filter((item) => c.category === 'all' || item.category === c.category)
    .filter(
      (item) =>
        q === '' || item.name.toLowerCase().includes(q) || item.brand.toLowerCase().includes(q),
    )
    .sort((a, b) => SORT_COMPARATORS[c.sortKey](a, b) * direction);
}
