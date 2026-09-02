import { setGifticonNotificationIds } from './gifticonService';
import { cancelNotifications, scheduleExpiryNotifications } from './notificationService';
import { getNotificationOffsets } from '../../../shared/utils/notificationPrefs';
import { syncGifticonReminders } from './gifticonReminders';

jest.mock('./gifticonService', () => ({ setGifticonNotificationIds: jest.fn() }));
jest.mock('./notificationService', () => ({
  cancelNotifications: jest.fn(),
  scheduleExpiryNotifications: jest.fn(),
}));
jest.mock('../../../shared/utils/notificationPrefs', () => ({ getNotificationOffsets: jest.fn() }));

const mockedSetIds = setGifticonNotificationIds as jest.Mock;
const mockedCancel = cancelNotifications as jest.Mock;
const mockedSchedule = scheduleExpiryNotifications as jest.Mock;
const mockedGetOffsets = getNotificationOffsets as jest.Mock;

const gifticon = { id: 'g1', name: '아메리카노', brand: '스타벅스', expiresAt: '2026-08-01' };

beforeEach(() => {
  jest.clearAllMocks();
  mockedGetOffsets.mockResolvedValue([7, 3]);
  mockedSchedule.mockResolvedValue(['n1', 'n2']);
  mockedSetIds.mockResolvedValue(undefined);
  mockedCancel.mockResolvedValue(undefined);
});

describe('syncGifticonReminders', () => {
  it('does nothing when the caller is not the owner', async () => {
    await syncGifticonReminders({ gifticon, isOwner: false, isEditing: false });

    expect(mockedSchedule).not.toHaveBeenCalled();
    expect(mockedSetIds).not.toHaveBeenCalled();
  });

  it('schedules reminders and writes their ids back on create', async () => {
    await syncGifticonReminders({ gifticon, isOwner: true, isEditing: false });

    expect(mockedCancel).not.toHaveBeenCalled();
    expect(mockedSchedule).toHaveBeenCalledWith(gifticon, [7, 3]);
    expect(mockedSetIds).toHaveBeenCalledWith('g1', ['n1', 'n2']);
  });

  it('skips the write-back on create when nothing was scheduled', async () => {
    mockedSchedule.mockResolvedValue([]);
    await syncGifticonReminders({ gifticon, isOwner: true, isEditing: false });

    expect(mockedSetIds).not.toHaveBeenCalled();
  });

  it('cancels the previous reminders and persists the empty set on an edit that schedules none', async () => {
    mockedSchedule.mockResolvedValue([]);
    await syncGifticonReminders({
      gifticon,
      isOwner: true,
      isEditing: true,
      previousNotificationIds: ['old-1', 'old-2'],
    });

    expect(mockedCancel).toHaveBeenCalledWith(['old-1', 'old-2']);
    expect(mockedSetIds).toHaveBeenCalledWith('g1', []);
  });

  it('never throws when a downstream call fails (the gifticon is already saved)', async () => {
    mockedSchedule.mockRejectedValue(new Error('scheduling blew up'));

    await expect(
      syncGifticonReminders({ gifticon, isOwner: true, isEditing: false }),
    ).resolves.toBeUndefined();
  });
});
