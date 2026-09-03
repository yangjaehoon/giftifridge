import {
  EmailAuthProvider,
  linkWithCredential,
  onAuthStateChanged,
  signInAnonymously as fbSignInAnonymously,
  signInWithEmailAndPassword,
  signOut as fbSignOut,
  type User,
} from 'firebase/auth';
import { auth } from './config';

// The one module that touches firebase/auth and the `auth` handle, mirroring
// ./firestore and ./storage. AuthContext depends on this narrow surface instead
// of the SDK + the global singleton, and tests mock this file.

export function subscribeToAuthState(onChange: (user: User | null) => void) {
  return onAuthStateChanged(auth, onChange);
}

export function signInAnonymously() {
  return fbSignInAnonymously(auth);
}

export function signInWithEmail(email: string, password: string) {
  return signInWithEmailAndPassword(auth, email, password);
}

export function signOut() {
  return fbSignOut(auth);
}

/** The raw current user, for checks the SDK only answers synchronously. */
export function getCurrentAuthUser(): User | null {
  return auth.currentUser;
}

export function linkEmailCredential(user: User, email: string, password: string) {
  return linkWithCredential(user, EmailAuthProvider.credential(email, password));
}

export type { User };
