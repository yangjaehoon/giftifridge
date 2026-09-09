/**
 * The app's view of the signed-in user. Firebase's `User` (dozens of fields and
 * methods) stays inside AuthContext; everything downstream needs only this.
 */
export interface AppUser {
  uid: string;
  email: string | null;
}
