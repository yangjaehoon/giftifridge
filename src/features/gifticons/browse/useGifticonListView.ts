import { useMemo, useState } from 'react';
import type { Gifticon } from '../types';
import {
  countByStatus,
  filterAndSortGifticons,
  type CategoryFilter,
  type FilterTab,
  type SortDir,
  type SortKey,
} from '../gifticonFilters';

/**
 * Owns the Home list's view state (tab / category / search / sort) and derives
 * the visible + counted lists. Keeps HomeScreen to layout only, and makes the
 * filter/sort behaviour testable without rendering a screen.
 */
export function useGifticonListView(items: Gifticon[]) {
  const [tab, setTab] = useState<FilterTab>('active');
  const [category, setCategory] = useState<CategoryFilter>('all');
  const [query, setQuery] = useState('');
  // Default matches the query's own orderBy('expiresAt','asc'), so the initial
  // order is unchanged until the user picks something else.
  const [sortKey, setSortKey] = useState<SortKey>('expiresAt');
  const [sortDir, setSortDir] = useState<SortDir>('asc');

  const counts = useMemo(() => countByStatus(items), [items]);
  const visible = useMemo(
    () => filterAndSortGifticons(items, { tab, category, query, sortKey, sortDir }),
    [items, tab, category, query, sortKey, sortDir],
  );

  return {
    visible,
    counts,
    tab,
    setTab,
    category,
    setCategory,
    query,
    setQuery,
    sortKey,
    setSortKey,
    sortDir,
    toggleSortDir: () => setSortDir((d) => (d === 'asc' ? 'desc' : 'asc')),
    isSearching: query.trim().length > 0,
  };
}
