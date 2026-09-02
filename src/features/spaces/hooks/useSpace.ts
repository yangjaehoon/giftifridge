import { useEffect, useState } from 'react';
import { useFirestoreDoc } from '../../../shared/hooks/useFirestoreDoc';
import { subscribeToSpace, subscribeToSpaceMembers } from '../services/spaceService';
import type { Space, SpaceMember } from '../types';

export function useSpace(spaceId: string | undefined) {
  const {
    data: space,
    loading,
    error: spaceError,
    refresh: refreshSpace,
  } = useFirestoreDoc<Space>(spaceId, subscribeToSpace);

  const [members, setMembers] = useState<SpaceMember[]>([]);
  const [membersError, setMembersError] = useState<Error | null>(null);
  const [membersRefreshKey, setMembersRefreshKey] = useState(0);

  useEffect(() => {
    if (!spaceId) return;
    const unsubscribe = subscribeToSpaceMembers(
      spaceId,
      (next) => {
        setMembers(next);
        setMembersError(null);
      },
      setMembersError,
    );
    return unsubscribe;
  }, [spaceId, membersRefreshKey]);

  return {
    space,
    members: spaceId ? members : [],
    loading,
    error: spaceError ?? membersError,
    refresh: () => {
      refreshSpace();
      setMembersRefreshKey((k) => k + 1);
    },
  };
}
