import { parseExpiryDateFromText } from './dateParser';

function isoDate(year: number, month: number, day: number): string {
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

describe('parseExpiryDateFromText', () => {
  it('parses a dot-separated date next to an expiry keyword', () => {
    const text = '스타벅스 아메리카노\n유효기간 2026.03.15\n교환처: 전국 매장';
    expect(parseExpiryDateFromText(text)).toBe(isoDate(2026, 3, 15));
  });

  it('parses a dash-separated date', () => {
    const text = '유효기한: 2025-12-31까지 사용 가능';
    expect(parseExpiryDateFromText(text)).toBe(isoDate(2025, 12, 31));
  });

  it('parses a Korean-style date with 년/월/일', () => {
    const text = '2026년 7월 4일까지 사용해주세요';
    expect(parseExpiryDateFromText(text)).toBe(isoDate(2026, 7, 4));
  });

  it('falls back to the single date found when no keyword is nearby', () => {
    const text = '주문번호 12345\n2026.09.01\n금액 5000원';
    expect(parseExpiryDateFromText(text)).toBe(isoDate(2026, 9, 1));
  });

  it('takes the latest date when several are present and no keyword resolves it', () => {
    // An expiry is never earlier than the issue date, so the latest wins —
    // better than giving up and letting the caller invent a default.
    const text = '발행일 2026.01.01\n안내\n2026.06.30\n2026.03.15';
    expect(parseExpiryDateFromText(text)).toBe(isoDate(2026, 6, 30));
  });

  it('picks the keyword-adjacent date when multiple dates are present', () => {
    const text = '발행일 2026.01.01\n유효기한 2026.06.30까지';
    expect(parseExpiryDateFromText(text)).toBe(isoDate(2026, 6, 30));
  });

  it('reads a 2-digit year as 20xx', () => {
    expect(parseExpiryDateFromText('유효기한 26.12.31까지')).toBe(isoDate(2026, 12, 31));
    expect(parseExpiryDateFromText("유효기간 '27.03.01")).toBe(isoDate(2027, 3, 1));
  });

  it('tolerates spaces around the separators', () => {
    expect(parseExpiryDateFromText('유효기간 2026. 12. 31')).toBe(isoDate(2026, 12, 31));
    expect(parseExpiryDateFromText('유효기간 2026 . 12 . 31')).toBe(isoDate(2026, 12, 31));
  });

  it('reads a day-less month as the last day of that month, when an expiry keyword is next to it', () => {
    expect(parseExpiryDateFromText('유효기간 2026.12')).toBe(isoDate(2026, 12, 31));
    expect(parseExpiryDateFromText('유효기간 2026년 2월')).toBe(isoDate(2026, 2, 28));
  });

  it('does not read a bare month/year with no expiry keyword as a date', () => {
    expect(parseExpiryDateFromText('2026.12 신메뉴 출시')).toBeNull();
    expect(parseExpiryDateFromText('평점 4.5 / 리뷰 39.9만')).toBeNull();
  });

  it('prefers the full date over a day-less reading of the same text', () => {
    expect(parseExpiryDateFromText('유효기간 2026.12.05')).toBe(isoDate(2026, 12, 5));
  });

  it('returns null when no date-like text is found', () => {
    expect(parseExpiryDateFromText('스타벅스 아메리카노 Tall')).toBeNull();
  });

  it('rejects an invalid month/day', () => {
    expect(parseExpiryDateFromText('2026.13.40')).toBeNull();
  });

  it('rejects a day that does not exist in that month (2026.02.30)', () => {
    expect(parseExpiryDateFromText('유효기한 2026.02.30까지')).toBeNull();
  });

  it('accepts a valid leap day', () => {
    expect(parseExpiryDateFromText('유효기한 2028.02.29까지')).toBe(isoDate(2028, 2, 29));
  });
});
