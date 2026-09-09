import { act, renderHook } from '@testing-library/react-native';
import { useGifticonListView } from './useGifticonListView';
import type { Gifticon } from '../types';

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

const items: Gifticon[] = [
  g({ id: 'a1', expiresAt: daysFromNow(10) }),
  g({ id: 'e1', name: '녹차', expiresAt: daysFromNow(-2) }),
  g({ id: 'u1', name: '라떼', isUsed: true }),
];

describe('useGifticonListView', () => {
  it('defaults to the active tab, expiresAt asc, and exposes counts', async () => {
    const { result } = await renderHook(() => useGifticonListView(items));

    expect(result.current.tab).toBe('active');
    expect(result.current.sortKey).toBe('expiresAt');
    expect(result.current.sortDir).toBe('asc');
    expect(result.current.counts).toEqual({ active: 1, expired: 1, used: 1 });
    expect(result.current.visible.map((x) => x.id)).toEqual(['a1']);
  });

  it('switching the tab re-derives the visible list', async () => {
    const { result } = await renderHook(() => useGifticonListView(items));

    await act(async () => result.current.setTab('expired'));
    expect(result.current.visible.map((x) => x.id)).toEqual(['e1']);
  });

  it('setQuery flips isSearching and filters', async () => {
    const { result } = await renderHook(() => useGifticonListView(items));

    await act(async () => result.current.setQuery('  녹  '));
    expect(result.current.isSearching).toBe(true);

    await act(async () => result.current.setTab('expired'));
    expect(result.current.visible.map((x) => x.id)).toEqual(['e1']);
  });

  it('toggleSortDir flips asc/desc', async () => {
    const { result } = await renderHook(() => useGifticonListView(items));

    await act(async () => result.current.toggleSortDir());
    expect(result.current.sortDir).toBe('desc');
    await act(async () => result.current.toggleSortDir());
    expect(result.current.sortDir).toBe('asc');
  });
});
