import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import type { Gifticon } from '../types';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

export async function ensureNotificationPermission(): Promise<boolean> {
  if (!Device.isDevice) return false;
  const current = await Notifications.getPermissionsAsync();
  let status = current.status;
  if (status !== 'granted') {
    const requested = await Notifications.requestPermissionsAsync();
    status = requested.status;
  }
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'default',
      importance: Notifications.AndroidImportance.DEFAULT,
    });
  }
  return status === 'granted';
}

function offsetBody(brand: string, name: string, daysBefore: number): string {
  if (daysBefore <= 0) {
    return `${brand} ${name}의 유효기한이 오늘 마감이에요.`;
  }
  return `${brand} ${name}의 유효기한이 ${daysBefore}일 남았어요.`;
}

/**
 * Schedules one local notification per offset (days before expiry, 9am).
 * Offsets whose trigger time has already passed are silently skipped.
 */
export async function scheduleExpiryNotifications(
  gifticon: Pick<Gifticon, 'id' | 'name' | 'brand' | 'expiresAt'>,
  offsets: number[],
): Promise<string[]> {
  const granted = await ensureNotificationPermission();
  if (!granted) return [];

  const ids: string[] = [];
  for (const daysBefore of offsets) {
    const triggerDate = new Date(gifticon.expiresAt);
    triggerDate.setDate(triggerDate.getDate() - daysBefore);
    triggerDate.setHours(9, 0, 0, 0);

    if (triggerDate.getTime() <= Date.now()) continue;

    const id = await Notifications.scheduleNotificationAsync({
      content: {
        title: '기프티콘 유효기한 임박',
        body: offsetBody(gifticon.brand, gifticon.name, daysBefore),
        data: { gifticonId: gifticon.id },
      },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: triggerDate },
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
