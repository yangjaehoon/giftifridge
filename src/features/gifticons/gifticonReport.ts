import type { Gifticon, GifticonCategory } from './types';
import { grossValue, spendableValue } from './gifticonValue';
import { statusOf } from './gifticonFilters';

// A look-back over the whole collection (every tab), for the report screen.
// All estimates: a product voucher's worth comes from the rough retail table,
// and a 금액권 marked used counts its full face value even if a balance was
// forfeited — so the screen frames these as approximate.

export interface CategoryBreakdown {
  category: GifticonCategory;
  count: number;
  value: number;
}

export interface SpendingReport {
  /** Still usable (not used, not expired). */
  holdingCount: number;
  holdingValue: number;
  /** Marked used. */
  usedCount: number;
  usedValue: number;
  /** Expired without ever being used — money left on the table. */
  lostCount: number;
  lostValue: number;
  /** Used items grouped by category, richest first; empty categories dropped. */
  usedByCategory: CategoryBreakdown[];
}

export function buildSpendingReport(items: Gifticon[]): SpendingReport {
  const report: SpendingReport = {
    holdingCount: 0,
    holdingValue: 0,
    usedCount: 0,
    usedValue: 0,
    lostCount: 0,
    lostValue: 0,
    usedByCategory: [],
  };

  const byCategory = new Map<GifticonCategory, CategoryBreakdown>();

  for (const item of items) {
    switch (statusOf(item)) {
      case 'active': {
        report.holdingCount += 1;
        report.holdingValue += spendableValue(item);
        break;
      }
      case 'used': {
        const value = grossValue(item);
        report.usedCount += 1;
        report.usedValue += value;
        const bucket = byCategory.get(item.category) ?? {
          category: item.category,
          count: 0,
          value: 0,
        };
        bucket.count += 1;
        bucket.value += value;
        byCategory.set(item.category, bucket);
        break;
      }
      case 'expired': {
        report.lostCount += 1;
        report.lostValue += grossValue(item);
        break;
      }
    }
  }

  report.usedByCategory = [...byCategory.values()].sort((a, b) => b.value - a.value);
  return report;
}
