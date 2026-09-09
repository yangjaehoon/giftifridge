import { isAmountBased, remainingAmount } from './usage';
import { lookupEstimatedPrice } from './menuPrices';
import type { Gifticon } from './types';

// "What is this gifticon worth" in one place, so the home total, the stats
// row, and the spending report can't drift on the answer. Two notions:
//   - grossValue:     the original face value (for a used/expired item)
//   - spendableValue:  what's still on it right now (for an active item)

/**
 * Face value: a 금액권's full printed amount, or a rough retail estimate for a
 * known product voucher. 0 when neither is available (an unrecognised product
 * voucher). Ignores how much has since been spent — use it for an item that's
 * already done (used or expired).
 */
export function grossValue(item: Pick<Gifticon, 'amount' | 'brand' | 'name'>): number {
  if (item.amount != null) return item.amount;
  return lookupEstimatedPrice(item.brand, item.name)?.price ?? 0;
}

/**
 * What the gifticon is still worth today: a 금액권's remaining balance (0 once
 * used up or marked used), otherwise the same retail estimate as grossValue.
 * Use it for an item still in play.
 */
export function spendableValue(item: Gifticon): number {
  if (isAmountBased(item)) return remainingAmount(item);
  return lookupEstimatedPrice(item.brand, item.name)?.price ?? 0;
}
