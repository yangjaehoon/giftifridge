import { guessGifticonFields, parseExpiryDateFromText } from './ocrService';
import type { RecognizedText } from './ocrService';

// Real @react-native-ml-kit/text-recognition output, captured on an Android
// emulator, for 4 screenshots (IMG_0006-0009 in ~/Downloads). These are web
// search-result pages *about* gifticons: browser chrome + a site/app name on
// top, a "2:55" status bar, a small embedded gifticon card, a result title
// below it. Each line is [text, rounded frame height]. Kept as a regression
// fixture for guessGifticonFields against genuinely messy OCR (bled-in page
// chrome, an oversized logo, an ASCII brand with no surrounding whitespace).
function ocr(lines: [string, number][]): RecognizedText {
  return {
    text: lines.map(([t]) => t).join('\n'),
    lines: lines.map(([text, height]) => ({ text, height })),
  };
}

describe('guessGifticonFields on real OCR of web-search-result screenshots', () => {
  it('IMG_0006 — 스타벅스 라벤더 베이지 오트 라떼 (source site: 나주신문)', () => {
    const recognized = ocr([
      ['2:55', 35],
      ['나주신문', 13],
      ['나주신문', 43],
      ['스타벅스', 29],
      ['라벤더 베이지 오트 라떼 T 2잔+', 33],
      ['티라미수 타르트+The 초초 초', 23],
      ['교환처', 24],
      ['유효기간', 25],
      ['주문번호', 26],
      ['9562 3533 4665', 24],
      ['공유', 47],
      ['2022년 05월 04일', 29],
      ['스타벅스', 24],
      ['1546443489', 24],
      ['kakaotalk&선물하기', 37],
      ["스타벅스 기프티콘 잔액 환급 '진화' < 우리", 42],
      ['동네 소식 <동네방네 < 큐...', 46],
      ['a기프티콘 이미지', 39],
      ['저장', 40],
      ['방문 >', 40],
    ]);
    expect(guessGifticonFields(recognized)).toEqual({
      brand: '스타벅스',
      name: '라벤더 베이지 오트 라떼 T 2잔+',
      category: 'cafe',
    });
    expect(parseExpiryDateFromText(recognized.text)).toBe('2022-05-04');
  });

  it('IMG_0007 — 뚜레쥬르 행복한 플라워 하트 케이크 (result-title fragment "있을까?" bleeds in)', () => {
    const recognized = ocr([
      ['2:55', 35],
      ['Blind', 31],
      ['뚜레쥬르', 31],
      ['있을까?', 43],
      ['행복한 플라워 하트 케이크', 31],
      ['교환처', 23],
      ['유효기간', 23],
      ['주문번호', 25],
      ['TOUS JOURS', 10],
      ['공유', 37],
      ['9939 2100 4549', 23],
      ['kakaotalk 선물하기', 34],
      ['뚜레쥬르', 23],
      ['2022년 04월 19일', 27],
      ['835866860', 18],
      ['블라인드| 블라블라: 기프티콘 가격 알 수', 52],
      ['저장', 38],
      ['방문 >', 42],
    ]);
    expect(guessGifticonFields(recognized)).toEqual({
      brand: '뚜레쥬르',
      name: '행복한 플라워 하트 케이크',
      category: 'cafe',
    });
    expect(parseExpiryDateFromText(recognized.text)).toBe('2022-04-19');
  });

  it('IMG_0008 — bhc 뿌링클 (ASCII brand with no whitespace boundary: "...Blog\\nBHC")', () => {
    const recognized = ocr([
      ['2:55', 35],
      ['Naver Blog', 37],
      ['BHC', 25],
      ['뿌링클+골라1.25L', 34],
      ['교환처', 28],
      ['유효기간', 35],
      ['주문번호', 29],
      ['2226 1288 9031', 24],
      ['공유', 35],
      ['이미지 내 검색 kakaotalk선물하기', 61],
      ['bhc', 48],
      ['CHICKEN', 22],
      ['2024년 08월 08일', 38],
      ['BHC', 21],
      ['2183702679', 22],
      ['Q기프티콘 이미지', 38],
      ['htplognantoya', 19],
      ['BHC 치킨 가격인상 전 기프티콘 사용 방법', 48],
      ['메뉴 변경시 금액 차이 비교', 43],
      ['저장', 40],
      ['방문 >', 39],
    ]);
    // "골라" is ML Kit's misread of "콜라" — an OCR-quality issue, not a guess bug.
    expect(guessGifticonFields(recognized)).toEqual({
      brand: 'bhc',
      name: '뿌링클+골라1.25L',
      category: 'restaurant',
    });
    expect(parseExpiryDateFromText(recognized.text)).toBe('2024-08-08');
  });

  it('IMG_0009 — old syrup layout: oversized "syrup gifticon" logo, brand only in footer', () => {
    const recognized = ocr([
      ['2:55', 35],
      ['파이낸설신문', 12],
      ['파이낸셜신문', 40],
      ['syrup gifticon)', 91],
      ['아이스 카페 라떼 Tall', 40],
      ['교환수량 1 개', 42],
      ['d 공유', 47],
      ['사용기한 - 2016.09.11', 40],
      ['사용처 스타벅스', 46],
      ['syrup gifticon', 39],
      ['9999 6725 6650', 36],
      ['마음을 전하는 또 다른 방법... 시럽기프티콘', 52],
      ["설추석 명절 인기 '기프티콘'은 '커피' - 파", 51],
      ['이낸설신문', 49],
      ['qifticon', 11],
      ['까페 아메리카노 Tall 신한', 16],
      ['a기프티콘 이미지', 38],
      ['저장', 38],
      ['방문 >', 40],
    ]);
    expect(guessGifticonFields(recognized)).toEqual({
      brand: '스타벅스',
      name: '아이스 카페 라떼 Tall',
      category: 'cafe',
    });
    expect(parseExpiryDateFromText(recognized.text)).toBe('2016-09-11');
  });
});
