import {
  addGifticonUsageRecord,
  addGifticonUsageRecordAndClose,
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
 * Cancels the owner's local reminders once a gifticon is closed out — shared
 * by setGifticonUsed and recordGifticonUsage so "cancel only if used and only
 * for the owner" lives in one place. See setGifticonUsed for why it's
 * owner-only, and why a failure here is swallowed.
 */
async function cancelOwnerRemindersIfClosed(
  gifticon: Pick<Gifticon, 'ownerId' | 'notificationIds'>,
  closed: boolean,
  actingUid: string | undefined,
): Promise<void> {
  if (!closed || gifticon.ownerId !== actingUid) return;
  try {
    await withTimeout(cancelNotifications(gifticon.notificationIds), WRITE_TIMEOUT_MS);
  } catch {
    // usage state already saved; a stuck notification cancel shouldn't block it
  }
}

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
  await cancelOwnerRemindersIfClosed(gifticon, used, actingUid);
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
 * exactly what was left, the usage record and isUsed:true are written in one
 * updateDoc (addGifticonUsageRecordAndClose) rather than two separate writes,
 * so a timeout between them can't leave the balance reading 0 while the
 * gifticon still sits in the 사용가능 tab.
 *
 * `record` is built by the caller (see GifticonUsagePanel), with a client-side
 * id pinned for the life of one add-record form session — the same reasoning
 * as newGifticonId()/newSpaceId(): a write retried after a timeout reuses the
 * same id, so arrayUnion recognises it as the same element instead of
 * double-logging the spend.
 *
 * Known limitation: the `amount <= remaining` check below reads from the
 * `gifticon` the caller already has, not a fresh server read. Two members of
 * a shared space logging spends at nearly the same moment can each pass this
 * check against a remaining balance the other's write has already reduced,
 * so the logged total can end up exceeding `amount`. Firestore security rules
 * can't express a running-sum constraint over a list, so closing this
 * properly needs a transaction (Cloud Functions) rather than client writes —
 * out of scope here, same as the shared-space reminder-cancel gap below.
 */
export async function recordGifticonUsage(
  gifticon: Pick<
    Gifticon,
    'id' | 'ownerId' | 'amount' | 'isUsed' | 'usageHistory' | 'notificationIds'
  >,
  record: UsageRecord,
  actingUid: string | undefined,
): Promise<void> {
  const remaining = remainingAmount(gifticon) ?? 0;
  if (!(record.amount > 0) || record.amount > remaining) {
    throw new Error('recordGifticonUsage: amount must be between 0 and the remaining balance');
  }

  const closesOutBalance = record.amount === remaining;
  await withTimeout(
    closesOutBalance
      ? addGifticonUsageRecordAndClose(gifticon.id, record)
      : addGifticonUsageRecord(gifticon.id, record),
    WRITE_TIMEOUT_MS,
  );
  await cancelOwnerRemindersIfClosed(gifticon, closesOutBalance, actingUid);
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
