import { setGifticonNotificationIds } from './gifticonService';
import { cancelNotifications, scheduleExpiryNotifications } from './notificationService';
import { getNotificationOffsets } from '../../../shared/utils/notificationPrefs';
import { withTimeout, WRITE_TIMEOUT_MS } from '../../../shared/utils/withTimeout';

interface SyncParams {
  gifticon: { id: string; name: string; brand: string; expiresAt: string };
  /**
   * Reminders are local to one device and their ids live on the shared doc, so
   * only the owner may touch them — otherwise two members editing the same
   * shared gifticon clobber each other's ids and can no longer cancel.
   */
  isOwner: boolean;
  isEditing: boolean;
  previousNotificationIds?: string[] | null;
}

/**
 * Best-effort follow-up to a gifticon save: cancels any reminders from a
 * previous version, schedules fresh ones from the user's offset preference, and
 * persists their ids back onto the doc. The gifticon itself is already saved
 * when this runs — a failure here must not surface as a save failure (which
 * would prompt a retry and create a duplicate), so everything is swallowed.
 *
 * Known limitation: a non-owner member marking a shared gifticon used can't
 * cancel the owner's already-scheduled local reminders, so the owner may still
 * get an "expires soon" alert for a gifticon someone else used. Fixing that
 * needs server-driven push, not local notifications.
 */
export async function syncGifticonReminders({
  gifticon,
  isOwner,
  isEditing,
  previousNotificationIds,
}: SyncParams): Promise<void> {
  if (!isOwner) return;
  try {
    if (isEditing && previousNotificationIds?.length) {
      await cancelNotifications(previousNotificationIds);
    }
    const offsets = await getNotificationOffsets();
    const notificationIds = await scheduleExpiryNotifications(gifticon, offsets);
    // On edit, always write back (possibly []) so a shrink from N reminders to
    // none is persisted; on create, skip the extra write when nothing scheduled.
    if (notificationIds.length > 0 || isEditing) {
      await withTimeout(setGifticonNotificationIds(gifticon.id, notificationIds), WRITE_TIMEOUT_MS);
    }
  } catch (err) {
    // gifticon already saved; reminder scheduling can't be retried from here
    if (__DEV__) console.warn('syncGifticonReminders failed', err);
  }
}
