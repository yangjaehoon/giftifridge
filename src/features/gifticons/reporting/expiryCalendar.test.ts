import { gifticonsByExpiryDate, monthMatrix, shiftMonth } from './expiryCalendar';
import type { Gifticon } from '../types';

function g(overrides: Partial<Gifticon> & { id: string }): Gifticon {
  return {
    ownerId: 'u1',
    name: '아메리카노',
    brand: '스타벅스',
    category: 'cafe',
    imageUrl: 'https://x/y.jpg',
    expiresAt: '2027-01-10',
    isUsed: false,
    createdAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

describe('monthMatrix', () => {
  it('is always 6 rows of 7 days', () => {
    const grid = monthMatrix(2026, 8); // Sep 2026
    expect(grid).toHaveLength(6);
    grid.forEach((week) => expect(week).toHaveLength(7));
  });

  it('places the 1st in the right weekday slot and pads the rest with null', () => {
    // 2026-02-01 is a Sunday → first cell is the 1st, no leading padding.
    const feb = monthMatrix(2026, 1);
    expect(feb[0][0]).toBe('2026-02-01');
    expect(feb[0][6]).toBe('2026-02-07');
    // Feb 2026 has 28 days → last day is the 28th, trailing cells are null.
    expect(feb[3][6]).toBe('2026-02-28');
    expect(feb[4][0]).toBeNull();
  });

  it('leads with null when the month does not start on Sunday', () => {
    // 2026-01-01 is a Thursday (weekday 4).
    const jan = monthMatrix(2026, 0);
    expect(jan[0].slice(0, 4)).toEqual([null, null, null, null]);
    expect(jan[0][4]).toBe('2026-01-01');
  });
});

describe('gifticonsByExpiryDate', () => {
  it('buckets not-yet-used gifticons by their expiry day', () => {
    const byDate = gifticonsByExpiryDate([
      g({ id: 'a', expiresAt: '2027-01-10' }),
      g({ id: 'b', expiresAt: '2027-01-10' }),
      g({ id: 'c', expiresAt: '2027-02-01' }),
    ]);
    expect(byDate['2027-01-10'].map((x) => x.id)).toEqual(['a', 'b']);
    expect(byDate['2027-02-01'].map((x) => x.id)).toEqual(['c']);
  });

  it('drops used gifticons but keeps expired-unused ones', () => {
    const byDate = gifticonsByExpiryDate([
      g({ id: 'used', expiresAt: '2027-01-10', isUsed: true }),
      g({ id: 'expired', expiresAt: '2000-01-01' }),
    ]);
    expect(byDate['2027-01-10']).toBeUndefined();
    expect(byDate['2000-01-01'].map((x) => x.id)).toEqual(['expired']);
  });
});

describe('shiftMonth', () => {
  it('steps forward, rolling the year at December', () => {
    expect(shiftMonth(2026, 11, 1)).toEqual({ year: 2027, month: 0 });
  });

  it('steps back, rolling the year at January', () => {
    expect(shiftMonth(2026, 0, -1)).toEqual({ year: 2025, month: 11 });
  });
});
