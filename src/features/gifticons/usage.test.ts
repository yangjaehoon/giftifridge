import { isAmountBased, remainingAmount, sortedUsageHistory, totalUsed } from './usage';
import type { UsageRecord } from './types';

describe('totalUsed', () => {
  it('sums the logged records', () => {
    expect(
      totalUsed({
        usageHistory: [
          { amount: 1000, usedAt: 't1' },
          { amount: 2500, usedAt: 't2' },
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
        usageHistory: [{ amount: 3000, usedAt: 't1' }],
      }),
    ).toBe(7000);
  });

  it('clamps at 0 rather than going negative', () => {
    expect(
      remainingAmount({
        amount: 5000,
        isUsed: false,
        usageHistory: [
          { amount: 3000, usedAt: 't1' },
          { amount: 4000, usedAt: 't2' },
        ],
      }),
    ).toBe(0);
  });

  it('is 0 once isUsed is true, regardless of the logged total', () => {
    expect(
      remainingAmount({
        amount: 10000,
        isUsed: true,
        usageHistory: [{ amount: 1000, usedAt: 't1' }],
      }),
    ).toBe(0);
  });
});

describe('sortedUsageHistory', () => {
  it('orders most recent first without mutating the input', () => {
    const history: UsageRecord[] = [
      { amount: 1000, usedAt: '2026-01-01T00:00:00.000Z' },
      { amount: 2000, usedAt: '2026-03-01T00:00:00.000Z' },
      { amount: 3000, usedAt: '2026-02-01T00:00:00.000Z' },
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
