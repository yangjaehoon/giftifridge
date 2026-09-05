import type { Gifticon, UsageRecord } from './types';

// How a partial-spend log combines with the coarse isUsed flag into "how much
// is left". Kept pure and in one place so the card, stats, and detail screen
// can't drift out of agreement on what "remaining" means.

/** Sum of everything logged in usageHistory. */
export function totalUsed(gifticon: Pick<Gifticon, 'usageHistory'>): number {
  return (gifticon.usageHistory ?? []).reduce((sum, record) => sum + record.amount, 0);
}

/**
 * Balance left to spend, or `null` when the gifticon has no amount at all
 * (an item voucher, not a gift-card-style one). `isUsed` always wins: a
 * gifticon closed out via the plain used/unused toggle reads as 0 remaining
 * regardless of what's logged, so the two controls never show conflicting
 * numbers.
 */
export function remainingAmount(
  gifticon: Pick<Gifticon, 'amount' | 'usageHistory' | 'isUsed'>,
): number | null {
  if (gifticon.amount == null) return null;
  if (gifticon.isUsed) return 0;
  return Math.max(0, gifticon.amount - totalUsed(gifticon));
}

/**
 * Whether this gifticon has a balance worth tracking partial spends against.
 * A type guard (not just a boolean check) so call sites narrow `amount` to
 * `number` instead of reaching for a non-null assertion afterwards.
 */
export function isAmountBased<T extends Pick<Gifticon, 'amount'>>(
  gifticon: T,
): gifticon is T & { amount: number } {
  return gifticon.amount != null;
}

/** Usage history, most recent first. */
export function sortedUsageHistory(gifticon: Pick<Gifticon, 'usageHistory'>): UsageRecord[] {
  return [...(gifticon.usageHistory ?? [])].sort((a, b) => (a.usedAt < b.usedAt ? 1 : -1));
}
