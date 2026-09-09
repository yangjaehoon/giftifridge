import AsyncStorage from '@react-native-async-storage/async-storage';
import { gifticonListCache, readCachedBarcodes, readCachedGifticon } from './gifticonCache';
import type { Gifticon } from '../types';

jest.mock('@react-native-async-storage/async-storage', () =>
  jest.requireActual('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

function makeGifticon(id: string, extra: Partial<Gifticon> = {}): Gifticon {
  return {
    id,
    ownerId: 'owner',
    name: '아메리카노',
    brand: '스타벅스',
    category: 'cafe',
    imageUrl: 'https://example/x.jpg',
    expiresAt: '2026-12-31',
    isUsed: false,
    createdAt: '2026-01-01T00:00:00.000Z',
    barcode: `bc-${id}`,
    ...extra,
  };
}

beforeEach(async () => {
  await AsyncStorage.clear();
});

describe('gifticonListCache', () => {
  it('round-trips a list for a scope', async () => {
    const cache = gifticonListCache('owner');
    const items = [makeGifticon('a'), makeGifticon('b')];

    cache.write('owner-1', items);
    await new Promise((r) => setImmediate(r)); // write is fire-and-forget

    expect(await cache.read('owner-1')).toEqual(items);
  });

  it('keeps owner and space scopes separate', async () => {
    gifticonListCache('owner').write('k', [makeGifticon('owned')]);
    gifticonListCache('space').write('k', [makeGifticon('shared')]);
    await new Promise((r) => setImmediate(r));

    expect(await gifticonListCache('owner').read('k')).toEqual([makeGifticon('owned')]);
    expect(await gifticonListCache('space').read('k')).toEqual([makeGifticon('shared')]);
  });

  it('returns null for a missing key and for corrupt data', async () => {
    const cache = gifticonListCache('owner');
    expect(await cache.read('never-written')).toBeNull();

    await AsyncStorage.setItem('gifticonCache:owner:bad', '{not json');
    expect(await cache.read('bad')).toBeNull();
  });

  it('drops entries that are not valid gifticons (e.g. an older schema)', async () => {
    await AsyncStorage.setItem(
      'gifticonCache:owner:mixed',
      JSON.stringify([
        makeGifticon('good'),
        { id: 'no-owner', name: 'x' }, // missing required fields
        { ...makeGifticon('bad-date'), expiresAt: 'not-a-date' },
      ]),
    );
    expect(await gifticonListCache('owner').read('mixed')).toEqual([makeGifticon('good')]);
  });

  it('caps the stored list', async () => {
    const cache = gifticonListCache('owner');
    const many = Array.from({ length: 350 }, (_, i) => makeGifticon(`g${i}`));

    cache.write('owner-1', many);
    await new Promise((r) => setImmediate(r));

    expect((await cache.read('owner-1'))?.length).toBe(300);
  });
});

describe('readCachedGifticon', () => {
  it('finds a gifticon by id across every cached list', async () => {
    gifticonListCache('owner').write('o1', [makeGifticon('a'), makeGifticon('b')]);
    gifticonListCache('space').write('s1', [makeGifticon('c', { barcode: 'shared-bc' })]);
    await new Promise((r) => setImmediate(r));

    expect(await readCachedGifticon('b')).toMatchObject({ id: 'b', barcode: 'bc-b' });
    expect(await readCachedGifticon('c')).toMatchObject({ id: 'c', barcode: 'shared-bc' });
  });

  it('returns null when the id is in no cached list', async () => {
    gifticonListCache('owner').write('o1', [makeGifticon('a')]);
    await new Promise((r) => setImmediate(r));

    expect(await readCachedGifticon('missing')).toBeNull();
  });

  it('returns null when nothing has been cached', async () => {
    expect(await readCachedGifticon('anything')).toBeNull();
  });
});

describe('readCachedBarcodes', () => {
  it('collects non-empty barcodes across every cached list', async () => {
    gifticonListCache('owner').write('o1', [
      makeGifticon('a', { barcode: '111' }),
      makeGifticon('b', { barcode: undefined }),
    ]);
    gifticonListCache('space').write('s1', [makeGifticon('c', { barcode: '222' })]);
    await new Promise((r) => setImmediate(r));

    const set = await readCachedBarcodes();
    expect([...set].sort()).toEqual(['111', '222']);
  });

  it('returns an empty set when nothing is cached', async () => {
    expect((await readCachedBarcodes()).size).toBe(0);
  });
});
