import { useFirestoreDoc } from '../../../shared/hooks/useFirestoreDoc';
import { useFirestoreList } from '../../../shared/hooks/useFirestoreList';
import { subscribeToSpace, subscribeToSpaceMembers } from '../services/spaceService';
import type { Space, SpaceMember } from '../types';

/**
 * Combines the space document and its member list. Both halves are plain
 * `(key, onChange, onError) => unsubscribe` subscriptions, so each is delegated
 * to the matching generic hook (backoff, key-change reset, refresh) rather than
 * re-implemented here — this hook only merges the two results.
 */
export function useSpace(spaceId: string | undefined) {
  const {
    data: space,
    loading,
    error: spaceError,
    refresh: refreshSpace,
  } = useFirestoreDoc<Space>(spaceId, subscribeToSpace);

  const {
    items: members,
    error: membersError,
    refresh: refreshMembers,
  } = useFirestoreList<SpaceMember>(spaceId, subscribeToSpaceMembers);

  return {
    space,
    members,
    loading,
    error: spaceError ?? membersError,
    refresh: () => {
      refreshSpace();
      refreshMembers();
    },
  };
}
