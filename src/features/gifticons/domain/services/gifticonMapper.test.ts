import { omitUndefined, toGifticon } from './gifticonMapper';

function storedDoc(overrides: Record<string, unknown> = {}) {
  return {
    ownerId: 'owner-1',
    name: '아메리카노',
    brand: '스타벅스',
    category: 'cafe',
    imageUrl: 'https://storage.example/gifticons/x.jpg',
    expiresAt: '2026-08-01',
    isUsed: false,
    createdAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

describe('omitUndefined', () => {
  it('drops keys whose value is undefined and keeps the rest (including null/0/"")', () => {
    expect(omitUndefined({ a: 1, b: undefined, c: null, d: 0, e: '' })).toEqual({
      a: 1,
      c: null,
      d: 0,
      e: '',
    });
  });
});

describe('toGifticon', () => {
  it('returns the doc with its id when every required field is a valid string', () => {
    expect(toGifticon('g-1', storedDoc({ name: 'x' }))).toEqual(
      expect.objectContaining({ id: 'g-1', name: 'x' }),
    );
  });

  it('returns null when a required string field is missing', () => {
    for (const missing of ['ownerId', 'name', 'brand', 'category', 'imageUrl', 'expiresAt']) {
      const doc = storedDoc();
      delete (doc as Record<string, unknown>)[missing];
      expect(toGifticon('g-1', doc)).toBeNull();
    }
  });

  it('returns null when expiresAt is not a parseable date', () => {
    expect(toGifticon('g-1', storedDoc({ expiresAt: 'not-a-date' }))).toBeNull();
  });
});
