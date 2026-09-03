import * as fb from 'firebase/auth';
import {
  getCurrentAuthUser,
  linkEmailCredential,
  signInAnonymously,
  signInWithEmail,
  signOut,
  subscribeToAuthState,
} from './auth';

jest.mock('./config', () => ({ auth: { currentUser: { uid: 'current' } } }));

jest.mock('firebase/auth', () => ({
  EmailAuthProvider: { credential: jest.fn((email, pw) => `cred:${email}:${pw}`) },
  linkWithCredential: jest.fn(),
  onAuthStateChanged: jest.fn(() => jest.fn()),
  signInAnonymously: jest.fn(),
  signInWithEmailAndPassword: jest.fn(),
  signOut: jest.fn(),
}));

const authHandle = { currentUser: { uid: 'current' } };

beforeEach(() => jest.clearAllMocks());

describe('lib/firebase/auth', () => {
  it('subscribeToAuthState wires onAuthStateChanged to the auth handle', () => {
    const cb = jest.fn();
    const unsub = jest.fn();
    (fb.onAuthStateChanged as jest.Mock).mockReturnValue(unsub);

    expect(subscribeToAuthState(cb)).toBe(unsub);
    expect(fb.onAuthStateChanged).toHaveBeenCalledWith(authHandle, cb);
  });

  it('signInAnonymously passes the auth handle', () => {
    signInAnonymously();
    expect(fb.signInAnonymously).toHaveBeenCalledWith(authHandle);
  });

  it('signInWithEmail passes the auth handle and credentials', () => {
    signInWithEmail('a@b.com', 'pw');
    expect(fb.signInWithEmailAndPassword).toHaveBeenCalledWith(authHandle, 'a@b.com', 'pw');
  });

  it('signOut passes the auth handle', () => {
    signOut();
    expect(fb.signOut).toHaveBeenCalledWith(authHandle);
  });

  it('getCurrentAuthUser reads currentUser off the handle', () => {
    expect(getCurrentAuthUser()).toEqual({ uid: 'current' });
  });

  it('linkEmailCredential builds an email credential and links it', () => {
    const user = { uid: 'u' } as never;
    linkEmailCredential(user, 'a@b.com', 'pw');

    expect(fb.EmailAuthProvider.credential).toHaveBeenCalledWith('a@b.com', 'pw');
    expect(fb.linkWithCredential).toHaveBeenCalledWith(user, 'cred:a@b.com:pw');
  });
});
