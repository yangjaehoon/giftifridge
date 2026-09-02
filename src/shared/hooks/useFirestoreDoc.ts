import { useEffect, useRef, useState } from 'react';

const MAX_RETRY_DELAY_MS = 30000;

type Unsubscribe = () => void;
type Subscribe<T> = (
  key: string,
  onChange: (doc: T | null) => void,
  onError: (error: Error) => void,
) => Unsubscribe;

/**
 * Single-document counterpart to useFirestoreList: subscribes to one Firestore
 * document keyed by `key`, retries listener errors with exponential backoff, and
 * resets to a clean loading state when `key` changes so the screen doesn't flash
 * the previous document (or a stale "not found") until the new snapshot lands.
 */
export function useFirestoreDoc<T>(key: string | undefined, subscribe: Subscribe<T>) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [prevKey, setPrevKey] = useState(key);
  const retryCountRef = useRef(0);
  const subscribedKeyRef = useRef(key);

  if (key !== prevKey) {
    setPrevKey(key);
    setData(null);
    setLoading(Boolean(key));
    setError(null);
  }

  useEffect(() => {
    if (!key) return;
    if (subscribedKeyRef.current !== key) {
      subscribedKeyRef.current = key;
      retryCountRef.current = 0;
    }
    let retryTimeout: ReturnType<typeof setTimeout>;

    const unsubscribe = subscribe(
      key,
      (next) => {
        retryCountRef.current = 0;
        setData(next);
        setLoading(false);
        setError(null);
      },
      (err) => {
        setError(err);
        setLoading(false);
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
    data: key ? data : null,
    loading: key ? loading : false,
    error,
    refresh: () => setRefreshKey((k) => k + 1),
  };
}
