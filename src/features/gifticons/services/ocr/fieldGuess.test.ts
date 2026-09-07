import { guessGifticonFields } from './fieldGuess';
import type { RecognizedText } from './recognize';

// guessGifticonFields takes recognizeText's richer result (line height comes
// from the OCR engine's per-line bounding box); tests that don't care about
// height wrap a plain multi-line string with height 0 for every line, which
// keepHeadlineSizedLines treats as "no frame data available" and skips.
function ocrResult(text: string, heights: number[] = []): RecognizedText {
  return {
    text,
    lines: text.split('\n').map((line, i) => ({ text: line, height: heights[i] ?? 0 })),
  };
}

describe('guessGifticonFields', () => {
  it('reads the first two clean lines as (brand, name) and includes its category', () => {
    const text = '스타벅스\n아메리카노 Tall\n유효기간 2026.12.31까지\n바코드 8801234567890';
    expect(guessGifticonFields(ocrResult(text))).toEqual({
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
    expect(guessGifticonFields(ocrResult(text))).toEqual({
      brand: '이디야',
      name: '아메리카노',
      category: 'cafe',
    });
  });

  it('returns null name when only one usable line is found', () => {
    expect(guessGifticonFields(ocrResult('스타벅스\n유효기간 2026.12.31까지'))).toEqual({
      brand: '스타벅스',
      name: null,
      category: 'cafe',
    });
  });

  it('returns null brand/name/category when nothing usable is found', () => {
    expect(
      guessGifticonFields(ocrResult('기프티콘\n유효기간 2026.12.31까지\n8801234567890')),
    ).toEqual({
      brand: null,
      name: null,
      category: null,
    });
  });

  it('infers a category from product-name keywords when the brand is unlisted', () => {
    const text = 'CUP 사이즈 안내\n딸기 스무디\n유효기간 2026.12.31까지';
    // "CU" must not match inside "CUP" — the brand/name come from the position
    // guess, and "스무디" pins the category even without a known brand.
    expect(guessGifticonFields(ocrResult(text))).toEqual({
      brand: 'CUP 사이즈 안내',
      name: '딸기 스무디',
      category: 'cafe',
    });
  });

  it('leaves category null for an unlisted brand when no keyword matches', () => {
    const text = '무명문구\n캐릭터 스티커\n유효기간 2026.12.31까지';
    expect(guessGifticonFields(ocrResult(text))).toEqual({
      brand: '무명문구',
      name: '캐릭터 스티커',
      category: null,
    });
  });

  it('infers restaurant / culture / etc from their keywords too', () => {
    expect(
      guessGifticonFields(ocrResult('무명치킨\n후라이드 한마리\n유효기간 2026.12.31까지')).category,
    ).toBe('restaurant');
    expect(
      guessGifticonFields(ocrResult('무명극장\n영화 관람권 1매\n유효기간 2026.12.31까지')).category,
    ).toBe('culture');
    expect(
      guessGifticonFields(ocrResult('무명마트\n금액권 1만원권\n유효기간 2026.12.31까지')).category,
    ).toBe('convenience');
  });

  it('keeps a short brand name that happens to contain a couple of digits', () => {
    const text = 'GS25\n연세우유 크림빵\n유효기간 2026.12.31까지';
    expect(guessGifticonFields(ocrResult(text))).toEqual({
      brand: 'GS25',
      name: '연세우유 크림빵',
      category: 'convenience',
    });
  });

  it('finds a known brand regardless of which line it appears on', () => {
    // Name first, brand second — the opposite of the usual layout assumption.
    const text = '아메리카노 Tall\n스타벅스\n유효기간 2026.12.31까지';
    expect(guessGifticonFields(ocrResult(text))).toEqual({
      brand: '스타벅스',
      name: '아메리카노 Tall',
      category: 'cafe',
    });
  });

  it('finds a known brand even inside an otherwise-noisy line', () => {
    const text = '아메리카노 Tall\n전국 스타벅스 매장에서 교환 가능\n유효기간 2026.12.31까지';
    expect(guessGifticonFields(ocrResult(text))).toEqual({
      brand: '스타벅스',
      name: '아메리카노 Tall',
      category: 'cafe',
    });
  });

  it('matches a known brand case- and spacing-insensitively', () => {
    const text = 'b h c\n순살치킨\n유효기간 2026.12.31까지';
    expect(guessGifticonFields(ocrResult(text))).toEqual({
      brand: 'bhc',
      name: '순살치킨',
      category: 'restaurant',
    });
  });

  it('skips a sentence-fragment line wedged between the brand and the real name', () => {
    // A web screenshot can bleed a result-title tail ("있을까?") in just under
    // the brand; the real name is the next line, not that fragment.
    const text = '뚜레쥬르\n있을까?\n행복한 플라워 하트 케이크\n유효기간 2026.12.31까지';
    expect(guessGifticonFields(ocrResult(text))).toEqual({
      brand: '뚜레쥬르',
      name: '행복한 플라워 하트 케이크',
      category: 'cafe',
    });
  });

  it('keeps a genuinely short product name after the brand', () => {
    const text = '설빙\n빙수\n유효기간 2026.12.31까지';
    expect(guessGifticonFields(ocrResult(text))).toMatchObject({ brand: '설빙', name: '빙수' });
  });

  it('takes the first real line after the brand, not the longest', () => {
    // A trailing option/disclaimer line can be longer than the product name;
    // "first after brand" must win over "longest".
    const text = '스타벅스\n카페 아메리카노 T\n사이즈 변경 가능해요\n유효기간 2026.12.31까지';
    expect(guessGifticonFields(ocrResult(text))).toEqual({
      brand: '스타벅스',
      name: '카페 아메리카노 T',
      category: 'cafe',
    });
  });

  it('ignores a screenshot status-bar clock/battery instead of taking it as the name', () => {
    // A gifticon screenshot also captures the phone status bar; "2:55" and
    // "85%" land above the real content but are never the product name.
    const text = '2:55\n85%\nbhc\n뿌링클\n유효기간 2026.12.31까지';
    expect(guessGifticonFields(ocrResult(text))).toEqual({
      brand: 'bhc',
      name: '뿌링클',
      category: 'restaurant',
    });
  });

  it('drops a no-letter line from the position-based brand/name guess too', () => {
    const text = '9:41\n동네빵집\n소금빵 세트\n유효기간 2026.12.31까지';
    expect(guessGifticonFields(ocrResult(text))).toEqual({
      brand: '동네빵집',
      name: '소금빵 세트',
      // "빵" pins the category even on the position (no known brand) path.
      category: 'cafe',
    });
  });

  it('recognizes brands from the newer categories (pizza, dessert, bookstore)', () => {
    expect(
      guessGifticonFields(ocrResult('도미노피자\n페퍼로니 라지\n유효기간 2026.12.31까지')),
    ).toEqual({
      brand: '도미노피자',
      name: '페퍼로니 라지',
      category: 'restaurant',
    });
    expect(guessGifticonFields(ocrResult('설빙\n인절미설빙\n유효기간 2026.12.31까지'))).toEqual({
      brand: '설빙',
      name: '인절미설빙',
      category: 'cafe',
    });
    expect(guessGifticonFields(ocrResult('교보문고\n도서상품권\n유효기간 2026.12.31까지'))).toEqual(
      {
        brand: '교보문고',
        name: '도서상품권',
        category: 'culture',
      },
    );
  });

  it('drops small-font fine print that is not on the noise keyword list, using line height', () => {
    // "본사 정책에 따라 상품 구성이 변경될 수 있습니다" isn't caught by
    // NOISE_KEYWORDS or the digit-density check, but real gifticons render it
    // in a visibly smaller font than the brand/product-name headline.
    const recognized: RecognizedText = {
      text: '스타벅스\n본사 정책에 따라 상품 구성이 변경될 수 있습니다\n아메리카노 Tall',
      lines: [
        { text: '스타벅스', height: 40 },
        { text: '본사 정책에 따라 상품 구성이 변경될 수 있습니다', height: 14 },
        { text: '아메리카노 Tall', height: 38 },
      ],
    };
    expect(guessGifticonFields(recognized)).toEqual({
      brand: '스타벅스',
      name: '아메리카노 Tall',
      category: 'cafe',
    });
  });

  it('keeps every candidate line when no frame/height data is available', () => {
    const recognized: RecognizedText = {
      text: '스타벅스\n아메리카노 Tall',
      lines: [
        { text: '스타벅스', height: 0 },
        { text: '아메리카노 Tall', height: 0 },
      ],
    };
    expect(guessGifticonFields(recognized)).toEqual({
      brand: '스타벅스',
      name: '아메리카노 Tall',
      category: 'cafe',
    });
  });

  it('drops a line missing just its own frame when its siblings do have real heights', () => {
    // Unlike the "no frame data available" case above, most of this photo's
    // lines DO have real heights — this one line's own missing frame reads
    // as "unverified", not "trust it regardless of size".
    const recognized: RecognizedText = {
      text: '스타벅스\n안내문구\n아메리카노 Tall',
      lines: [
        { text: '스타벅스', height: 40 },
        { text: '안내문구', height: 0 },
        { text: '아메리카노 Tall', height: 38 },
      ],
    };
    expect(guessGifticonFields(recognized)).toEqual({
      brand: '스타벅스',
      name: '아메리카노 Tall',
      category: 'cafe',
    });
  });
});
