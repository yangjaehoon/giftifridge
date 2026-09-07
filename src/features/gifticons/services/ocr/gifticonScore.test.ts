import { assessGifticon, isItemCouponPrice } from './gifticonScore';

function daysAgoDotted(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}.${m}.${day}`;
}

describe('assessGifticon', () => {
  it('scores a normal gifticon card well above the auto-import threshold', () => {
    const text = [
      '스타벅스',
      '아이스 카페 아메리카노 T',
      '교환처 전국 스타벅스',
      '유효기간 2026.12.31까지',
      '주문번호 1234 5678 9012',
    ].join('\n');
    const a = assessGifticon(text);
    expect(a.create).toBe(true);
    expect(a.expiresAt).toBe('2026-12-31');
    expect(a.signals).toMatchObject({ confidentDate: 3, knownBrand: 2 });
    expect(a.signals.footerLabels).toBeGreaterThanOrEqual(3);
  });

  it('does not import when the expiry could only be guessed, whatever the score', () => {
    const text = [
      '스타벅스 기프티콘',
      '교환처 전국 매장',
      '주문번호 1234 5678 9012',
      '발행 2025.01.01',
      '행사 종료 2027.12.31',
    ].join('\n');
    const a = assessGifticon(text);
    expect(a.expiresAt).toBeNull();
    expect(a.create).toBe(false);
  });

  it('penalises a purchase receipt that happens to carry a date and a brand', () => {
    const text = [
      '스타벅스 영수증',
      '2026.01.15',
      '아메리카노 T 4,500원',
      '합계 4,500원',
      '카드승인 완료',
    ].join('\n');
    const a = assessGifticon(text);
    expect(a.signals.receipt).toBe(-3);
    expect(a.create).toBe(false);
  });

  it('penalises a long article about gifticons and flips it below the threshold', () => {
    // Without the prose penalty this would score confidentDate(3) + keyword(2)
    // + platform(1) = 6 and import; the -3 pulls it to 3. "만료" anchors the
    // date without being one of the card footer labels, so footerLabels stays 0.
    const text = Array.from(
      { length: 13 },
      (_, i) =>
        `기프티콘 만료일이 지나도 환불받는 방법을 아주 자세하게 설명하는 문단입니다 번호 ${i}`,
    )
      .concat('카카오톡 선물하기로 받은 기프티콘 만료일 2026.12.31 을 꼭 확인하세요')
      .join('\n');
    const a = assessGifticon(text);
    expect(a.signals).toMatchObject({ confidentDate: 3, gifticonKeyword: 2, prose: -3 });
    expect(a.signals.footerLabels).toBeUndefined();
    expect(a.create).toBe(false);
  });

  it('hands back the parsed barcode and amount for the caller to reuse', () => {
    const text =
      '컬쳐랜드\n문화상품권\n권종 1만원\n유효기간 2028.12.31까지\n바코드 8801234567890123';
    const a = assessGifticon(text);
    expect(a.textBarcode).toBe('8801234567890123');
    expect(a.amount).toBe(10000);
    expect(a.amountConfident).toBe(true); // "권종" anchors it
  });

  it('lets a decoded barcode graphic carry a photo whose text fell just short', () => {
    const daysFromNow = (n: number) => {
      const d = new Date();
      d.setDate(d.getDate() + n);
      return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(
        d.getDate(),
      ).padStart(2, '0')}`;
    };
    const text = `유효기간 ${daysFromNow(90)} 까지`; // lone date: confidentDate 3 + footer 2 = 5

    const textOnly = assessGifticon(text);
    expect(textOnly.create).toBe(false);
    expect(textOnly.worthGraphicScan).toBe(true);

    const withGraphic = assessGifticon(text, '8801234567890');
    expect(withGraphic.signals.barcodeGraphic).toBe(5);
    expect(withGraphic.create).toBe(true);
    expect(withGraphic.barcode).toBe('8801234567890'); // graphic wins over text
  });

  it('does not bother scanning the graphic when there is no date to save', () => {
    const a = assessGifticon('스타벅스 기프티콘\n교환처 전국\n바코드 8801234567890');
    expect(a.expiresAt).toBeNull();
    expect(a.worthGraphicScan).toBe(false);
  });

  it('will not auto-import on a confident date that reads far in the past', () => {
    const text = [
      '스타벅스',
      '카페 라떼 T',
      '교환처 전국 스타벅스',
      `유효기간 ${daysAgoDotted(200)} 까지`,
      '주문번호 1234 5678 9012',
    ].join('\n');
    const a = assessGifticon(text);
    expect(a.expiresAt).toBeNull();
    expect(a.create).toBe(false);
    expect(a.signals).toMatchObject({ confidentDate: 3, staleExpiry: -3 });
  });
});

describe('isItemCouponPrice', () => {
  it('flags a keyword-less amount on a cafe/restaurant coupon', () => {
    expect(isItemCouponPrice({ confident: false }, 'cafe')).toBe(true);
    expect(isItemCouponPrice({ confident: false }, 'restaurant')).toBe(true);
  });

  it('keeps a keyword-anchored amount, and any amount on a voucher category', () => {
    expect(isItemCouponPrice({ confident: true }, 'cafe')).toBe(false);
    expect(isItemCouponPrice({ confident: false }, 'convenience')).toBe(false);
    expect(isItemCouponPrice({ confident: false }, 'culture')).toBe(false);
    expect(isItemCouponPrice(null, 'cafe')).toBe(false);
  });
});
