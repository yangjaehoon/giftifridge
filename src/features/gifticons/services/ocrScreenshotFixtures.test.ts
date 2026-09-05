import { guessGifticonFields, parseExpiryDateFromText, parseBarcodeFromText } from './ocrService';
import type { RecognizedText } from './ocrService';

// Text reconstructed by eye from 4 real screenshots (IMG_0006-0009): web
// search-result pages *about* gifticons — browser chrome + a site/app name on
// top, a "2:55" status bar, a small embedded gifticon card, a result title
// below it. Heights are 0 (the "no frame data" path); the small embedded card
// gives the product name no height advantage over the page chrome anyway.
//
// The pipeline can't be run for real here (ML Kit is a native module), so this
// documents how guessGifticonFields/parseExpiryDateFromText behave on that
// messy shape: brand + expiry come out right, and the product name is now read
// from the line under the brand instead of the page's site name.
function ocr(lines: string[]): RecognizedText {
  return { text: lines.join('\n'), lines: lines.map((t) => ({ text: t, height: 0 })) };
}

describe('OCR guess on web-search-result gifticon screenshots', () => {
  it('IMG_0006 — 스타벅스 라벤더 베이지 오트 라떼 (source site: 나주신문)', () => {
    const recognized = ocr([
      '2:55',
      '나주신문',
      '스타벅스',
      '라벤더 베이지 오트 라떼 T 2잔+',
      '티라미수 타르트+The 초초 초...',
      '9562 3533 4665',
      '교환처 스타벅스',
      '유효기간 2022년 05월 04일',
      '주문번호 1546443489',
      'kakaotalk 선물하기',
      "스타벅스 기프티콘 잔액 환급 '진화' < 우리 동네 소식 < 동네방네 < 큐 ...",
      '방문',
      '공유',
      '저장',
      '기프티콘 이미지',
    ]);
    expect(guessGifticonFields(recognized)).toEqual({
      brand: '스타벅스',
      name: '라벤더 베이지 오트 라떼 T 2잔+',
      category: 'cafe',
    });
    expect(parseExpiryDateFromText(recognized.text)).toBe('2022-05-04');
  });

  it('IMG_0007 — 뚜레쥬르 행복한 플라워 하트 케이크 (source app: Blind)', () => {
    const recognized = ocr([
      '2:55',
      'Blind',
      '뚜레쥬르',
      '행복한 플라워 하트 케이크',
      '9939 2100 4549',
      '교환처 뚜레쥬르',
      '유효기간 2022년 04월 19일',
      '주문번호 835866860',
      'kakaotalk 선물하기',
      '블라인드 | 블라블라: 기프티콘 가격 알 수 있을까?',
      '방문',
      '공유',
      '저장',
      '기프티콘 이미지',
    ]);
    expect(guessGifticonFields(recognized)).toEqual({
      brand: '뚜레쥬르',
      name: '행복한 플라워 하트 케이크',
      category: 'cafe',
    });
    expect(parseExpiryDateFromText(recognized.text)).toBe('2022-04-19');
  });

  it('IMG_0008 — bhc 뿌링클+콜라1.25L (source app: Naver Blog) — the reported "2:55" case', () => {
    const recognized = ocr([
      '2:55',
      'Naver Blog',
      'BHC',
      '뿌링클+콜라1.25L',
      '2226 1288 9031',
      '교환처 BHC',
      '유효기간 2024년 08월 08일',
      '주문번호 2183702679',
      '이미지 내 검색',
      'kakaotalk 선물하기',
      'https://blog.naver.com/eastsunrise',
      'BHC 치킨 가격인상 전 기프티콘 사용 방법 메뉴 변경시 금액 차이 비교 ...',
      '방문',
      '공유',
      '저장',
      '기프티콘 이미지',
    ]);
    expect(guessGifticonFields(recognized)).toEqual({
      brand: 'bhc',
      name: '뿌링클+콜라1.25L',
      category: 'restaurant',
    });
    expect(parseExpiryDateFromText(recognized.text)).toBe('2024-08-08');
  });

  it('IMG_0009 — old syrup-gifticon layout: brand only in the "사용처 |" footer row', () => {
    // The obsolete syrup layout prints the brand only in fine print below the
    // product name, so there's no standalone brand line to anchor to. The name
    // is recovered as the last headline before the card's footer table
    // (교환수량/사용기한/사용처), which skips the "파이낸셜신문" page chrome above.
    const recognized = ocr([
      '2:55',
      '파이낸셜신문',
      '이헐 전한니다',
      'syrup gifticon',
      '아이스 카페 라떼 Tall',
      '교환수량 | 1 개',
      '사용기한 | ~ 2016.09.11',
      '사용처 | 스타벅스',
      'syrup gifticon',
      '9999 6725 6650',
      '마음을 전하는 또 다른 방법... 시럽기프티콘',
      "설·추석 명절 인기 '기프티콘'은 '커피' - 파이낸셜신문",
      '방문',
      '공유',
      '저장',
      '기프티콘 이미지',
    ]);
    expect(guessGifticonFields(recognized)).toEqual({
      brand: '스타벅스',
      name: '아이스 카페 라떼 Tall',
      category: 'cafe',
    });
    expect(parseExpiryDateFromText(recognized.text)).toBe('2016-09-11');
  });

  it('the printed barcode digits are grouped, so the text fallback finds none', () => {
    // "2226 1288 9031" splits into 4-digit runs — under MIN_BARCODE_DIGITS. On
    // device the barcode graphic itself is the primary source (recognizeBarcode
    // FromImage); this text fallback only catches an unbroken run.
    expect(parseBarcodeFromText('2226 1288 9031\n주문번호 2183702679')).toBeNull();
  });
});
