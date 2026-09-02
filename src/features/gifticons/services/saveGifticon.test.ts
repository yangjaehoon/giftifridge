import { createGifticon, updateGifticon, uploadGifticonImage } from './gifticonService';
import { saveGifticon } from './saveGifticon';

jest.mock('./gifticonService', () => ({
  createGifticon: jest.fn(),
  updateGifticon: jest.fn(),
  uploadGifticonImage: jest.fn(),
}));

const mockedCreate = createGifticon as jest.Mock;
const mockedUpdate = updateGifticon as jest.Mock;
const mockedUpload = uploadGifticonImage as jest.Mock;

const fields = {
  name: '아메리카노',
  brand: '스타벅스',
  category: 'cafe' as const,
  expiresAt: '2026-08-01',
};

beforeEach(() => {
  jest.clearAllMocks();
  mockedUpload.mockResolvedValue('https://storage/gifticons/x.jpg');
  mockedCreate.mockImplementation(async (id: string) => id);
  mockedUpdate.mockResolvedValue(undefined);
});

describe('saveGifticon', () => {
  it('uploads the image then creates a new doc at the draft id', async () => {
    const id = await saveGifticon({
      draftId: 'draft-1',
      ownerId: 'owner-1',
      imageUri: 'file:///photo.jpg',
      imageChanged: true,
      fields,
    });

    expect(mockedUpload).toHaveBeenCalledWith('draft-1', 'file:///photo.jpg');
    expect(mockedCreate).toHaveBeenCalledWith(
      'draft-1',
      'owner-1',
      expect.objectContaining({ ...fields, imageUrl: 'https://storage/gifticons/x.jpg' }),
    );
    expect(mockedUpdate).not.toHaveBeenCalled();
    expect(id).toBe('draft-1');
  });

  it('updates the existing doc and uploads under the editing id', async () => {
    const id = await saveGifticon({
      editingId: 'g-9',
      draftId: 'draft-1',
      ownerId: 'owner-1',
      imageUri: 'file:///new.jpg',
      imageChanged: true,
      fields,
    });

    expect(mockedUpload).toHaveBeenCalledWith('g-9', 'file:///new.jpg');
    expect(mockedUpdate).toHaveBeenCalledWith(
      'g-9',
      expect.objectContaining({ imageUrl: expect.any(String) }),
    );
    expect(mockedCreate).not.toHaveBeenCalled();
    expect(id).toBe('g-9');
  });

  it('reuses the existing image url when the image did not change', async () => {
    await saveGifticon({
      editingId: 'g-9',
      draftId: 'draft-1',
      ownerId: 'owner-1',
      imageUri: 'https://storage/gifticons/g-9.jpg',
      imageChanged: false,
      fields,
    });

    expect(mockedUpload).not.toHaveBeenCalled();
    expect(mockedUpdate).toHaveBeenCalledWith(
      'g-9',
      expect.objectContaining({ imageUrl: 'https://storage/gifticons/g-9.jpg' }),
    );
  });
});
