import { classifyWriteError, WRITE_ERROR_MESSAGES } from '../../shared/utils/classifyWriteError';

const GIFTICON_ERROR_MESSAGES = {
  ...WRITE_ERROR_MESSAGES,
  save: '저장 중 문제가 발생했어요. 다시 시도해주세요.',
  update: '처리 중 문제가 발생했어요.',
  delete: '삭제 중 문제가 발생했어요.',
  load: '기프티콘을 불러오지 못했어요. 잠시 후 다시 시도해주세요.',
  notFound: '기프티콘을 찾을 수 없어요.',
  permission: '이 기프티콘에 대한 접근 권한이 없어요. 스페이스에서 나가진 건 아닌지 확인해주세요.',
} as const;

type GifticonErrorKey = keyof typeof GIFTICON_ERROR_MESSAGES;

export function getGifticonErrorMessage(action: GifticonErrorKey): string {
  return GIFTICON_ERROR_MESSAGES[action];
}

/** Maps a thrown write error to the right message; `fallback` covers the "other" case. */
export function getGifticonWriteErrorMessage(err: unknown, fallback: GifticonErrorKey): string {
  const kind = classifyWriteError(err);
  return getGifticonErrorMessage(kind === 'other' ? fallback : kind);
}
