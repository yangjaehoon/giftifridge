import { useEffect, useState } from 'react';
import { subscribeToMySpaces } from '../services/spaceService';
import type { Space } from '../types';

export function useMySpaces(uid: string | undefined) {
  const [spaces, setSpaces] = useState<Space[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!uid) return;
    const unsubscribe = subscribeToMySpaces(
      uid,
      (next) => {
        setSpaces(next);
        setLoading(false);
      },
      (err) => {
        setError(err);
        setLoading(false);
      },
    );
    return unsubscribe;
  }, [uid]);

  return {
    spaces: uid ? spaces : [],
    loading: uid ? loading : false,
    error,
  };
}
