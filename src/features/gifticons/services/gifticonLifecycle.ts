import { deleteGifticon, markGifticonUsed } from './gifticonService';
import { cancelNotifications } from './notificationService';
import { withTimeout, WRITE_TIMEOUT_MS } from '../../../shared/utils/withTimeout';
import type { Gifticon } from '../types';

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
