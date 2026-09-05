import {
  addGifticonUsageRecord,
  addGifticonUsageRecordAndClose,
  deleteGifticon,
  markGifticonUsed,
  removeGifticonUsageRecord,
} from './gifticonService';
import { cancelNotifications } from './notificationService';
import {
  deleteGifticonUsageRecord,
  recordGifticonUsage,
  removeGifticon,
  setGifticonUsed,
} from './gifticonLifecycle';
import type { Gifticon } from '../types';

jest.mock('./gifticonService', () => ({
  addGifticonUsageRecord: jest.fn(),
  addGifticonUsageRecordAndClose: jest.fn(),
  deleteGifticon: jest.fn(),
  markGifticonUsed: jest.fn(),
  removeGifticonUsageRecord: jest.fn(),
}));
jest.mock('./notificationService', () => ({ cancelNotifications: jest.fn() }));

const mockedMarkUsed = markGifticonUsed as jest.Mock;
const mockedDelete = deleteGifticon as jest.Mock;
const mockedCancel = cancelNotifications as jest.Mock;
const mockedAddUsage = addGifticonUsageRecord as jest.Mock;
const mockedAddUsageAndClose = addGifticonUsageRecordAndClose as jest.Mock;
const mockedRemoveUsage = removeGifticonUsageRecord as jest.Mock;

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
  mockedAddUsage.mockResolvedValue(undefined);
  mockedAddUsageAndClose.mockResolvedValue(undefined);
  mockedRemoveUsage.mockResolvedValue(undefined);
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

describe('recordGifticonUsage', () => {
  const cardGifticon = { ...gifticon, amount: 10000, isUsed: false, usageHistory: [] };
  const record = { id: 'u1', amount: 3000, usedAt: '2026-01-01T00:00:00.000Z' };

  it('logs a partial spend without closing the gifticon out', async () => {
    await recordGifticonUsage(cardGifticon, record, 'owner');

    expect(mockedAddUsage).toHaveBeenCalledWith('g1', record);
    expect(mockedAddUsageAndClose).not.toHaveBeenCalled();
    expect(mockedMarkUsed).not.toHaveBeenCalled();
    expect(mockedCancel).not.toHaveBeenCalled();
  });

  it('closes the gifticon out atomically once the spend exhausts the remaining balance', async () => {
    const almostSpent = {
      ...cardGifticon,
      usageHistory: [{ id: 'u0', amount: 7000, usedAt: 't0' }],
    };

    await recordGifticonUsage(almostSpent, record, 'owner');

    expect(mockedAddUsageAndClose).toHaveBeenCalledWith('g1', record);
    expect(mockedAddUsage).not.toHaveBeenCalled();
    // The atomic write already sets isUsed — markGifticonUsed is a separate,
    // unrelated write path and must not also fire.
    expect(mockedMarkUsed).not.toHaveBeenCalled();
    expect(mockedCancel).toHaveBeenCalledWith(['n1', 'n2']);
  });

  it('does not cancel reminders on close-out when a non-owner logged the spend', async () => {
    const almostSpent = {
      ...cardGifticon,
      usageHistory: [{ id: 'u0', amount: 7000, usedAt: 't0' }],
    };

    await recordGifticonUsage(almostSpent, record, 'someone-else');

    expect(mockedAddUsageAndClose).toHaveBeenCalledWith('g1', record);
    expect(mockedCancel).not.toHaveBeenCalled();
  });

  it('rejects a non-positive amount without writing anything', async () => {
    await expect(
      recordGifticonUsage(cardGifticon, { ...record, amount: 0 }, 'owner'),
    ).rejects.toThrow('remaining balance');
    expect(mockedAddUsage).not.toHaveBeenCalled();
    expect(mockedAddUsageAndClose).not.toHaveBeenCalled();
  });

  it('rejects an amount larger than what remains', async () => {
    await expect(
      recordGifticonUsage(cardGifticon, { ...record, amount: 10001 }, 'owner'),
    ).rejects.toThrow('remaining balance');
    expect(mockedAddUsage).not.toHaveBeenCalled();
  });

  it('rejects any amount once the gifticon is already fully used', async () => {
    const used = { ...cardGifticon, isUsed: true };

    await expect(recordGifticonUsage(used, { ...record, amount: 1 }, 'owner')).rejects.toThrow(
      'remaining balance',
    );
    expect(mockedAddUsage).not.toHaveBeenCalled();
  });
});

describe('deleteGifticonUsageRecord', () => {
  it('removes the record and leaves isUsed untouched', async () => {
    await deleteGifticonUsageRecord('g1', { id: 'u1', amount: 3000, usedAt: 't1' });

    expect(mockedRemoveUsage).toHaveBeenCalledWith('g1', {
      id: 'u1',
      amount: 3000,
      usedAt: 't1',
    });
    expect(mockedMarkUsed).not.toHaveBeenCalled();
  });

  it('propagates a failure of the removal itself', async () => {
    mockedRemoveUsage.mockRejectedValue(new Error('remove failed'));

    await expect(
      deleteGifticonUsageRecord('g1', { id: 'u1', amount: 3000, usedAt: 't1' }),
    ).rejects.toThrow('remove failed');
  });
});
