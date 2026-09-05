import {
  addGifticonUsageRecord,
  deleteGifticon,
  markGifticonUsed,
  removeGifticonUsageRecord,
} from './gifticonService';
import { cancelNotifications } from './notificationService';
import { withTimeout, WRITE_TIMEOUT_MS } from '../../../shared/utils/withTimeout';
import { remainingAmount } from '../usage';
import type { Gifticon, UsageRecord } from '../types';

// The "use / un-use / delete a gifticon" policy — including which of those
// steps may touch the owner's local reminders — so the detail screen is left
// with just the button wiring and error toast.

/**
 * Marks a gifticon used or unused. When it's being marked used *by its owner*,
 * also cancels that owner's local expiry reminders: the ids live on the shared
 * doc but were scheduled on the owner's device, so only the owner can clear
 * them (a member marking a shared gifticon used can't stop the owner's alert —
 * that needs server push). The usage write is what matters; a stuck or failed
 * reminder-cancel afterwards never turns into a failure the caller sees.
 */
export async function setGifticonUsed(
  gifticon: Pick<Gifticon, 'id' | 'ownerId' | 'notificationIds'>,
  used: boolean,
  actingUid: string | undefined,
): Promise<void> {
  await withTimeout(markGifticonUsed(gifticon.id, used), WRITE_TIMEOUT_MS);

  if (used && gifticon.ownerId === actingUid) {
    try {
      await withTimeout(cancelNotifications(gifticon.notificationIds), WRITE_TIMEOUT_MS);
    } catch {
      // usage state already saved; a stuck notification cancel shouldn't block it
    }
  }
}

/**
 * Deletes a gifticon, cancelling its local reminders first. The cancel is
 * best-effort — a failure there must not block the delete the user just
 * confirmed — so only the delete itself can reject.
 */
export async function removeGifticon(gifticon: Gifticon): Promise<void> {
  try {
    await withTimeout(cancelNotifications(gifticon.notificationIds), WRITE_TIMEOUT_MS);
  } catch {
    // best-effort cleanup; proceed with the delete regardless
  }
  await withTimeout(deleteGifticon(gifticon), WRITE_TIMEOUT_MS);
}

/**
 * Logs one partial spend against an amount-based (금액권) gifticon — a gift
 * card used over several visits instead of all at once. If this spend uses up
 * exactly what was left, the gifticon is also marked used (via setGifticonUsed,
 * so the owner-only reminder-cancel rule still applies) so it moves to the
 * 사용완료 tab without the caller having to flip both.
 */
export async function recordGifticonUsage(
  gifticon: Pick<
    Gifticon,
    'id' | 'ownerId' | 'amount' | 'isUsed' | 'usageHistory' | 'notificationIds'
  >,
  amount: number,
  actingUid: string | undefined,
): Promise<void> {
  const remaining = remainingAmount(gifticon) ?? 0;
  if (!(amount > 0) || amount > remaining) {
    throw new Error('recordGifticonUsage: amount must be between 0 and the remaining balance');
  }

  const record: UsageRecord = { amount, usedAt: new Date().toISOString() };
  await withTimeout(addGifticonUsageRecord(gifticon.id, record), WRITE_TIMEOUT_MS);

  if (amount === remaining) {
    await setGifticonUsed(gifticon, true, actingUid);
  }
}

/**
 * Removes one logged spend. Deliberately leaves isUsed alone — a gifticon
 * closed out via the used/unused toggle (by hand, or because a usage record
 * had already brought the balance to 0) stays closed until the user reopens
 * it explicitly, so correcting an old record can't silently reopen something
 * they meant to leave done.
 */
export async function deleteGifticonUsageRecord(
  gifticonId: string,
  record: UsageRecord,
): Promise<void> {
  await withTimeout(removeGifticonUsageRecord(gifticonId, record), WRITE_TIMEOUT_MS);
}
