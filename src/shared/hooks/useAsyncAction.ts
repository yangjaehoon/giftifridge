import { useCallback, useState } from 'react';
import { Alert } from 'react-native';

interface RunOptions<T, K> {
  /** Message key to fall back on when the failure doesn't classify to a known
   *  write-error kind (timeout / permission / upload). */
  fallback: K;
  /** Runs only if the op resolved, with its result. Put the toast / haptics /
   *  navigation here. */
  onSuccess?: (result: T) => void;
  /** Extra handling before the error alert (e.g. a `__DEV__` log). The alert
   *  still fires afterward. */
  onError?: (err: unknown) => void;
}

/**
 * The busy-flag + try/catch/finally shell that every "run one async write, then
 * toast/navigate, or alert on failure" handler was repeating by hand. `run`
 * holds `busy` for the duration, calls `onSuccess` only when the op resolved,
 * and on failure shows the single canonical `Alert.alert('오류', …)` via the
 * feature's own resolver (getGifticonWriteErrorMessage / getSpaceWriteErrorMessage).
 * It returns whether the op succeeded, for callers that branch on it.
 *
 * It deliberately does not wrap the op in withTimeout — some services already
 * do that internally and others are wrapped at the call site; `run` leaves that
 * choice where it is.
 */
export function useAsyncAction<K extends string>(
  getWriteErrorMessage: (err: unknown, fallback: K) => string,
) {
  const [busy, setBusy] = useState(false);

  const run = useCallback(
    async <T>(op: () => Promise<T>, opts: RunOptions<T, K>): Promise<boolean> => {
      setBusy(true);
      try {
        const result = await op();
        opts.onSuccess?.(result);
        return true;
      } catch (err) {
        opts.onError?.(err);
        Alert.alert('오류', getWriteErrorMessage(err, opts.fallback));
        return false;
      } finally {
        setBusy(false);
      }
    },
    [getWriteErrorMessage],
  );

  return { busy, run };
}
