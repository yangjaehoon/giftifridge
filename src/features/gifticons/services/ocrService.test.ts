import TextRecognition from '@react-native-ml-kit/text-recognition';
import { parseExpiryDateFromText, recognizeExpiryDate } from './ocrService';

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

describe('recognizeExpiryDate', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('runs OCR with the Korean script and parses the recognized text', async () => {
    mockedRecognize.mockResolvedValue({ text: '유효기간 2026.03.15' });

    await expect(recognizeExpiryDate('file:///gifticon.jpg')).resolves.toBe(isoDate(2026, 3, 15));
    expect(mockedRecognize).toHaveBeenCalledWith('file:///gifticon.jpg', 'korean');
  });

  it('returns null when OCR throws', async () => {
    mockedRecognize.mockRejectedValue(new Error('ml kit unavailable'));

    await expect(recognizeExpiryDate('file:///gifticon.jpg')).resolves.toBeNull();
  });

  it('returns null when the recognized text has no parseable date', async () => {
    mockedRecognize.mockResolvedValue({ text: '스타벅스 아메리카노' });

    await expect(recognizeExpiryDate('file:///gifticon.jpg')).resolves.toBeNull();
  });
});
