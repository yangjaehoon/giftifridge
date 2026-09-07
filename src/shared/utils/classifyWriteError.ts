import { TimeoutError } from './withTimeout';
import { isPermissionDenied, isStorageError } from './firebaseError';

export type WriteErrorKind = 'timeout' | 'permission' | 'upload' | 'other';

/**
 * Single place that decides what *kind* of failure a write threw, so every
 * screen doesn't re-implement the `instanceof TimeoutError → isPermissionDenied → …`
 * chain. Feature error modules turn the kind into a user-facing message.
 */
export function classifyWriteError(err: unknown): WriteErrorKind {
  if (err instanceof TimeoutError) return 'timeout';
  if (isPermissionDenied(err)) return 'permission';
  // A save that uploads an image (a gifticon photo) can fail in Storage before
  // the Firestore write is even attempted — a distinct failure the user can act
  // on (retake/retry the photo), not the same as a generic write error.
  if (isStorageError(err)) return 'upload';
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
  upload: '사진을 업로드하지 못했어요. 잠시 후 다시 시도해주세요.',
} as const;

/** Every write-error kind that maps to a message (i.e. all but the catch-all
 *  `other`). A feature's message map must cover these — `timeout`/`upload` come
 *  from spreading WRITE_ERROR_MESSAGES, `permission` each feature words itself. */
type MessagedWriteErrorKind = Exclude<WriteErrorKind, 'other'>;

/**
 * Builds a feature's two error-message lookups from its message map, so each
 * `errors.ts` doesn't re-hand-roll the identical pair:
 *   - `get(key)`      — the message for a known action/kind
 *   - `getWrite(err, fallback)` — classify a thrown write error and return its
 *     message, falling back to `fallback` for the "other" case
 */
export function makeErrorMessages<
  M extends Record<MessagedWriteErrorKind, string> & Record<string, string>,
>(messages: M) {
  const get = (key: keyof M): string => messages[key];
  return {
    get,
    getWrite: (err: unknown, fallback: keyof M): string => {
      const kind = classifyWriteError(err);
      return get(kind === 'other' ? fallback : kind);
    },
  };
}
