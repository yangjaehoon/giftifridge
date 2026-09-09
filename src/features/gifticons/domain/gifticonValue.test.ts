import { grossValue, spendableValue } from './gifticonValue';
import type { Gifticon } from './types';

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

describe('grossValue', () => {
  it('is the face amount for a 금액권, ignoring what has been spent', () => {
    expect(
      grossValue(
        g({
          id: 'a',
          amount: 10000,
          isUsed: true,
          usageHistory: [{ id: 'r', amount: 4000, usedAt: '2026-02-02T00:00:00.000Z' }],
        }),
      ),
    ).toBe(10000);
  });

  it('is the retail estimate for a known product voucher with no amount', () => {
    expect(grossValue(g({ id: 'a', brand: '스타벅스', name: '아메리카노' }))).toBeGreaterThan(0);
  });

  it('is 0 for an unrecognised product voucher', () => {
    expect(grossValue(g({ id: 'a', brand: '동네문구', name: '볼펜' }))).toBe(0);
  });
});

describe('spendableValue', () => {
  it('is the remaining balance for a partially used 금액권', () => {
    expect(
      spendableValue(
        g({
          id: 'a',
          amount: 10000,
          usageHistory: [{ id: 'r', amount: 4000, usedAt: '2026-02-02T00:00:00.000Z' }],
        }),
      ),
    ).toBe(6000);
  });

  it('is 0 once a 금액권 is marked used', () => {
    expect(spendableValue(g({ id: 'a', amount: 10000, isUsed: true }))).toBe(0);
  });

  it('falls back to the retail estimate for a product voucher', () => {
    expect(spendableValue(g({ id: 'a', brand: '스타벅스', name: '아메리카노' }))).toBeGreaterThan(
      0,
    );
  });
});
