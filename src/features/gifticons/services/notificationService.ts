import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import type { Gifticon } from '../types';
import { parseDate } from '../../../shared/utils/date';

let initialized = false;

/**
 * One-time setup: registers the foreground presentation handler and (on Android)
 * the notification channel. Called from App so importing this module has no side
 * effects, and so the channel isn't re-created on every gifticon save.
 */
export async function initNotifications(): Promise<void> {
  if (initialized) return;
  initialized = true;

  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: false,
      shouldSetBadge: false,
    }),
  });

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'default',
      importance: Notifications.AndroidImportance.DEFAULT,
    });
  }
}

export async function ensureNotificationPermission(): Promise<boolean> {
  if (!Device.isDevice) return false;
  const current = await Notifications.getPermissionsAsync();
  let status = current.status;
  if (status !== 'granted') {
    const requested = await Notifications.requestPermissionsAsync();
    status = requested.status;
  }
  return status === 'granted';
}

function offsetBody(brand: string, name: string, daysBefore: number): string {
  if (daysBefore <= 0) {
    return `${brand} ${name}의 유효기한이 오늘 마감이에요.`;
  }
  return `${brand} ${name}의 유효기한이 ${daysBefore}일 남았어요.`;
}

// iOS keeps at most 64 pending local notifications and silently drops the
// oldest once that's exceeded. Stay comfortably under it and, when close,
// schedule this gifticon's soonest reminders first.
const IOS_PENDING_LIMIT = 60;

/**
 * Schedules one local notification per offset (days before expiry, 9am),
 * soonest first. Offsets whose trigger time has already passed are skipped, and
 * on iOS scheduling stops once the app is at the pending-notification limit.
 */
export async function scheduleExpiryNotifications(
  gifticon: Pick<Gifticon, 'id' | 'name' | 'brand' | 'expiresAt'>,
  offsets: number[],
): Promise<string[]> {
  const granted = await ensureNotificationPermission();
  if (!granted) return [];

  const triggers = offsets
    .map((daysBefore) => {
      const date = parseDate(gifticon.expiresAt);
      date.setDate(date.getDate() - daysBefore);
      date.setHours(9, 0, 0, 0);
      return { daysBefore, date };
    })
    .filter((trigger) => trigger.date.getTime() > Date.now())
    .sort((a, b) => a.date.getTime() - b.date.getTime());

  if (triggers.length === 0) return [];

  let budget = triggers.length;
  if (Platform.OS === 'ios') {
    const pending = await Notifications.getAllScheduledNotificationsAsync();
    budget = Math.max(0, IOS_PENDING_LIMIT - pending.length);
  }

  const ids: string[] = [];
  for (const trigger of triggers) {
    if (ids.length >= budget) break;
    const id = await Notifications.scheduleNotificationAsync({
      content: {
        title: '기프티콘 유효기한 임박',
        body: offsetBody(gifticon.brand, gifticon.name, trigger.daysBefore),
        data: { gifticonId: gifticon.id },
      },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: trigger.date },
    });
    ids.push(id);
  }
  return ids;
}

export async function cancelNotifications(notificationIds?: string[] | null) {
  if (!notificationIds?.length) return;
  await Promise.all(
    notificationIds.map(async (id) => {
      try {
        await Notifications.cancelScheduledNotificationAsync(id);
      } catch {
        // already cancelled or fired
      }
    }),
  );
}
