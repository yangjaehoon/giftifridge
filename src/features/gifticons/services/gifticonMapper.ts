import type { DocumentData } from '../../../lib/firebase/firestore';
import type { Gifticon } from '../types';

// Translation between the raw Firestore doc shape and the domain Gifticon,
// kept out of the CRUD service so "what a valid stored gifticon looks like"
// has one home.

// Firestore rejects any field explicitly set to `undefined` (e.g. an unset
// optional barcode/amount/location/spaceId) unless ignoreUndefinedProperties
// is configured, which it isn't — so strip those keys before writing.
export function omitUndefined<T extends object>(data: T): Partial<T> {
  return Object.fromEntries(
    Object.entries(data).filter(([, value]) => value !== undefined),
  ) as Partial<T>;
}

// Firestore only guarantees the field types the security rules enforce going
// forward; a doc written before those rules (or by a future schema change) can
// still be missing required strings, which would render as `D-NaN` and crash
// date math downstream. Drop anything that isn't a usable Gifticon.
export function toGifticon(id: string, data: DocumentData): Gifticon | null {
  if (
    typeof data.ownerId !== 'string' ||
    typeof data.name !== 'string' ||
    typeof data.brand !== 'string' ||
    typeof data.category !== 'string' ||
    typeof data.imageUrl !== 'string' ||
    typeof data.expiresAt !== 'string' ||
    Number.isNaN(new Date(data.expiresAt).getTime())
  ) {
    return null;
  }
  return { id, ...(data as Omit<Gifticon, 'id'>) };
}
