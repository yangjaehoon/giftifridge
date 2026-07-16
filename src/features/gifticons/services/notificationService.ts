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

const DAYS_BEFORE_EXPIRY = 3;

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

export async function scheduleExpiryNotification(gifticon: Pick<Gifticon, 'name' | 'brand' | 'expiresAt'>): Promise<string | null> {
  const granted = await ensureNotificationPermission();
  if (!granted) return null;

  const expiryDate = new Date(gifticon.expiresAt);
  const triggerDate = new Date(expiryDate);
  triggerDate.setDate(triggerDate.getDate() - DAYS_BEFORE_EXPIRY);
  triggerDate.setHours(9, 0, 0, 0);

  if (triggerDate.getTime() <= Date.now()) {
    return null;
  }

  return Notifications.scheduleNotificationAsync({
    content: {
      title: '기프티콘 유효기한 임박',
      body: `${gifticon.brand} ${gifticon.name}의 유효기한이 ${DAYS_BEFORE_EXPIRY}일 남았어요.`,
    },
    trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: triggerDate },
  });
}

export async function cancelNotification(notificationId?: string | null) {
  if (!notificationId) return;
  try {
    await Notifications.cancelScheduledNotificationAsync(notificationId);
  } catch {
    // already cancelled or fired
  }
}
