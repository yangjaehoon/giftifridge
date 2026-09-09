import { lookupEstimatedPrice } from './menuPrices';

describe('lookupEstimatedPrice', () => {
  it('matches a known cafe drink from brand + name', () => {
    expect(lookupEstimatedPrice('스타벅스', '아이스 카페 아메리카노 T')).toEqual({
      price: 4700,
      asOf: '2026년',
    });
  });

  it('is brand-specific: the same drink name resolves to that brand price', () => {
    expect(lookupEstimatedPrice('이디야커피', '아메리카노')?.price).toBe(3200);
    expect(lookupEstimatedPrice('메가MGC커피', '(ICE)아메리카노')?.price).toBe(2000);
  });

  it('prefers the most specific keyword when several match', () => {
    // "아메리카노" and "아메리카노grande" both match; the longer one wins.
    expect(lookupEstimatedPrice('스타벅스', '카페 아메리카노 GRANDE')?.price).toBe(5300);
  });

  it('matches chicken by brand + signature menu', () => {
    expect(lookupEstimatedPrice('BHC', '뿌링클+콜라1.25L')?.price).toBe(21000);
    expect(lookupEstimatedPrice('교촌치킨', '허니콤보')?.price).toBe(23000);
  });

  it('matches ignoring spacing and case', () => {
    expect(lookupEstimatedPrice(' 스타 벅스 ', '카 페 라 떼')?.price).toBe(5200);
  });

  it('returns null when the brand is unknown', () => {
    expect(lookupEstimatedPrice('동네카페', '아메리카노')).toBeNull();
  });

  it('returns null when the item is not in the table', () => {
    expect(lookupEstimatedPrice('스타벅스', '한정판 굿즈 텀블러')).toBeNull();
  });

  it('returns null for empty input', () => {
    expect(lookupEstimatedPrice('', '아메리카노')).toBeNull();
    expect(lookupEstimatedPrice('스타벅스', '')).toBeNull();
  });
});
