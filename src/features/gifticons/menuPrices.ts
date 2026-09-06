// Approximate Korean retail prices for the highest-volume gifticon items, so a
// product voucher (which never prints a price) can show a rough "what's this
// worth" figure instead of the user having to look it up.
//
// This is an ESTIMATE and it goes stale — menu prices change often (a few of
// these brands raised prices in the last year). Always display it with
// PRICE_AS_OF and framed as approximate, never as an authoritative number.
// Small and slow-changing enough to live in the app like KNOWN_BRANDS; only
// popular items are covered and anything unmatched simply shows no estimate.

export interface EstimatedPrice {
  /** Approximate price in KRW. */
  price: number;
  /** Roughly when it was accurate, shown as a caveat (e.g. "2026년 기준"). */
  asOf: string;
}

const PRICE_AS_OF = '2026년';

interface PriceEntry {
  /** Substring matched against the (whitespace-stripped, lowercased) brand. */
  brand: string;
  /** Skip this entry if the brand also contains one of these — guards a short
   *  token like "메가" (the coffee chain) from matching "메가박스" (a cinema). */
  notBrand?: string[];
  /** Any of these appearing in the normalized product name is a match; the
   *  longest matching keyword wins when an item matches several entries. */
  keywords: string[];
  price: number;
}

// prettier-ignore
const MENU_PRICES: PriceEntry[] = [
  // 스타벅스 — 톨 사이즈 기준, 그란데/벤티는 별도 (2025.1 인상 반영)
  { brand: '스타벅스', keywords: ['아메리카노'], price: 4700 },
  { brand: '스타벅스', keywords: ['아메리카노grande', '아메리카노(g)'], price: 5300 },
  { brand: '스타벅스', keywords: ['아메리카노venti', '아메리카노(v)'], price: 6100 },
  { brand: '스타벅스', keywords: ['카페라떼', '카페라뗴'], price: 5200 },
  { brand: '스타벅스', keywords: ['카푸치노'], price: 5200 },
  { brand: '스타벅스', keywords: ['바닐라라떼', '바닐라플랫화이트'], price: 5200 },
  { brand: '스타벅스', keywords: ['카라멜마키아토', '카라멜마끼아또'], price: 6100 },
  { brand: '스타벅스', keywords: ['카페모카'], price: 5700 },
  { brand: '스타벅스', keywords: ['콜드브루'], price: 5100 },
  { brand: '스타벅스', keywords: ['자바칩프라푸치노', '자바칩'], price: 6500 },
  { brand: '스타벅스', keywords: ['그린티프라푸치노', '녹차프라푸치노'], price: 6300 },
  { brand: '스타벅스', keywords: ['자몽허니블랙티'], price: 5900 },

  // 저가 커피 (2024~2025 인상 반영, 아이스 기준에 가깝게)
  { brand: '이디야', keywords: ['아메리카노'], price: 3200 },
  { brand: '이디야', keywords: ['카페라떼'], price: 3700 },
  { brand: '메가', notBrand: ['메가박스'], keywords: ['아메리카노'], price: 2000 },
  { brand: '메가', notBrand: ['메가박스'], keywords: ['카페라떼'], price: 3400 },
  { brand: '컴포즈커피', keywords: ['아메리카노'], price: 2000 },
  { brand: '빽다방', keywords: ['아메리카노'], price: 2000 },
  { brand: '더벤티', keywords: ['아메리카노'], price: 1900 },

  // 카페 (기타)
  { brand: '투썸플레이스', keywords: ['아메리카노'], price: 4900 },
  { brand: '폴바셋', keywords: ['아메리카노'], price: 5500 },
  { brand: '공차', keywords: ['밀크티'], price: 4300 },

  // 디저트 (배스킨라빈스 2026.2 매장가)
  { brand: '배스킨라빈스', keywords: ['싱글레귤러', '싱글킹'], price: 3500 },
  { brand: '배스킨라빈스', keywords: ['파인트'], price: 9800 },
  { brand: '배스킨라빈스', keywords: ['쿼터'], price: 18500 },
  { brand: '배스킨라빈스', keywords: ['패밀리'], price: 26000 },
  { brand: '배스킨라빈스', keywords: ['하프갤런'], price: 32000 },
  { brand: '던킨', keywords: ['도넛', '도너츠'], price: 2000 },
  { brand: '파리바게뜨', keywords: ['케이크', '케잌'], price: 33000 },
  { brand: '뚜레쥬르', keywords: ['케이크', '케잌'], price: 33000 },
  { brand: '설빙', keywords: ['인절미설빙'], price: 13000 },

  // 치킨 (2024 인상 반영)
  { brand: 'bhc', keywords: ['뿌링클'], price: 21000 },
  { brand: 'bhc', keywords: ['골드킹', '맛초킹', '커리퀸'], price: 21000 },
  { brand: 'bbq', keywords: ['황금올리브'], price: 23000 },
  { brand: '교촌', keywords: ['오리지날', '오리지널'], price: 20000 },
  { brand: '교촌', keywords: ['허니콤보', '레드콤보'], price: 23000 },
  { brand: '굽네', keywords: ['고추바사삭'], price: 19900 },
  { brand: '네네', keywords: ['후라이드'], price: 20000 },
  { brand: '푸라닭', keywords: ['블랙알리오'], price: 23000 },

  // 버거 (2026.2 인상 반영)
  { brand: '맘스터치', keywords: ['싸이버거세트'], price: 7000 },
  { brand: '맘스터치', keywords: ['싸이버거'], price: 5000 },
  { brand: '맥도날드', keywords: ['빅맥세트'], price: 7600 },
  { brand: '맥도날드', keywords: ['빅맥'], price: 5700 },
  { brand: '맥도날드', keywords: ['상하이버거', '맥스파이시상하이'], price: 6100 },
  { brand: '버거킹', keywords: ['와퍼세트'], price: 9600 },
  { brand: '버거킹', keywords: ['와퍼'], price: 7400 },
  { brand: '롯데리아', keywords: ['불고기버거세트'], price: 7200 },
  { brand: '롯데리아', keywords: ['불고기버거'], price: 4900 },

  // 피자 (라지 기준)
  { brand: '도미노', keywords: ['라지', '포테이토'], price: 33900 },
  { brand: '피자헛', keywords: ['라지', '페퍼로니'], price: 31900 },

  // 편의점 상품권 — 액면가가 곧 가격
  { brand: 'gs25', keywords: ['1만원', '10000'], price: 10000 },
  { brand: 'cu', keywords: ['1만원', '10000'], price: 10000 },

  // 문화 — 일반 2D 관람권 액면가 기준
  { brand: 'cgv', keywords: ['관람권', '영화'], price: 15000 },
  { brand: '롯데시네마', keywords: ['관람권', '영화'], price: 15000 },
  { brand: '메가박스', keywords: ['관람권', '영화'], price: 15000 },
];

function normalize(value: string): string {
  return value.replace(/\s+/g, '').toLowerCase();
}

/**
 * A rough retail price for a product-voucher gifticon from its brand + name, or
 * null when nothing in the (deliberately partial) table matches. The result is
 * an estimate — callers must show it with `asOf` and framed as approximate.
 */
export function lookupEstimatedPrice(brand: string, name: string): EstimatedPrice | null {
  const b = normalize(brand);
  const n = normalize(name);
  if (!b || !n) return null;

  let bestPrice: number | null = null;
  let bestScore = 0;
  for (const entry of MENU_PRICES) {
    if (!b.includes(normalize(entry.brand))) continue;
    if (entry.notBrand?.some((x) => b.includes(normalize(x)))) continue;
    for (const keyword of entry.keywords) {
      const k = normalize(keyword);
      if (k.length > bestScore && n.includes(k)) {
        bestPrice = entry.price;
        bestScore = k.length;
      }
    }
  }

  return bestPrice == null ? null : { price: bestPrice, asOf: PRICE_AS_OF };
}
