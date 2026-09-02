// Constructing an Intl.NumberFormat is relatively expensive; a single shared
// instance keeps list rendering (dozens of GifticonCards) cheap.
const KRW_FORMAT = new Intl.NumberFormat('ko-KR');

export function formatCurrency(amount: number): string {
  return `${KRW_FORMAT.format(amount)}원`;
}
