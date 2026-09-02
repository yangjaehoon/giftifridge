import { confirmAsync } from '../../../shared/utils/confirmAsync';
import { saveGifticon } from './saveGifticon';
import { syncGifticonReminders } from './gifticonReminders';
import { submitGifticon } from './submitGifticon';
import type { Gifticon } from '../types';

jest.mock('../../../shared/utils/confirmAsync', () => ({ confirmAsync: jest.fn() }));
jest.mock('./saveGifticon', () => ({ saveGifticon: jest.fn() }));
jest.mock('./gifticonReminders', () => ({ syncGifticonReminders: jest.fn() }));

const mockedConfirm = confirmAsync as jest.Mock;
const mockedSave = saveGifticon as jest.Mock;
const mockedSync = syncGifticonReminders as jest.Mock;

const fields = {
  name: '아메리카노',
  brand: '스타벅스',
  category: 'cafe' as const,
  expiresAt: '2026-08-01',
};

function baseInput(overrides: Partial<Parameters<typeof submitGifticon>[0]> = {}) {
  return {
    existing: null,
    draftId: 'draft-1',
    ownerId: 'owner-1',
    imageUri: 'file:///photo.jpg',
    imageChanged: true,
    fields,
    siblings: [] as Gifticon[],
    ...overrides,
  };
}

const existing: Gifticon = {
  id: 'g-9',
  ownerId: 'owner-1',
  name: '옛이름',
  brand: '옛브랜드',
  category: 'cafe',
  imageUrl: 'https://storage/gifticons/g-9.jpg',
  expiresAt: '2026-01-01',
  isUsed: false,
  createdAt: '2025-12-01T00:00:00.000Z',
  notificationIds: ['n1'],
};

beforeEach(() => {
  jest.clearAllMocks();
  mockedSave.mockResolvedValue('draft-1');
  mockedSync.mockResolvedValue(undefined);
  mockedConfirm.mockResolvedValue(true);
});

describe('submitGifticon — create path', () => {
  it('saves at the draft id and schedules reminders as the owner', async () => {
    const result = await submitGifticon(baseInput({ spaceId: 'space-1' }));

    expect(mockedSave).toHaveBeenCalledWith({
      editingId: undefined,
      draftId: 'draft-1',
      ownerId: 'owner-1',
      imageUri: 'file:///photo.jpg',
      imageChanged: true,
      fields: { ...fields, spaceId: 'space-1' },
    });
    expect(mockedSync).toHaveBeenCalledWith({
      gifticon: { id: 'draft-1', name: '아메리카노', brand: '스타벅스', expiresAt: '2026-08-01' },
      isOwner: true,
      isEditing: false,
      previousNotificationIds: undefined,
    });
    expect(result).toEqual({ status: 'saved', id: 'draft-1' });
  });

  it('does not prompt when no barcode is set', async () => {
    await submitGifticon(baseInput());
    expect(mockedConfirm).not.toHaveBeenCalled();
  });
});

describe('submitGifticon — edit path', () => {
  it('updates the existing doc and carries its previous notification ids', async () => {
    mockedSave.mockResolvedValue('g-9');

    const result = await submitGifticon(baseInput({ existing }));

    expect(mockedSave).toHaveBeenCalledWith(expect.objectContaining({ editingId: 'g-9' }));
    expect(mockedSync).toHaveBeenCalledWith(
      expect.objectContaining({
        isEditing: true,
        isOwner: true,
        previousNotificationIds: ['n1'],
      }),
    );
    expect(result).toEqual({ status: 'saved', id: 'g-9' });
  });

  it('marks a non-owner editor so reminders are left alone', async () => {
    await submitGifticon(baseInput({ existing: { ...existing, ownerId: 'someone-else' } }));

    expect(mockedSync).toHaveBeenCalledWith(expect.objectContaining({ isOwner: false }));
  });
});

describe('submitGifticon — duplicate barcode', () => {
  const withBarcode = { ...fields, barcode: '123456' };
  const clash: Gifticon = { ...existing, id: 'other', brand: 'B', name: 'N', barcode: '123456' };

  it('asks to confirm and proceeds when the user accepts', async () => {
    mockedConfirm.mockResolvedValue(true);

    const result = await submitGifticon(baseInput({ fields: withBarcode, siblings: [clash] }));

    expect(mockedConfirm).toHaveBeenCalledWith(
      '이미 등록된 번호예요',
      expect.stringContaining('B N'),
    );
    expect(mockedSave).toHaveBeenCalled();
    expect(result).toEqual({ status: 'saved', id: 'draft-1' });
  });

  it('aborts without saving when the user declines', async () => {
    mockedConfirm.mockResolvedValue(false);

    const result = await submitGifticon(baseInput({ fields: withBarcode, siblings: [clash] }));

    expect(result).toEqual({ status: 'cancelled' });
    expect(mockedSave).not.toHaveBeenCalled();
    expect(mockedSync).not.toHaveBeenCalled();
  });

  it('does not treat the gifticon being edited as its own duplicate', async () => {
    await submitGifticon(
      baseInput({
        existing: { ...existing, barcode: '123456' },
        fields: withBarcode,
        siblings: [{ ...existing, barcode: '123456' }],
      }),
    );

    expect(mockedConfirm).not.toHaveBeenCalled();
    expect(mockedSave).toHaveBeenCalled();
  });

  it('does not prompt when the barcode is unique among siblings', async () => {
    await submitGifticon(
      baseInput({ fields: withBarcode, siblings: [{ ...clash, barcode: '999' }] }),
    );

    expect(mockedConfirm).not.toHaveBeenCalled();
    expect(mockedSave).toHaveBeenCalled();
  });
});

describe('submitGifticon — failures', () => {
  it('propagates a save failure', async () => {
    mockedSave.mockRejectedValue(new Error('write failed'));

    await expect(submitGifticon(baseInput())).rejects.toThrow('write failed');
    expect(mockedSync).not.toHaveBeenCalled();
  });
});
