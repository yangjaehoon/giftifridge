import { deleteGifticon, markGifticonUsed } from './gifticonService';
import { cancelNotifications } from './notificationService';
import { removeGifticon, setGifticonUsed } from './gifticonLifecycle';
import type { Gifticon } from '../types';

jest.mock('./gifticonService', () => ({
  deleteGifticon: jest.fn(),
  markGifticonUsed: jest.fn(),
}));
jest.mock('./notificationService', () => ({ cancelNotifications: jest.fn() }));

const mockedMarkUsed = markGifticonUsed as jest.Mock;
const mockedDelete = deleteGifticon as jest.Mock;
const mockedCancel = cancelNotifications as jest.Mock;

const gifticon = {
  id: 'g1',
  ownerId: 'owner',
  notificationIds: ['n1', 'n2'],
} as Gifticon;

beforeEach(() => {
  jest.clearAllMocks();
  mockedMarkUsed.mockResolvedValue(undefined);
  mockedDelete.mockResolvedValue(undefined);
  mockedCancel.mockResolvedValue(undefined);
});

describe('setGifticonUsed', () => {
  it('marks used and cancels the owner reminders when the owner marks it used', async () => {
    await setGifticonUsed(gifticon, true, 'owner');

    expect(mockedMarkUsed).toHaveBeenCalledWith('g1', true);
    expect(mockedCancel).toHaveBeenCalledWith(['n1', 'n2']);
  });

  it('does not cancel reminders when marking unused', async () => {
    await setGifticonUsed(gifticon, false, 'owner');

    expect(mockedMarkUsed).toHaveBeenCalledWith('g1', false);
    expect(mockedCancel).not.toHaveBeenCalled();
  });

  it('does not cancel reminders when a non-owner marks a shared gifticon used', async () => {
    await setGifticonUsed(gifticon, true, 'someone-else');

    expect(mockedMarkUsed).toHaveBeenCalledWith('g1', true);
    expect(mockedCancel).not.toHaveBeenCalled();
  });

  it('still resolves when the reminder cancel fails after the usage write succeeded', async () => {
    mockedCancel.mockRejectedValue(new Error('cancel blew up'));

    await expect(setGifticonUsed(gifticon, true, 'owner')).resolves.toBeUndefined();
    expect(mockedMarkUsed).toHaveBeenCalledWith('g1', true);
  });

  it('propagates a failure of the usage write itself', async () => {
    mockedMarkUsed.mockRejectedValue(new Error('write failed'));

    await expect(setGifticonUsed(gifticon, true, 'owner')).rejects.toThrow('write failed');
    expect(mockedCancel).not.toHaveBeenCalled();
  });
});

describe('removeGifticon', () => {
  it('cancels reminders then deletes the doc', async () => {
    await removeGifticon(gifticon);

    expect(mockedCancel).toHaveBeenCalledWith(['n1', 'n2']);
    expect(mockedDelete).toHaveBeenCalledWith(gifticon);
    expect(mockedCancel.mock.invocationCallOrder[0]).toBeLessThan(
      mockedDelete.mock.invocationCallOrder[0],
    );
  });

  it('deletes anyway when the reminder cancel fails', async () => {
    mockedCancel.mockRejectedValue(new Error('cancel blew up'));

    await removeGifticon(gifticon);

    expect(mockedDelete).toHaveBeenCalledWith(gifticon);
  });

  it('propagates a failure of the delete itself', async () => {
    mockedDelete.mockRejectedValue(new Error('delete failed'));

    await expect(removeGifticon(gifticon)).rejects.toThrow('delete failed');
  });
});
