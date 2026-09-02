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
