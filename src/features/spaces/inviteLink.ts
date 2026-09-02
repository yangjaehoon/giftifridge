// Single source of truth for the `giftifridge://join/<spaceId>` invite format,
// shared by the deep-link handler (RootNavigator) and the manual "코드로 참여"
// entry (JoinSpaceScreen).
const JOIN_PATH_RE = /join\/([^/?#]+)/;
const INVITE_URL_RE = /^giftifridge:\/\/join\/([^/?#]+)/;

export function buildInviteUrl(spaceId: string): string {
  return `giftifridge://join/${spaceId}`;
}

/** Strict: only a well-formed invite URL yields an id. Used for deep links. */
export function parseInviteUrl(url: string | null | undefined): string | undefined {
  if (!url) return undefined;
  return url.match(INVITE_URL_RE)?.[1];
}

/**
 * Lenient: accepts a full invite link or a bare pasted code. Used for the
 * manual invite-code field, where the user may paste either.
 */
export function extractSpaceCode(input: string): string {
  const trimmed = input.trim();
  return trimmed.match(JOIN_PATH_RE)?.[1] ?? trimmed;
}
