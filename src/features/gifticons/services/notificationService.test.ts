import * as Notifications from 'expo-notifications';
import { scheduleExpiryNotifications, cancelNotifications } from './notificationService';

jest.mock('expo-device', () => ({ isDevice: true }));
jest.mock('expo-notifications', () => ({
  setNotificationHandler: jest.fn(),
  getPermissionsAsync: jest.fn(),
  requestPermissionsAsync: jest.fn(),
  setNotificationChannelAsync: jest.fn(),
  scheduleNotificationAsync: jest.fn(),
  cancelScheduledNotificationAsync: jest.fn(),
  AndroidImportance: { DEFAULT: 3 },
  SchedulableTriggerInputTypes: { DATE: 'date' },
}));

const mockedNotifications = Notifications as jest.Mocked<typeof Notifications>;

function daysFromNow(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString();
}

describe('scheduleExpiryNotifications', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedNotifications.getPermissionsAsync.mockResolvedValue({ status: 'granted' } as never);
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
