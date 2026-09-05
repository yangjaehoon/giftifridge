import {
  arrayRemove,
  arrayUnion,
  collection,
  collectionGroup,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  setDoc,
  updateDoc,
  deleteDoc,
  where,
  writeBatch as fsWriteBatch,
  type DocumentData,
  type Unsubscribe,
} from 'firebase/firestore';
import { db } from './config';

// The one module that touches firebase/firestore and holds the `db` handle, so
// feature services depend on this narrow, domain-shaped surface instead of the
// SDK + a global singleton. Tests mock this file, not firebase/firestore.

export function docRef(path: string, ...segments: string[]) {
  return doc(db, path, ...segments);
}

export function collectionRef(path: string, ...segments: string[]) {
  return collection(db, path, ...segments);
}

export function collectionGroupRef(id: string) {
  return collectionGroup(db, id);
}

/** A client-generated document id within `collectionPath` (no write happens). */
export function newId(collectionPath: string): string {
  return doc(collection(db, collectionPath)).id;
}

export function writeBatch() {
  return fsWriteBatch(db);
}

export {
  arrayRemove,
  arrayUnion,
  getDoc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  setDoc,
  updateDoc,
  deleteDoc,
  where,
};
export type { DocumentData, Unsubscribe };
