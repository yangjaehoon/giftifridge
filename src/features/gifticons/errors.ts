const GIFTICON_ERROR_MESSAGES = {
  save: '저장 중 문제가 발생했어요. 다시 시도해주세요.',
  update: '처리 중 문제가 발생했어요.',
  delete: '삭제 중 문제가 발생했어요.',
  load: '기프티콘을 불러오지 못했어요. 잠시 후 다시 시도해주세요.',
  notFound: '기프티콘을 찾을 수 없어요.',
  network: '네트워크 연결을 확인해주세요. 오프라인 상태일 수 있어요.',
} as const;

export function getGifticonErrorMessage(action: keyof typeof GIFTICON_ERROR_MESSAGES): string {
  return GIFTICON_ERROR_MESSAGES[action];
}
