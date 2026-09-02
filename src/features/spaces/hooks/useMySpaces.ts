import { useFirestoreList } from '../../../shared/hooks/useFirestoreList';
import { subscribeToMySpaces } from '../services/spaceService';
import type { Space } from '../types';

export function useMySpaces(uid: string | undefined) {
  const { items, loading, error } = useFirestoreList<Space>(uid, subscribeToMySpaces);
  return { spaces: items, loading, error };
}
