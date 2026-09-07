import { formatCorpusCase } from './debugLog';

describe('formatCorpusCase', () => {
  it('renders a paste-ready corpus case with only the fields that are present', () => {
    const out = formatCorpusCase({
      text: '스타벅스\n아메리카노 T\n유효기간 2028.12.31까지',
      isGifticon: true,
      brand: '스타벅스',
      category: 'cafe',
      expiresAt: '2028-12-31',
      barcode: '8801234567890',
      amount: null,
    });

    expect(out).toContain("id: 'TODO'");
    expect(out).toContain("'스타벅스',");
    expect(out).toContain("'유효기간 2028.12.31까지',");
    expect(out).toContain(
      "expect: { isGifticon: true, brand: '스타벅스', category: 'cafe', expiresAt: '2028-12-31', barcode: '8801234567890' },",
    );
    // null amount is omitted, not printed
    expect(out).not.toContain('amount');
  });

  it('escapes a single quote in an OCR line', () => {
    const out = formatCorpusCase({ text: "It's a gift", isGifticon: false });
    expect(out).toContain("'It\\'s a gift',");
    expect(out).toContain('expect: { isGifticon: false },');
  });
});
