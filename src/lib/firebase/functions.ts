import { getApp } from 'firebase/app';
import { getFunctions, httpsCallable } from 'firebase/functions';

// The one module that touches firebase/functions, mirroring ./auth, ./firestore
// and ./storage. Callables are deployed to asia-northeast3 (see
// functions/index.js REGION); the region here must match or the SDK builds the
// wrong URL. Tests mock this file, not firebase/functions.

const REGION = 'asia-northeast3';

/**
 * Invokes the `deleteAccount` Cloud Function for the current user. The function
 * reads the caller's uid from the auth context — no argument is needed — and
 * deletes the account and everything it owns server-side. Rejects if the call
 * fails so the caller can keep the local session intact and let the user retry.
 */
export async function callDeleteAccount(): Promise<void> {
  const functions = getFunctions(getApp(), REGION);
  await httpsCallable(functions, 'deleteAccount')();
}
