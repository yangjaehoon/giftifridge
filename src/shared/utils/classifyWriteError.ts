import { TimeoutError } from './withTimeout';
import { isPermissionDenied } from './firebaseError';

export type WriteErrorKind = 'timeout' | 'permission' | 'other';

/**
 * Single place that decides what *kind* of failure a Firestore write threw, so
 * every screen doesn't re-implement the `instanceof TimeoutError → isPermissionDenied → …`
 * chain. Feature error modules turn the kind into a user-facing message.
 */
export function classifyWriteError(err: unknown): WriteErrorKind {
  if (err instanceof TimeoutError) return 'timeout';
  if (isPermissionDenied(err)) return 'permission';
  return 'other';
}

/**
 * Messages for write-error kinds whose wording doesn't depend on the feature.
 * Each feature's error map spreads this in; kinds that read better per feature
 * (e.g. `permission`) are overridden there. A new feature-agnostic kind is
 * added here once rather than in every feature map.
 */
export const WRITE_ERROR_MESSAGES = {
  // A request that ran long enough to time out may still have committed on the
  // server, so don't tell the user it failed outright.
  timeout: '응답이 늦어지고 있어요. 잠시 후 목록에서 확인해주세요.',
} as const;
