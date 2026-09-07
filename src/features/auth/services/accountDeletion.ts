import { callDeleteAccount } from '../../../lib/firebase/functions';
import { signOut } from '../../../lib/firebase/auth';

/**
 * Runs the server-side account + data teardown, then drops the local session.
 *
 * The Cloud Function deletes the Firebase Auth user along with every gifticon it
 * owns (and their images), every space it owns, and its space memberships. Once
 * that user is gone its ID token is dead, so signing out here hands control back
 * to AuthContext cleanly — its onAuthStateChanged fires null and it signs the
 * device back in anonymously — instead of the app briefly holding a token for a
 * user that no longer exists.
 *
 * If the Cloud Function call fails the sign-out is skipped, so the user keeps
 * their session and data and can retry.
 */
export async function deleteAccount(): Promise<void> {
  await callDeleteAccount();
  await signOut();
}
