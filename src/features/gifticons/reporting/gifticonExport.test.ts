import { Share } from 'react-native';
import { buildGifticonCsv, exportGifticons } from './gifticonExport';
import type { Gifticon } from '../domain/types';

function g(overrides: Partial<Gifticon> & { id: string }): Gifticon {
  return {
    ownerId: 'u1',
    name: '아메리카노',
    brand: '스타벅스',
    category: 'cafe',
    imageUrl: 'https://x/y.jpg',
    expiresAt: '2027-01-10',
    isUsed: false,
    createdAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

describe('buildGifticonCsv', () => {
  it('emits a header row and one CRLF-separated row per gifticon', () => {
    const csv = buildGifticonCsv([
      g({ id: 'a', name: '아메리카노', brand: '스타벅스' }),
      g({ id: 'b', name: '라떼', brand: '이디야' }),
    ]);
    const lines = csv.split('\r\n');
    expect(lines[0]).toBe(
      '상품명,브랜드,카테고리,금액,잔액,유효기한,상태,바코드,메모,등록일,사용일',
    );
    expect(lines).toHaveLength(3);
    expect(lines[1]).toBe('아메리카노,스타벅스,카페,,,2027-01-10,사용가능,,,2026.01.01,');
  });

  it('writes the remaining balance for an amount-based gifticon and the used date', () => {
    const csv = buildGifticonCsv([
      g({
        id: 'a',
        amount: 10000,
        usageHistory: [{ id: 'r1', amount: 3000, usedAt: '2026-02-02T00:00:00.000Z' }],
        isUsed: true,
        usedAt: '2026-03-03T00:00:00.000Z',
      }),
    ]);
    const cells = csv.split('\r\n')[1].split(',');
    expect(cells[3]).toBe('10000'); // 금액
    expect(cells[4]).toBe('0'); // 잔액 — isUsed wins
    expect(cells[6]).toBe('사용완료'); // 상태
    expect(cells[10]).toBe('2026.03.03'); // 사용일
  });

  it('quotes a field containing a comma, quote, or newline', () => {
    const csv = buildGifticonCsv([g({ id: 'a', memo: 'a, b "c"\nd' })]);
    expect(csv.split('\r\n')[1]).toContain('"a, b ""c""\nd"');
  });

  it('marks a past-dated unused gifticon as 만료', () => {
    const csv = buildGifticonCsv([g({ id: 'a', expiresAt: '2000-01-01' })]);
    expect(csv.split('\r\n')[1].split(',')[6]).toBe('만료');
  });
});

describe('exportGifticons', () => {
  afterEach(() => jest.restoreAllMocks());

  it('returns "empty" and never opens the share sheet with no items', async () => {
    const share = jest.spyOn(Share, 'share');
    await expect(exportGifticons([])).resolves.toBe('empty');
    expect(share).not.toHaveBeenCalled();
  });

  it('shares a BOM-prefixed CSV and reports completion', async () => {
    const share = jest
      .spyOn(Share, 'share')
      .mockResolvedValue({ action: Share.sharedAction } as never);

    await expect(exportGifticons([g({ id: 'a' })])).resolves.toBe('shared');
    const [content] = share.mock.calls[0];
    expect((content as { message: string }).message.charCodeAt(0)).toBe(0xfeff);
    expect((content as { message: string }).message).toContain('상품명,브랜드');
  });

  it('reports "dismissed" when the user closes the share sheet', async () => {
    jest.spyOn(Share, 'share').mockResolvedValue({ action: Share.dismissedAction } as never);
    await expect(exportGifticons([g({ id: 'a' })])).resolves.toBe('dismissed');
  });
});
