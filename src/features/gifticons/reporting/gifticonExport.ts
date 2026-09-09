import { Share } from 'react-native';
import type { Gifticon } from '../types';
import { CATEGORY_LABELS } from '../types';
import { statusOf } from '../gifticonFilters';
import { isAmountBased, remainingAmount } from '../usage';
import { formatDate } from '../../../shared/utils/date';

// Plain-text export of a gifticon collection, so the user has a copy outside
// the app (a spreadsheet, an email to themselves, a backup). CSV rather than
// JSON: it opens directly in Excel / Google Sheets, which is what "내보내기"
// is actually for here.

const STATUS_LABELS: Record<ReturnType<typeof statusOf>, string> = {
  active: '사용가능',
  expired: '만료',
  used: '사용완료',
};

const HEADERS = [
  '상품명',
  '브랜드',
  '카테고리',
  '금액',
  '잔액',
  '유효기한',
  '상태',
  '바코드',
  '메모',
  '등록일',
  '사용일',
] as const;

/** RFC 4180 quoting: wrap in double quotes and double any embedded quote when
 *  the value contains a quote, comma, or newline. */
function csvCell(value: string | number | undefined): string {
  const s = value == null ? '' : String(value);
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function toRow(g: Gifticon): string {
  return [
    g.name,
    g.brand,
    CATEGORY_LABELS[g.category],
    g.amount ?? '',
    isAmountBased(g) ? remainingAmount(g) : '',
    g.expiresAt,
    STATUS_LABELS[statusOf(g)],
    g.barcode ?? '',
    g.memo ?? '',
    formatDate(g.createdAt),
    g.usedAt ? formatDate(g.usedAt) : '',
  ]
    .map(csvCell)
    .join(',');
}

/**
 * The collection as CSV text: a header row plus one row per gifticon, in the
 * order given. Pure and BOM-free so it's easy to assert against; exportGifticons
 * adds the BOM for Excel.
 */
export function buildGifticonCsv(items: Gifticon[]): string {
  return [HEADERS.join(','), ...items.map(toRow)].join('\r\n');
}

/** U+FEFF byte-order mark — makes Excel read the Korean headers as UTF-8.
 *  Built from a char code so it isn't an invisible literal in the source. */
const BOM = String.fromCharCode(0xfeff);

export type ExportResult = 'shared' | 'dismissed' | 'empty';

/**
 * Hands the CSV to the OS share sheet (same mechanism as the space invite
 * link). Returns 'empty' when there's nothing to export, otherwise reports
 * whether the user completed or dismissed the share. A leading BOM makes Excel
 * read the Korean headers as UTF-8.
 */
export async function exportGifticons(items: Gifticon[]): Promise<ExportResult> {
  if (items.length === 0) return 'empty';

  const csv = BOM + buildGifticonCsv(items);
  const result = await Share.share({ message: csv }, { subject: '기프티콘 내보내기.csv' });
  return result.action === Share.dismissedAction ? 'dismissed' : 'shared';
}
