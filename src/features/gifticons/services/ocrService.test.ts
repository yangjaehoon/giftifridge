import TextRecognition from '@react-native-ml-kit/text-recognition';
import {
  guessGifticonFields,
  parseAmountFromText,
  parseExpiryDateFromText,
  recognizeText,
} from './ocrService';

jest.mock('@react-native-ml-kit/text-recognition', () => ({
  __esModule: true,
  default: { recognize: jest.fn() },
  TextRecognitionScript: { KOREAN: 'korean' },
}));

const mockedRecognize = TextRecognition.recognize as jest.Mock;

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

  it('returns null when multiple dates are ambiguous with no keyword hint', () => {
    const text = '발행일 2026.01.01\n2026.06.30';
    expect(parseExpiryDateFromText(text)).toBeNull();
  });

  it('picks the keyword-adjacent date when multiple dates are present', () => {
    const text = '발행일 2026.01.01\n유효기한 2026.06.30까지';
    expect(parseExpiryDateFromText(text)).toBe(isoDate(2026, 6, 30));
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

describe('guessGifticonFields', () => {
  it('reads the first two clean lines as (brand, name) and includes its category', () => {
    const text = '스타벅스\n아메리카노 Tall\n유효기간 2026.12.31까지\n바코드 8801234567890';
    expect(guessGifticonFields(text)).toEqual({
      brand: '스타벅스',
      name: '아메리카노 Tall',
      category: 'cafe',
    });
  });

  it('skips boilerplate, date, and barcode-like lines', () => {
    const text = [
      '기프티콘',
      '교환권 안내',
      '이디야',
      '아메리카노',
      '유효기간 2026.12.31까지',
    ].join('\n');
    expect(guessGifticonFields(text)).toEqual({
      brand: '이디야',
      name: '아메리카노',
      category: 'cafe',
    });
  });

  it('returns null name when only one usable line is found', () => {
    expect(guessGifticonFields('스타벅스\n유효기간 2026.12.31까지')).toEqual({
      brand: '스타벅스',
      name: null,
      category: 'cafe',
    });
  });

  it('returns null brand/name/category when nothing usable is found', () => {
    expect(guessGifticonFields('기프티콘\n유효기간 2026.12.31까지\n8801234567890')).toEqual({
      brand: null,
      name: null,
      category: null,
    });
  });

  it('has no category for an unlisted brand — the position guess only covers brand/name', () => {
    const text = 'CUP 사이즈 안내\n딸기 스무디\n유효기간 2026.12.31까지';
    // "CU" must not match inside "CUP" — falls back to the position guess.
    expect(guessGifticonFields(text)).toEqual({
      brand: 'CUP 사이즈 안내',
      name: '딸기 스무디',
      category: null,
    });
  });

  it('keeps a short brand name that happens to contain a couple of digits', () => {
    const text = 'GS25\n연세우유 크림빵\n유효기간 2026.12.31까지';
    expect(guessGifticonFields(text)).toEqual({
      brand: 'GS25',
      name: '연세우유 크림빵',
      category: 'convenience',
    });
  });

  it('finds a known brand regardless of which line it appears on', () => {
    // Name first, brand second — the opposite of the usual layout assumption.
    const text = '아메리카노 Tall\n스타벅스\n유효기간 2026.12.31까지';
    expect(guessGifticonFields(text)).toEqual({
      brand: '스타벅스',
      name: '아메리카노 Tall',
      category: 'cafe',
    });
  });

  it('finds a known brand even inside an otherwise-noisy line', () => {
    const text = '아메리카노 Tall\n전국 스타벅스 매장에서 교환 가능\n유효기간 2026.12.31까지';
    expect(guessGifticonFields(text)).toEqual({
      brand: '스타벅스',
      name: '아메리카노 Tall',
      category: 'cafe',
    });
  });

  it('matches a known brand case- and spacing-insensitively', () => {
    const text = 'b h c\n순살치킨\n유효기간 2026.12.31까지';
    expect(guessGifticonFields(text)).toEqual({
      brand: 'bhc',
      name: '순살치킨',
      category: 'restaurant',
    });
  });

  it('recognizes brands from the newer categories (pizza, dessert, bookstore)', () => {
    expect(guessGifticonFields('도미노피자\n페퍼로니 라지\n유효기간 2026.12.31까지')).toEqual({
      brand: '도미노피자',
      name: '페퍼로니 라지',
      category: 'restaurant',
    });
    expect(guessGifticonFields('설빙\n인절미설빙\n유효기간 2026.12.31까지')).toEqual({
      brand: '설빙',
      name: '인절미설빙',
      category: 'cafe',
    });
    expect(guessGifticonFields('교보문고\n도서상품권\n유효기간 2026.12.31까지')).toEqual({
      brand: '교보문고',
      name: '도서상품권',
      category: 'culture',
    });
  });
});

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

describe('recognizeText', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('runs OCR with the Korean script and returns the recognized text', async () => {
    mockedRecognize.mockResolvedValue({ text: '유효기간 2026.03.15' });

    await expect(recognizeText('file:///gifticon.jpg')).resolves.toBe('유효기간 2026.03.15');
    expect(mockedRecognize).toHaveBeenCalledWith('file:///gifticon.jpg', 'korean');
  });

  it('returns null when OCR throws', async () => {
    mockedRecognize.mockRejectedValue(new Error('ml kit unavailable'));

    await expect(recognizeText('file:///gifticon.jpg')).resolves.toBeNull();
  });
});
