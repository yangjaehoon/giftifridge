const SPACE_ERROR_MESSAGES = {
  create: '스페이스를 만들지 못했어요. 다시 시도해주세요.',
  join: '스페이스에 참여하지 못했어요. 링크나 코드를 확인해주세요.',
  leave: '스페이스에서 나가지 못했어요.',
  delete: '스페이스를 삭제하지 못했어요.',
  load: '스페이스 정보를 불러오지 못했어요.',
  notFound: '스페이스를 찾을 수 없어요.',
  network: '네트워크 연결을 확인해주세요. 오프라인 상태일 수 있어요.',
  permission: '이 스페이스에 대한 접근 권한이 없어요.',
} as const;

export function getSpaceErrorMessage(action: keyof typeof SPACE_ERROR_MESSAGES): string {
  return SPACE_ERROR_MESSAGES[action];
}
