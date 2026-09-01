import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import {
  EmailAuthProvider,
  linkWithCredential,
  onAuthStateChanged,
  signInAnonymously,
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  type User,
} from 'firebase/auth';
import { auth, isFirebaseConfigured } from '../../../lib/firebase/config';

interface AuthContextValue {
  user: User | null;
  isAnonymous: boolean;
  initializing: boolean;
  authError: string | null;
  retryAnonymousSignIn: () => void;
  signIn: (email: string, password: string) => Promise<void>;
  linkEmail: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [initializing, setInitializing] = useState(isFirebaseConfigured);
  const [authError, setAuthError] = useState<string | null>(null);

  const attemptAnonymousSignIn = () => {
    signInAnonymously(auth).catch(() => {
      setAuthError('로그인 정보를 확인하지 못했어요.');
      setInitializing(false);
    });
  };

  useEffect(() => {
    if (!isFirebaseConfigured) return;
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      if (!u) {
        attemptAnonymousSignIn();
        return;
      }
      setAuthError(null);
      setUser(u);
      setInitializing(false);
    });
    return unsubscribe;
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      isAnonymous: user?.isAnonymous ?? true,
      initializing,
      authError,
      retryAnonymousSignIn: () => {
        setAuthError(null);
        setInitializing(true);
        attemptAnonymousSignIn();
      },
      signIn: async (email, password) => {
        await signInWithEmailAndPassword(auth, email, password);
      },
      linkEmail: async (email, password) => {
        const current = auth.currentUser;
        // linkEmail only ever upgrades the current anonymous account. The old
        // fallback here called createUserWithEmailAndPassword, which silently
        // signed into a brand-new account and stranded the anonymous one (and
        // every gifticon on it). The Settings UI only offers this while
        // anonymous, so anything else is a bug, not a sign-up path.
        if (!current || !current.isAnonymous) {
          throw new Error('linkEmail: no anonymous account to upgrade');
        }
        const credential = EmailAuthProvider.credential(email, password);
        await linkWithCredential(current, credential);
      },
      signOut: async () => {
        await firebaseSignOut(auth);
      },
    }),
    [user, initializing, authError],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
