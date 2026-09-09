import {
  formatRemainingAmount,
  isAmountBased,
  remainingAmount,
  sortedUsageHistory,
  totalUsed,
} from './usage';
import type { UsageRecord } from './types';

describe('totalUsed', () => {
  it('sums the logged records', () => {
    expect(
      totalUsed({
        usageHistory: [
          { id: 'a', amount: 1000, usedAt: 't1' },
          { id: 'b', amount: 2500, usedAt: 't2' },
        ],
      }),
    ).toBe(3500);
  });

  it('is 0 with no history', () => {
    expect(totalUsed({})).toBe(0);
    expect(totalUsed({ usageHistory: [] })).toBe(0);
  });
});

describe('isAmountBased', () => {
  it('is true only when amount is set', () => {
    expect(isAmountBased({ amount: 5000 })).toBe(true);
    expect(isAmountBased({ amount: 0 })).toBe(true);
    expect(isAmountBased({ amount: undefined })).toBe(false);
  });
});

describe('remainingAmount', () => {
  it('is null for an item voucher with no amount', () => {
    expect(remainingAmount({ amount: undefined, isUsed: false })).toBeNull();
  });

  it('is the full amount with no usage logged', () => {
    expect(remainingAmount({ amount: 10000, isUsed: false })).toBe(10000);
  });

  it('subtracts logged usage', () => {
    expect(
      remainingAmount({
        amount: 10000,
        isUsed: false,
        usageHistory: [{ id: 'a', amount: 3000, usedAt: 't1' }],
      }),
    ).toBe(7000);
  });

  it('clamps at 0 rather than going negative', () => {
    expect(
      remainingAmount({
        amount: 5000,
        isUsed: false,
        usageHistory: [
          { id: 'a', amount: 3000, usedAt: 't1' },
          { id: 'b', amount: 4000, usedAt: 't2' },
        ],
      }),
    ).toBe(0);
  });

  it('is 0 once isUsed is true, regardless of the logged total', () => {
    expect(
      remainingAmount({
        amount: 10000,
        isUsed: true,
        usageHistory: [{ id: 'a', amount: 1000, usedAt: 't1' }],
      }),
    ).toBe(0);
  });

  // Compile-time check as much as a runtime one: with `amount` statically
  // known to be a number, the overload should hand back `number`, not
  // `number | null` — this line would fail to typecheck otherwise.
  it('is typed as non-null when amount is statically known', () => {
    const gifticon = { amount: 10000, isUsed: false } as const;
    const remaining: number = remainingAmount(gifticon);
    expect(remaining).toBe(10000);
  });
});

describe('formatRemainingAmount', () => {
  it('shows the face value alone when nothing has been used', () => {
    expect(formatRemainingAmount({ amount: 10000, isUsed: false })).toBe('10,000원');
  });

  it('shows "N원 남음" once partially used', () => {
    expect(
      formatRemainingAmount({
        amount: 10000,
        isUsed: false,
        usageHistory: [{ id: 'a', amount: 3000, usedAt: 't1' }],
      }),
    ).toBe('7,000원 남음');
  });

  it('shows "0원 남음" once fully closed out', () => {
    expect(formatRemainingAmount({ amount: 10000, isUsed: true })).toBe('0원 남음');
  });
});

describe('sortedUsageHistory', () => {
  it('orders most recent first without mutating the input', () => {
    const history: UsageRecord[] = [
      { id: 'a', amount: 1000, usedAt: '2026-01-01T00:00:00.000Z' },
      { id: 'b', amount: 2000, usedAt: '2026-03-01T00:00:00.000Z' },
      { id: 'c', amount: 3000, usedAt: '2026-02-01T00:00:00.000Z' },
    ];
    const original = [...history];

    expect(sortedUsageHistory({ usageHistory: history }).map((r) => r.amount)).toEqual([
      2000, 3000, 1000,
    ]);
    expect(history).toEqual(original);
  });

  it('is an empty array with no history', () => {
    expect(sortedUsageHistory({})).toEqual([]);
  });
});
