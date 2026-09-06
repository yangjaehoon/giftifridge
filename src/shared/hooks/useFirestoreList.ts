import { useEffect, useRef, useState } from 'react';

const MAX_RETRY_DELAY_MS = 30000;

// Stable reference so consumers that depend on `items` (e.g. useCallback/useEffect
// deps) don't re-run every render while `key` is unset. Frozen at runtime
// because it is shared across every hook instance — a stray in-place sort/push
// would corrupt all of them. (Typed as never[] so the hook's return stays T[].)
const EMPTY_ITEMS = Object.freeze([]) as never[];

type Unsubscribe = () => void;

/**
 * Per-snapshot metadata. `fromCache: true` means the snapshot came from the
 * SDK's own cache without a server round-trip — on a cold start with no
 * network the web Firestore SDK emits an *empty* fromCache snapshot almost
 * immediately, which must not be mistaken for a server-confirmed "you have
 * nothing". Absent meta is treated as server-authoritative.
 */
export interface SnapshotMeta {
  fromCache: boolean;
}

/**
 * A keyed live subscription. Implementations must:
 *  - return an unsubscribe function
 *  - never call `onChange` synchronously during the subscribe call
 * `onError` MAY be called on an unrecoverable subscription failure (the hook
 * then shows an error and retries with backoff); an implementation MAY instead
 * absorb partial failures internally (e.g. subscribeToMySpaces drops a single
 * unreadable space rather than failing the whole list).
 */
type Subscribe<T> = (
  key: string,
  onChange: (items: T[], meta?: SnapshotMeta) => void,
  onError: (error: Error) => void,
) => Unsubscribe;

/**
 * Optional offline mirror. `read` seeds the list on a cold start before any
 * server-confirmed snapshot arrives; `write` is called (fire-and-forget) with
 * every server snapshot so the mirror stays current. A server snapshot —
 * including an empty one — always wins over `read`; an empty *fromCache*
 * snapshot does not.
 */
export interface ListCache<T> {
  read: (key: string) => Promise<T[] | null>;
  write: (key: string, items: T[]) => void;
}

/**
 * Shared shape behind useGifticons/useSpaceGifticons: subscribes to a
 * Firestore query keyed by `key`, retries with backoff on listener errors,
 * and resets to a clean loading state when `key` itself changes (e.g.
 * switching which space is selected) instead of showing the previous key's
 * stale items until the new subscription's first snapshot arrives.
 */
export function useFirestoreList<T>(
  key: string | undefined,
  subscribe: Subscribe<T>,
  cache?: ListCache<T>,
) {
  const [items, setItems] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [prevKey, setPrevKey] = useState(key);
  const retryCountRef = useRef(0);
  const subscribedKeyRef = useRef(key);
  // Whether a server-confirmed snapshot (or any non-empty one) has landed for
  // the current key — once it has, a slow mirror read must not overwrite it.
  const authoritativeRef = useRef(false);
  // The mirror read finished with nothing usable, and a fromCache-only
  // (offline) snapshot has been seen — together these mean "we've done every
  // offline thing we can and there's nothing", so stop the skeleton. Kept
  // separate so a plain mirror miss on an *online* start doesn't flash the
  // empty state before the server snapshot lands.
  const mirrorMissRef = useRef(false);
  const offlineSnapshotSeenRef = useRef(false);

  if (key !== prevKey) {
    setPrevKey(key);
    setItems([]);
    setLoading(true);
    setError(null);
  }

  useEffect(() => {
    if (!key) return;
    // A genuinely new key gets a fresh backoff budget and a fresh
    // "no live snapshot yet" flag; a re-run triggered by the retry itself
    // (refreshKey bump) must keep the growing delay and the flag as they are.
    if (subscribedKeyRef.current !== key) {
      subscribedKeyRef.current = key;
      retryCountRef.current = 0;
      authoritativeRef.current = false;
      mirrorMissRef.current = false;
      offlineSnapshotSeenRef.current = false;
    }
    let retryTimeout: ReturnType<typeof setTimeout>;
    let cancelled = false;

    // "Nothing more is coming and there's nothing to show" — clear the
    // skeleton. Needs a fromCache-only snapshot AND (no mirror, or the mirror
    // came back empty), so an online start with a mirror miss keeps the
    // skeleton until the server reply instead of flashing the empty state.
    const settleIfNothingElseComing = () => {
      if ((!cache || mirrorMissRef.current) && offlineSnapshotSeenRef.current) setLoading(false);
    };

    // Seed from the offline mirror so a cold start with no network still shows
    // the list (the barcode above all). Skipped once a server-confirmed (or
    // any non-empty) snapshot has arrived.
    if (cache) {
      cache.read(key).then((cached) => {
        if (cancelled || authoritativeRef.current) return;
        if (cached && cached.length) {
          setItems((current) => (current.length ? current : cached));
          setLoading(false);
        } else {
          mirrorMissRef.current = true;
          settleIfNothingElseComing();
        }
      });
    }

    const unsubscribe = subscribe(
      key,
      (next, meta) => {
        retryCountRef.current = 0;
        setRefreshing(false);
        setError(null);
        // An empty fromCache snapshot is the SDK saying "nothing cached, haven't
        // reached the server" — it must not block or clear the offline mirror.
        // Anything else (server-confirmed, or any non-empty snapshot) wins.
        if (!meta?.fromCache || next.length > 0) {
          authoritativeRef.current = true;
          setItems(next);
          setLoading(false);
          cache?.write(key, next);
        } else {
          offlineSnapshotSeenRef.current = true;
          settleIfNothingElseComing();
        }
      },
      (err) => {
        setError(err);
        setLoading(false);
        setRefreshing(false);
        // Firestore listener errors (e.g. a transient network hiccup right after
        // cold start) don't retry on their own, so without this the list stays
        // stuck on the error screen until the user manually pulls to refresh.
        const delay = Math.min(1000 * 2 ** retryCountRef.current, MAX_RETRY_DELAY_MS);
        retryCountRef.current += 1;
        retryTimeout = setTimeout(() => setRefreshKey((k) => k + 1), delay);
      },
    );
    return () => {
      cancelled = true;
      unsubscribe();
      clearTimeout(retryTimeout);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, refreshKey]);

  return {
    items: key ? items : EMPTY_ITEMS,
    loading: key ? loading : false,
    refreshing,
    error,
    refresh: () => {
      setRefreshing(true);
      setRefreshKey((k) => k + 1);
    },
  };
}
