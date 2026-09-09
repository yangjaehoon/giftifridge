import { parseBarcodeFromText, parseBarcodeResult } from './barcodeParser';

describe('parseBarcodeFromText', () => {
  it('parses a long digit run next to the 바코드 keyword', () => {
    expect(parseBarcodeFromText('바코드 8801234567890123')).toBe('8801234567890123');
  });

  it('falls back to the single long digit run found when no keyword is nearby', () => {
    expect(parseBarcodeFromText('스타벅스\n아메리카노 Tall\n8801234567890')).toBe('8801234567890');
  });

  it('joins a space-grouped barcode number OCR read in 4-digit chunks', () => {
    expect(parseBarcodeFromText('주문번호\n2226 1288 9031\n공유')).toBe('222612889031');
  });

  it('joins a hyphen-grouped barcode number', () => {
    expect(parseBarcodeFromText('8801-2345-6789-0123')).toBe('8801234567890123');
  });

  it('does not treat a Korean-style spaced date as a barcode', () => {
    expect(parseBarcodeFromText('유효기간 2024 08 08 까지')).toBeNull();
  });

  it('does not join only two space-separated digit groups', () => {
    // Two unrelated 6-digit numbers a space apart total 12 digits but are not a
    // barcode; a real printed barcode number carries 3+ groups (4-4-4 / 4-4-4-4).
    expect(parseBarcodeFromText('제품코드 123456 789012')).toBeNull();
  });

  it('treats the same number printed twice on the card as one candidate', () => {
    expect(parseBarcodeFromText('8801234567890\n스타벅스\n8801234567890')).toBe('8801234567890');
  });

  it('does not mistake a comma-grouped amount for a barcode', () => {
    expect(parseBarcodeFromText('금액 10,000원')).toBeNull();
  });

  it('does not mistake a dash-separated phone number for a barcode', () => {
    expect(parseBarcodeFromText('고객센터 1544-1650')).toBeNull();
  });

  it('does not mistake an undashed Korean mobile number for a barcode', () => {
    expect(parseBarcodeFromText('연락처 01012345678')).toBeNull();
  });

  it('returns null when multiple long digit runs are ambiguous with no keyword hint', () => {
    expect(parseBarcodeFromText('8801234567890\n1234567890123456')).toBeNull();
  });

  it('returns null when no barcode-like text is found', () => {
    expect(parseBarcodeFromText('스타벅스 아메리카노 Tall')).toBeNull();
  });

  it('sets aside a run tagged as an order number when another candidate exists', () => {
    expect(parseBarcodeFromText('주문번호 100000000001\n555566667777')).toBe('555566667777');
  });

  it('still uses an order-number-tagged run when it is the only candidate', () => {
    expect(parseBarcodeFromText('주문번호 2226 1288 9031')).toBe('222612889031');
  });

  it('breaks a keyword-less tie toward the run with a valid EAN/UPC check digit', () => {
    // 4006381333931 is a valid EAN-13; 1234567890123 is not.
    expect(parseBarcodeFromText('4006381333931\n1234567890123')).toBe('4006381333931');
  });

  it('stays null when tied candidates all fail the check digit', () => {
    expect(parseBarcodeFromText('100000000001\n555566667777')).toBeNull();
  });

  describe('parseBarcodeResult (confidence)', () => {
    it('is confident when a 바코드 label anchors the run', () => {
      expect(parseBarcodeResult('바코드 8801234567890123')).toEqual({
        value: '8801234567890123',
        confident: true,
      });
    });

    it('is not confident for a lone unlabeled run', () => {
      expect(parseBarcodeResult('스타벅스\n아메리카노 Tall\n8801234567890')).toEqual({
        value: '8801234567890',
        confident: false,
      });
    });

    it('is not confident when the pick came from a check-digit tie-break', () => {
      expect(parseBarcodeResult('4006381333931\n1234567890123')).toEqual({
        value: '4006381333931',
        confident: false,
      });
    });
  });
});
