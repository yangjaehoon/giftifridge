import { assessGifticon } from './gifticonScore';
import { guessGifticonFields } from './fieldGuess';
import { parseExpiryDateFromText } from './dateParser';
import type { GifticonCategory } from '../../types';
import type { RecognizedText } from './recognize';

/**
 * A labelled corpus for the gallery auto-import pipeline. Each case is a real
 * (or realistic) OCR capture plus what the pipeline *should* produce. The
 * per-case tests below are strict regression guards; the "reports pipeline
 * metrics" test prints precision/recall so a parser change can be measured, not
 * guessed at.
 *
 * To grow it: in a dev build the "[OCR] gallery-import ..." console line
 * (ocrDebugLog) carries the recognised text and the score breakdown for every
 * photo a scan sees — paste a real one in here with the fields it *should*
 * have. More negatives (photos that are NOT gifticons) are as valuable as more
 * positives.
 */
interface Expected {
  isGifticon: boolean;
  brand?: string;
  category?: GifticonCategory | null;
  expiresAt?: string;
  barcode?: string;
  amount?: number;
}

interface Case {
  id: string;
  ocr: string;
  expect: Expected;
}

const CASES: Case[] = [
  {
    id: 'starbucks-clean',
    ocr: [
      '스타벅스',
      '아이스 카페 아메리카노 T',
      '교환처 전국 스타벅스 매장',
      '유효기간 2026.12.31 까지',
      '주문번호 A1B2C3D4',
      '바코드',
      '8012 3456 7890',
    ].join('\n'),
    expect: {
      isGifticon: true,
      brand: '스타벅스',
      category: 'cafe',
      expiresAt: '2026-12-31',
      barcode: '801234567890',
    },
  },
  {
    id: 'bhc-chicken',
    ocr: [
      'BHC',
      '뿌링클 + 콜라 1.25L',
      '교환처 전국 BHC 매장',
      '유효기한 2025.09.30 까지',
      '주문번호 2226 1288 9031',
    ].join('\n'),
    expect: {
      isGifticon: true,
      brand: 'bhc',
      category: 'restaurant',
      expiresAt: '2025-09-30',
      barcode: '222612889031',
    },
  },
  {
    id: 'gs25-voucher',
    ocr: [
      'GS25 모바일 상품권',
      '3,000원권',
      '교환처 전국 GS25',
      '유효기간 2026.03.15 까지',
      '바코드 9412345678901',
    ].join('\n'),
    expect: {
      isGifticon: true,
      brand: 'GS25',
      category: 'convenience',
      expiresAt: '2026-03-15',
      barcode: '9412345678901',
    },
  },
  {
    id: 'cgv-movie-ticket',
    ocr: [
      'CGV',
      '영화 관람권 1매',
      '교환처 전국 CGV',
      '유효기간 2026.06.30 까지',
      '주문번호 5555 6666 7777',
    ].join('\n'),
    expect: {
      isGifticon: true,
      brand: 'CGV',
      category: 'culture',
      expiresAt: '2026-06-30',
    },
  },
  {
    id: 'cultureland-amount',
    ocr: [
      '컬쳐랜드',
      '문화상품권',
      '권종 5만원',
      '유효기간 2027.01.31 까지',
      '바코드 8801234567890123',
    ].join('\n'),
    expect: {
      isGifticon: true,
      expiresAt: '2027-01-31',
      barcode: '8801234567890123',
      amount: 50000,
    },
  },
  {
    id: 'unknown-brand-bakery',
    ocr: [
      '동네빵집',
      '소금빵 세트',
      '교환처 매장',
      '유효기한 2026.05.20 까지',
      '주문번호 1212 3434 5656',
    ].join('\n'),
    expect: {
      isGifticon: true,
      brand: '동네빵집',
      category: 'cafe',
      expiresAt: '2026-05-20',
    },
  },
  {
    id: 'date-without-keyword-but-strong-card',
    // No "유효기간" label near the date (OCR dropped it), but the card's
    // key/value block and a known brand still carry it.
    ocr: [
      '메가커피',
      '아메리카노 (ICE)',
      '교환처 전국 메가커피',
      '주문번호 3333 2222 1111',
      '교환수량 1',
      '2026.11.01',
    ].join('\n'),
    expect: {
      isGifticon: true,
      brand: '메가커피',
      category: 'cafe',
      expiresAt: '2026-11-01',
    },
  },
  {
    id: 'web-screenshot-chrome',
    ocr: [
      '2:55',
      'Naver Blog',
      '이디야커피',
      '아메리카노',
      '교환처',
      '유효기간',
      '주문번호',
      '2024년 08월 08일',
      '9939 2100 4549',
      '이디야 기프티콘 사용 후기 블로그',
      '저장',
      '방문 >',
    ].join('\n'),
    expect: {
      isGifticon: true,
      brand: '이디야',
      category: 'cafe',
      expiresAt: '2024-08-08',
    },
  },

  // --- negatives -----------------------------------------------------------
  {
    id: 'article-about-gifticons',
    ocr: Array.from(
      { length: 13 },
      (_, i) =>
        `기프티콘 만료일이 지나도 환불받는 방법을 아주 자세하게 설명하는 문단입니다 번호 ${i}`,
    )
      .concat('카카오톡 선물하기로 받은 기프티콘 만료일 2026.12.31 을 꼭 확인하세요')
      .join('\n'),
    expect: { isGifticon: false },
  },
  {
    id: 'purchase-receipt',
    ocr: [
      '스타벅스 영수증',
      '2026.01.15 14:20',
      '아이스 아메리카노 T 4,500원',
      '합계 4,500원',
      '카드승인 완료',
      '가맹점명 스타벅스 강남점',
    ].join('\n'),
    expect: { isGifticon: false },
  },
  {
    id: 'movie-showtimes',
    // Names a known brand and carries a date, but nothing else gifticon-like.
    ocr: ['CGV 강남', '2026.01.20 상영 시간표', '어벤져스 14:30 17:10 20:00', '2관 3관 4관'].join(
      '\n',
    ),
    expect: { isGifticon: false },
  },
  {
    id: 'plain-photo',
    ocr: '오늘 저녁 노을이 예뻐서 찍은 사진',
    expect: { isGifticon: false },
  },
];

function toRecognized(text: string): RecognizedText {
  return { text, lines: text.split('\n').map((line) => ({ text: line, height: 0 })) };
}

function runPipeline(ocr: string) {
  const a = assessGifticon(ocr);
  const guess = guessGifticonFields(toRecognized(ocr));
  return {
    create: a.create,
    score: a.score,
    signals: a.signals,
    expiresAt: a.expiresAt ?? parseExpiryDateFromText(ocr),
    barcode: a.textBarcode,
    amount: a.amount,
    brand: guess.brand,
    name: guess.name,
    category: guess.category,
  };
}

describe('gallery auto-import corpus', () => {
  it.each(CASES)('$id — import decision matches the label', ({ ocr, expect: want }) => {
    expect(runPipeline(ocr).create).toBe(want.isGifticon);
  });

  it.each(CASES.filter((c) => c.expect.isGifticon))(
    '$id — parses its labelled fields',
    ({ ocr, expect: want }) => {
      const got = runPipeline(ocr);
      if (want.expiresAt !== undefined) expect(got.expiresAt).toBe(want.expiresAt);
      if (want.brand !== undefined) expect(got.brand).toBe(want.brand);
      if (want.category !== undefined) expect(got.category).toBe(want.category);
      if (want.barcode !== undefined) expect(got.barcode).toBe(want.barcode);
      if (want.amount !== undefined) expect(got.amount).toBe(want.amount);
    },
  );

  it('reports pipeline metrics', () => {
    let tp = 0;
    let fp = 0;
    let fn = 0;
    let tn = 0;
    const field: Record<string, { ok: number; total: number }> = {};
    const bump = (name: string, ok: boolean) => {
      field[name] ??= { ok: 0, total: 0 };
      field[name].total += 1;
      if (ok) field[name].ok += 1;
    };

    for (const c of CASES) {
      const got = runPipeline(c.ocr);
      if (c.expect.isGifticon && got.create) tp += 1;
      else if (c.expect.isGifticon && !got.create) fn += 1;
      else if (!c.expect.isGifticon && got.create) fp += 1;
      else tn += 1;

      if (!c.expect.isGifticon) continue;
      const w = c.expect;
      if (w.brand !== undefined) bump('brand', got.brand === w.brand);
      if (w.category !== undefined) bump('category', got.category === w.category);
      if (w.expiresAt !== undefined) bump('expiresAt', got.expiresAt === w.expiresAt);
      if (w.barcode !== undefined) bump('barcode', got.barcode === w.barcode);
      if (w.amount !== undefined) bump('amount', got.amount === w.amount);
    }

    const pct = (n: number, d: number) =>
      d === 0 ? '  n/a' : `${((100 * n) / d).toFixed(0).padStart(3)}%`;
    const lines = [
      '',
      `import decision  precision ${pct(tp, tp + fp)}  recall ${pct(tp, tp + fn)}  (TP ${tp} FP ${fp} FN ${fn} TN ${tn})`,
      ...Object.entries(field).map(
        ([name, { ok, total }]) => `  ${name.padEnd(10)} ${pct(ok, total)}  (${ok}/${total})`,
      ),
    ];
    console.log(lines.join('\n'));

    // Hard floors — tighten as the corpus grows.
    expect(fp).toBe(0);
    expect(tp / (tp + fn)).toBeGreaterThanOrEqual(0.9);
  });
});
