import { buildSpendingReport } from './gifticonReport';
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
    expiresAt: daysFromNow(30),
    isUsed: false,
    createdAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

describe('buildSpendingReport', () => {
  it('is all zeros for an empty collection', () => {
    expect(buildSpendingReport([])).toEqual({
      holdingCount: 0,
      holdingValue: 0,
      usedCount: 0,
      usedValue: 0,
      lostCount: 0,
      lostValue: 0,
      usedByCategory: [],
    });
  });

  it('partitions active / used / expired and values each the right way', () => {
    const report = buildSpendingReport([
      g({ id: 'hold', amount: 8000, expiresAt: daysFromNow(10) }),
      g({
        id: 'held-partial',
        amount: 10000,
        expiresAt: daysFromNow(10),
        usageHistory: [{ id: 'r', amount: 3000, usedAt: '2026-02-02T00:00:00.000Z' }],
      }),
      g({ id: 'used', amount: 5000, isUsed: true, usedAt: '2026-03-03T00:00:00.000Z' }),
      g({ id: 'lost', amount: 4000, expiresAt: daysFromNow(-5) }),
    ]);

    expect(report.holdingCount).toBe(2);
    expect(report.holdingValue).toBe(8000 + 7000); // remaining balances
    expect(report.usedCount).toBe(1);
    expect(report.usedValue).toBe(5000);
    expect(report.lostCount).toBe(1);
    expect(report.lostValue).toBe(4000); // face value of the expired-unused one
  });

  it('groups used items by category, richest first, dropping empty categories', () => {
    const report = buildSpendingReport([
      g({ id: 'c1', category: 'cafe', amount: 3000, isUsed: true }),
      g({ id: 'c2', category: 'cafe', amount: 3000, isUsed: true }),
      g({ id: 'r1', category: 'restaurant', amount: 20000, isUsed: true }),
      g({ id: 'x1', category: 'culture', amount: 1000, expiresAt: daysFromNow(10) }),
    ]);

    expect(report.usedByCategory).toEqual([
      { category: 'restaurant', count: 1, value: 20000 },
      { category: 'cafe', count: 2, value: 6000 },
    ]);
  });
});
