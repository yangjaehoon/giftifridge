import type { DocumentData } from '../../../lib/firebase/firestore';
import type { Space, SpaceMember } from '../types';

// Mirror of gifticonMapper: Firestore only guarantees the field types the
// security rules enforce going forward, so a doc written before those rules (or
// by a future schema change) can be missing required strings. Drop anything
// that isn't a usable Space/SpaceMember rather than letting `undefined` reach
// the UI (a nameless switcher chip, `ROLE_LABELS[undefined]`, a broken sort).

export function toSpace(id: string, data: DocumentData): Space | null {
  if (
    typeof data.name !== 'string' ||
    typeof data.ownerId !== 'string' ||
    typeof data.createdAt !== 'string'
  ) {
    return null;
  }
  return { id, name: data.name, ownerId: data.ownerId, createdAt: data.createdAt };
}

export function toSpaceMember(data: DocumentData): SpaceMember | null {
  if (
    typeof data.uid !== 'string' ||
    (data.role !== 'owner' && data.role !== 'member') ||
    typeof data.joinedAt !== 'string'
  ) {
    return null;
  }
  return { uid: data.uid, role: data.role, joinedAt: data.joinedAt };
}
