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
});
