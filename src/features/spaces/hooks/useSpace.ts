import { useEffect, useState } from 'react';
import { subscribeToSpace, subscribeToSpaceMembers } from '../services/spaceService';
import type { Space, SpaceMember } from '../types';

export function useSpace(spaceId: string | undefined) {
  const [space, setSpace] = useState<Space | null>(null);
  const [members, setMembers] = useState<SpaceMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    if (!spaceId) return;
    const unsubscribeSpace = subscribeToSpace(
      spaceId,
      (next) => {
        setSpace(next);
        setLoading(false);
        setError(null);
      },
      (err) => {
        setError(err);
        setLoading(false);
      },
    );
    const unsubscribeMembers = subscribeToSpaceMembers(spaceId, setMembers, setError);
    return () => {
      unsubscribeSpace();
      unsubscribeMembers();
    };
  }, [spaceId, refreshKey]);

  return {
    space: spaceId ? space : null,
    members: spaceId ? members : [],
    loading: spaceId ? loading : false,
    error,
    refresh: () => setRefreshKey((k) => k + 1),
  };
}
