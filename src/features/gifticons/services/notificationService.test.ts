import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import {
  scheduleExpiryNotifications,
  cancelNotifications,
  ensureNotificationPermission,
} from './notificationService';

jest.mock('expo-device', () => ({ isDevice: true }));
jest.mock('expo-notifications', () => ({
  setNotificationHandler: jest.fn(),
  getPermissionsAsync: jest.fn(),
  requestPermissionsAsync: jest.fn(),
  setNotificationChannelAsync: jest.fn(),
  scheduleNotificationAsync: jest.fn(),
  cancelScheduledNotificationAsync: jest.fn(),
  getAllScheduledNotificationsAsync: jest.fn(),
  AndroidImportance: { DEFAULT: 3 },
  SchedulableTriggerInputTypes: { DATE: 'date' },
}));

const mockedNotifications = Notifications as jest.Mocked<typeof Notifications>;

describe('notification handler', () => {
  it('shows a banner and list entry without sound or badge', async () => {
    const [{ handleNotification }] = (Notifications.setNotificationHandler as jest.Mock).mock
      .calls[0];
    await expect(handleNotification()).resolves.toEqual({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: false,
      shouldSetBadge: false,
    });
  });
});

describe('ensureNotificationPermission', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (Device as { isDevice: boolean }).isDevice = true;
  });

  afterEach(() => {
    Platform.OS = 'ios';
  });

  it('returns false on a simulator without asking for permission', async () => {
    (Device as { isDevice: boolean }).isDevice = false;
    await expect(ensureNotificationPermission()).resolves.toBe(false);
    expect(mockedNotifications.getPermissionsAsync).not.toHaveBeenCalled();
  });

  it('does not re-request when permission is already granted', async () => {
    mockedNotifications.getPermissionsAsync.mockResolvedValue({ status: 'granted' } as never);
    await expect(ensureNotificationPermission()).resolves.toBe(true);
    expect(mockedNotifications.requestPermissionsAsync).not.toHaveBeenCalled();
  });

  it('requests permission when not granted and reports the result', async () => {
    mockedNotifications.getPermissionsAsync.mockResolvedValue({ status: 'denied' } as never);
    mockedNotifications.requestPermissionsAsync.mockResolvedValue({ status: 'denied' } as never);
    await expect(ensureNotificationPermission()).resolves.toBe(false);
  });

  it('creates the default Android notification channel', async () => {
    Platform.OS = 'android';
    mockedNotifications.getPermissionsAsync.mockResolvedValue({ status: 'granted' } as never);

    await ensureNotificationPermission();

    expect(mockedNotifications.setNotificationChannelAsync).toHaveBeenCalledWith(
      'default',
      expect.objectContaining({ name: 'default' }),
    );
  });
});

function daysFromNow(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString();
}

describe('scheduleExpiryNotifications', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedNotifications.getPermissionsAsync.mockResolvedValue({ status: 'granted' } as never);
    mockedNotifications.getAllScheduledNotificationsAsync.mockResolvedValue([] as never);
    let counter = 0;
    mockedNotifications.scheduleNotificationAsync.mockImplementation(async () => `id-${++counter}`);
  });

  it('schedules one notification per offset when all trigger dates are in the future', async () => {
    const ids = await scheduleExpiryNotifications(
      { id: 'g1', name: '아메리카노', brand: '스타벅스', expiresAt: daysFromNow(30) },
      [7, 3, 1, 0],
    );
    expect(ids).toHaveLength(4);
    expect(mockedNotifications.scheduleNotificationAsync).toHaveBeenCalledTimes(4);
  });

  it('skips offsets whose trigger date has already passed', async () => {
    const ids = await scheduleExpiryNotifications(
      { id: 'g1', name: '아메리카노', brand: '스타벅스', expiresAt: daysFromNow(5) },
      [7, 2],
    );
    expect(ids).toHaveLength(1);
    expect(mockedNotifications.scheduleNotificationAsync).toHaveBeenCalledTimes(1);
  });

  it('stops scheduling once the iOS pending-notification limit is reached', async () => {
    const nearlyFull = Array.from({ length: 59 }, (_, i) => ({ identifier: `x${i}` }));
    mockedNotifications.getAllScheduledNotificationsAsync.mockResolvedValue(nearlyFull as never);

    const ids = await scheduleExpiryNotifications(
      { id: 'g1', name: '아메리카노', brand: '스타벅스', expiresAt: daysFromNow(30) },
      [7, 3, 1, 0],
    );

    // Only room for one more (60 - 59), and it should be the soonest trigger.
    expect(ids).toHaveLength(1);
    expect(mockedNotifications.scheduleNotificationAsync).toHaveBeenCalledTimes(1);
    const [{ trigger }] = mockedNotifications.scheduleNotificationAsync.mock.calls[0] as [
      { trigger: { date: Date } },
    ];
    const expectedSoonest = new Date(daysFromNow(30));
    expectedSoonest.setDate(expectedSoonest.getDate() - 7);
    expectedSoonest.setHours(9, 0, 0, 0);
    expect(trigger.date.getTime()).toBe(expectedSoonest.getTime());
  });

  it('returns an empty array when notification permission is not granted', async () => {
    mockedNotifications.getPermissionsAsync.mockResolvedValue({ status: 'denied' } as never);
    mockedNotifications.requestPermissionsAsync.mockResolvedValue({ status: 'denied' } as never);
    const ids = await scheduleExpiryNotifications(
      { id: 'g1', name: '아메리카노', brand: '스타벅스', expiresAt: daysFromNow(30) },
      [3],
    );
    expect(ids).toEqual([]);
    expect(mockedNotifications.scheduleNotificationAsync).not.toHaveBeenCalled();
  });
});

describe('cancelNotifications', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('cancels every id in the list', async () => {
    mockedNotifications.cancelScheduledNotificationAsync.mockResolvedValue(undefined);
    await cancelNotifications(['a', 'b', 'c']);
    expect(mockedNotifications.cancelScheduledNotificationAsync).toHaveBeenCalledTimes(3);
    expect(mockedNotifications.cancelScheduledNotificationAsync).toHaveBeenCalledWith('a');
  });

  it('does nothing when given undefined or an empty array', async () => {
    await cancelNotifications(undefined);
    await cancelNotifications([]);
    expect(mockedNotifications.cancelScheduledNotificationAsync).not.toHaveBeenCalled();
  });

  it('swallows errors from already-cancelled notifications', async () => {
    mockedNotifications.cancelScheduledNotificationAsync.mockRejectedValue(new Error('not found'));
    await expect(cancelNotifications(['a'])).resolves.toBeUndefined();
  });
});
