import { parseAmountFromText } from './amountParser';

describe('parseAmountFromText', () => {
  it('parses a comma-grouped amount next to a keyword', () => {
    expect(parseAmountFromText('금액 10,000원')).toBe(10000);
  });

  it('parses a plain (non-grouped) amount', () => {
    expect(parseAmountFromText('정가 5000원')).toBe(5000);
  });

  it('falls back to the single amount found when no keyword is nearby', () => {
    expect(parseAmountFromText('아메리카노 Tall\n4,500원\n유효기간 2026.12.31까지')).toBe(4500);
  });

  it('returns null when multiple amounts are ambiguous with no keyword hint', () => {
    expect(parseAmountFromText('10,000원\n3,000원 할인')).toBeNull();
  });

  it('picks the keyword-adjacent amount when multiple are present', () => {
    const text = '정가 10,000원\n이 상품은 매장에서 바로 교환 가능한 모바일 쿠폰입니다\n7,000원';
    expect(parseAmountFromText(text)).toBe(10000);
  });

  it('returns null when no amount-like text is found', () => {
    expect(parseAmountFromText('스타벅스 아메리카노 Tall')).toBeNull();
  });

  it('parses a ₩-prefixed amount', () => {
    expect(parseAmountFromText('충전금액 ₩30,000')).toBe(30000);
  });

  it('parses Korean-numeral face values (만 / 천)', () => {
    expect(parseAmountFromText('문화상품권 5만원권')).toBe(50000);
    expect(parseAmountFromText('금액 1만 5천원')).toBe(15000);
    expect(parseAmountFromText('커피 교환권 5천원')).toBe(5000);
  });

  it('does not read a 만/천 count with no 원 as a price', () => {
    expect(parseAmountFromText('누적 다운로드 5만 돌파')).toBeNull();
  });

  it('rejects an amount outside the plausible face-value range', () => {
    expect(parseAmountFromText('경품 100,000,000원')).toBeNull();
    expect(parseAmountFromText('봉투 50원')).toBeNull();
  });
});
