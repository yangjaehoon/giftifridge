// Constructing an Intl.NumberFormat is relatively expensive; a single shared
// instance keeps list rendering (dozens of GifticonCards) cheap.
const KRW_FORMAT = new Intl.NumberFormat('ko-KR');

export function formatCurrency(amount: number): string {
  return `${KRW_FORMAT.format(amount)}원`;
}

/** Group a raw digit string with thousands separators for display in an input. */
export function groupDigits(digits: string): string {
  return digits === '' ? '' : KRW_FORMAT.format(Number(digits));
}
