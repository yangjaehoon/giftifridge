import { useEffect, useRef, useState } from 'react';

const MAX_RETRY_DELAY_MS = 30000;

type Unsubscribe = () => void;
type Subscribe<T> = (
  key: string,
  onChange: (items: T[]) => void,
  onError: (error: Error) => void,
) => Unsubscribe;

/**
 * Shared shape behind useGifticons/useSpaceGifticons: subscribes to a
 * Firestore query keyed by `key`, retries with backoff on listener errors,
 * and resets to a clean loading state when `key` itself changes (e.g.
 * switching which space is selected) instead of showing the previous key's
 * stale items until the new subscription's first snapshot arrives.
 */
export function useFirestoreList<T>(key: string | undefined, subscribe: Subscribe<T>) {
  const [items, setItems] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [prevKey, setPrevKey] = useState(key);
  const retryCountRef = useRef(0);

  if (key !== prevKey) {
    setPrevKey(key);
    setItems([]);
    setLoading(true);
    setError(null);
  }

  useEffect(() => {
    if (!key) return;
    let retryTimeout: ReturnType<typeof setTimeout>;

    const unsubscribe = subscribe(
      key,
      (next) => {
        retryCountRef.current = 0;
        setItems(next);
        setLoading(false);
        setRefreshing(false);
        setError(null);
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
      unsubscribe();
      clearTimeout(retryTimeout);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, refreshKey]);

  return {
    items: key ? items : [],
    loading: key ? loading : false,
    refreshing,
    error,
    refresh: () => {
      setRefreshing(true);
      setRefreshKey((k) => k + 1);
    },
  };
}
