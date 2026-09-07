import type { GifticonCategory } from '../../types';

export interface KnownBrand {
  name: string;
  category: GifticonCategory;
}

// Common Korean gifticon brands, checked before falling back to the
// position-based guess in guessGifticonFields — a known name pins the brand
// (and its category) correctly regardless of which line it lands on (and
// regardless of whether that line would otherwise be filtered as noise, e.g.
// "전국 GS25 매장에서 사용 가능"). Not exhaustive: a brand missing from this
// list still gets a brand/name guess via the position fallback, just no
// category.
const KNOWN_BRANDS: KnownBrand[] = [
  // 카페/디저트음료
  { name: '스타벅스', category: 'cafe' },
  { name: '이디야', category: 'cafe' },
  { name: '투썸플레이스', category: 'cafe' },
  { name: '메가커피', category: 'cafe' },
  { name: '컴포즈커피', category: 'cafe' },
  { name: '빽다방', category: 'cafe' },
  { name: '폴바셋', category: 'cafe' },
  { name: '커피빈', category: 'cafe' },
  { name: '할리스', category: 'cafe' },
  { name: '파스쿠찌', category: 'cafe' },
  { name: '엔젤리너스', category: 'cafe' },
  { name: '탐앤탐스', category: 'cafe' },
  { name: '만랩커피', category: 'cafe' },
  { name: '공차', category: 'cafe' },
  { name: '매머드커피', category: 'cafe' },
  { name: '더벤티', category: 'cafe' },
  { name: '요거프레소', category: 'cafe' },
  { name: '스무디킹', category: 'cafe' },
  { name: '잠바주스', category: 'cafe' },
  // 편의점
  { name: 'GS25', category: 'convenience' },
  { name: 'CU', category: 'convenience' },
  { name: '세븐일레븐', category: 'convenience' },
  { name: '이마트24', category: 'convenience' },
  { name: '미니스톱', category: 'convenience' },
  // 패스트푸드/치킨/피자
  { name: '맥도날드', category: 'restaurant' },
  { name: '버거킹', category: 'restaurant' },
  { name: '롯데리아', category: 'restaurant' },
  { name: 'KFC', category: 'restaurant' },
  { name: '맘스터치', category: 'restaurant' },
  { name: '서브웨이', category: 'restaurant' },
  { name: '노브랜드버거', category: 'restaurant' },
  { name: '쉐이크쉑', category: 'restaurant' },
  { name: '교촌치킨', category: 'restaurant' },
  { name: '굽네치킨', category: 'restaurant' },
  { name: 'bhc', category: 'restaurant' },
  { name: 'BBQ', category: 'restaurant' },
  { name: '네네치킨', category: 'restaurant' },
  { name: '처갓집양념치킨', category: 'restaurant' },
  { name: '페리카나', category: 'restaurant' },
  { name: '호식이두마리치킨', category: 'restaurant' },
  { name: '노랑통닭', category: 'restaurant' },
  { name: '푸라닭', category: 'restaurant' },
  { name: '자담치킨', category: 'restaurant' },
  { name: '또래오래', category: 'restaurant' },
  { name: '도미노피자', category: 'restaurant' },
  { name: '피자헛', category: 'restaurant' },
  { name: '미스터피자', category: 'restaurant' },
  { name: '파파존스', category: 'restaurant' },
  // 베이커리/디저트
  { name: '배스킨라빈스', category: 'cafe' },
  { name: '던킨', category: 'cafe' },
  { name: '파리바게뜨', category: 'cafe' },
  { name: '뚜레쥬르', category: 'cafe' },
  { name: '파리크라상', category: 'cafe' },
  { name: '크리스피크림도넛', category: 'cafe' },
  { name: '설빙', category: 'cafe' },
  { name: '나뚜루', category: 'cafe' },
  { name: '콜드스톤', category: 'cafe' },
  // 문화
  { name: 'CGV', category: 'culture' },
  { name: '롯데시네마', category: 'culture' },
  { name: '메가박스', category: 'culture' },
  { name: '교보문고', category: 'culture' },
  { name: '영풍문고', category: 'culture' },
  // 기타
  { name: '올리브영', category: 'etc' },
  { name: '다이소', category: 'etc' },
  { name: '시코르', category: 'etc' },
];

/** Whitespace-stripped, lower-cased form for loose brand/keyword matching. */
export function compact(value: string): string {
  return value.replace(/\s+/g, '').toLowerCase();
}

const ASCII_ONLY_RE = /^[a-z0-9]+$/;
const REGEX_META_RE = /[.*+?^${}()|[\]\\]/g;

// One matcher per known brand, compiled once. Each regex captures group 1 = the
// brand key with `\s*` between every character, so OCR that split the name
// ("b h c", "스타 벅스") still matches. A Latin/digit key ("CU", "KFC") is
// additionally required to stand alone — not embedded in a longer alphanumeric
// run — so "CU" doesn't match inside "CUP". All matching is done against the
// lower-cased original text (whitespace preserved), so one comparable index
// space is used to pick the earliest brand.
const BRAND_MATCHERS: { brand: KnownBrand; re: RegExp }[] = KNOWN_BRANDS.map((brand) => {
  const spaced = compact(brand.name)
    .split('')
    .map((ch) => ch.replace(REGEX_META_RE, '\\$&'))
    .join('\\s*');
  const source = ASCII_ONLY_RE.test(compact(brand.name))
    ? `(?:^|[^a-z0-9])(${spaced})(?:[^a-z0-9]|$)`
    : `(${spaced})`;
  return { brand, re: new RegExp(source) };
});

function brandKeyPosition(lowerText: string, re: RegExp): number {
  const m = re.exec(lowerText);
  return m ? m.index + m[0].indexOf(m[1]) : -1;
}

// The real brand sits near the top of a gifticon, so when the text names more
// than one known brand — a price-comparison blog screenshot, a "vs" post —
// the earliest one wins rather than whichever happens to come first in the
// KNOWN_BRANDS array.
export function findKnownBrand(text: string): KnownBrand | null {
  const lowerText = text.toLowerCase();
  let best: { brand: KnownBrand; at: number } | null = null;
  for (const { brand, re } of BRAND_MATCHERS) {
    const at = brandKeyPosition(lowerText, re);
    if (at !== -1 && (best == null || at < best.at)) best = { brand, at };
  }
  return best?.brand ?? null;
}

// When the brand isn't in KNOWN_BRANDS there's no category from it, but the
// product name usually gives it away — an "아메리카노" is a cafe, a "치킨" a
// restaurant. Unlike product names themselves this keyword set is small and
// slow-changing, and it only fills the gap the brand match left (see
// inferCategoryFromKeywords). Order matters: the more specific compound
// ("문화상품권", "편의점상품권") must be listed before the bare "상품권".
const CATEGORY_KEYWORDS: { category: GifticonCategory; keywords: string[] }[] = [
  {
    category: 'cafe',
    keywords: [
      '아메리카노',
      '라떼',
      '카푸치노',
      '에스프레소',
      '카페모카',
      '마키아토',
      '콜드브루',
      '아이스티',
      '에이드',
      '스무디',
      '프라푸치노',
      '버블티',
      '밀크티',
      '빙수',
      '케이크',
      '베이글',
      '크로플',
      '마카롱',
      '도넛',
      '도너츠',
      '아이스크림',
      '젤라또',
      '와플',
      '쿠키',
      '아포가토',
      '빵',
    ],
  },
  {
    category: 'restaurant',
    keywords: [
      '치킨',
      '버거',
      '햄버거',
      '피자',
      '떡볶이',
      '족발',
      '보쌈',
      '국밥',
      '돈까스',
      '돈가스',
      '파스타',
      '스테이크',
      '초밥',
      '삼겹살',
      '곱창',
      '냉면',
      '쌀국수',
      '마라탕',
      '부대찌개',
      '김밥',
      '짜장면',
      '짬뽕',
      '탕수육',
      '샌드위치',
    ],
  },
  {
    category: 'culture',
    keywords: ['영화', '관람권', '예매권', '도서상품권', '문화상품권', '이북', '웹툰'],
  },
  { category: 'convenience', keywords: ['편의점상품권', '편의점', '금액권'] },
  { category: 'etc', keywords: ['상품권', '교환권'] },
];

/**
 * Category from product-name/brand keywords — a fallback for when the brand
 * isn't in KNOWN_BRANDS. Returns null when nothing matches rather than guess.
 */
export function inferCategoryFromKeywords(text: string): GifticonCategory | null {
  const haystack = compact(text);
  for (const { category, keywords } of CATEGORY_KEYWORDS) {
    if (keywords.some((keyword) => haystack.includes(compact(keyword)))) return category;
  }
  return null;
}
