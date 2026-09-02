import { createGifticon, markGifticonUsed, newGifticonId } from './gifticonService';
import { DUMMY_GIFTICON_COUNT, seedDummyGifticons } from './devSeed';

jest.mock('./gifticonService', () => ({
  createGifticon: jest.fn(),
  markGifticonUsed: jest.fn(),
  newGifticonId: jest.fn(),
}));

const mockedCreate = createGifticon as jest.Mock;
const mockedMarkUsed = markGifticonUsed as jest.Mock;
const mockedNewId = newGifticonId as jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
  let counter = 0;
  mockedNewId.mockImplementation(() => `seed-id-${counter++}`);
  mockedCreate.mockImplementation(async (id: string) => id);
  mockedMarkUsed.mockResolvedValue(undefined);
});

describe('seedDummyGifticons', () => {
  it('creates one gifticon per dummy entry and reports them all as succeeded', async () => {
    const result = await seedDummyGifticons('owner-1');

    expect(mockedCreate).toHaveBeenCalledTimes(DUMMY_GIFTICON_COUNT);
    expect(result).toEqual({ succeeded: DUMMY_GIFTICON_COUNT, failed: 0 });
  });

  it('passes the ownerId through and never leaks the internal "used" flag into the payload', async () => {
    await seedDummyGifticons('owner-1');

    for (const call of mockedCreate.mock.calls) {
      const [, ownerId, data] = call;
      expect(ownerId).toBe('owner-1');
      expect(data).not.toHaveProperty('used');
      expect(typeof data.expiresAt).toBe('string');
      expect(data.imageUrl).toMatch(/^https:\/\/picsum\.photos\/seed\//);
    }
  });

  it('marks every 5th seeded gifticon as used', async () => {
    await seedDummyGifticons('owner-1');

    // i % 5 === 0 over 0..99 -> 20 entries.
    expect(mockedMarkUsed).toHaveBeenCalledTimes(DUMMY_GIFTICON_COUNT / 5);
    expect(mockedMarkUsed).toHaveBeenCalledWith(expect.any(String), true);
  });

  it('counts individual write failures without rejecting', async () => {
    mockedCreate.mockReset();
    let call = 0;
    mockedCreate.mockImplementation(async (id: string) => {
      call += 1;
      if (call <= 3) throw new Error('write failed');
      return id;
    });

    const result = await seedDummyGifticons('owner-1');

    expect(result.failed).toBe(3);
    expect(result.succeeded).toBe(DUMMY_GIFTICON_COUNT - 3);
  });
});
