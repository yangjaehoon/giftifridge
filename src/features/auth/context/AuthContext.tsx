import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { isFirebaseConfigured } from '../../../lib/firebase/config';
import {
  getCurrentAuthUser,
  linkEmailCredential,
  signInAnonymously,
  signInWithEmail,
  signOut as authSignOut,
  subscribeToAuthState,
  type User,
} from '../../../lib/firebase/auth';
import type { AppUser } from '../types';

interface CurrentUser {
  user: AppUser | null;
  isAnonymous: boolean;
}

interface AuthActions {
  signIn: (email: string, password: string) => Promise<void>;
  linkEmail: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
}

interface AuthBootstrap {
  initializing: boolean;
  authError: string | null;
  retryAnonymousSignIn: () => void;
}

type AuthContextValue = CurrentUser & AuthActions & AuthBootstrap;

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

// Guard against onAuthStateChanged(null) → signInAnonymously → onAuthStateChanged(null)
// looping forever if the anonymous session keeps getting invalidated (e.g.
// Anonymous sign-in disabled mid-session).
const MAX_ANON_ATTEMPTS = 3;

const toAppUser = (u: User): AppUser => ({ uid: u.uid, email: u.email ?? null });

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AppUser | null>(null);
  const [isAnonymous, setIsAnonymous] = useState(true);
  const [initializing, setInitializing] = useState(isFirebaseConfigured);
  const [authError, setAuthError] = useState<string | null>(null);
  const anonAttemptsRef = useRef(0);

  const failAnonymousSignIn = useCallback(() => {
    setAuthError('로그인 정보를 확인하지 못했어요.');
    setInitializing(false);
  }, []);

  const attemptAnonymousSignIn = useCallback(() => {
    if (anonAttemptsRef.current >= MAX_ANON_ATTEMPTS) {
      failAnonymousSignIn();
      return;
    }
    anonAttemptsRef.current += 1;
    signInAnonymously().catch(failAnonymousSignIn);
  }, [failAnonymousSignIn]);

  useEffect(() => {
    if (!isFirebaseConfigured) return;
    const unsubscribe = subscribeToAuthState((u) => {
      if (!u) {
        attemptAnonymousSignIn();
        return;
      }
      anonAttemptsRef.current = 0;
      setAuthError(null);
      setUser(toAppUser(u));
      setIsAnonymous(u.isAnonymous);
      setInitializing(false);
    });
    return unsubscribe;
  }, [attemptAnonymousSignIn]);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      isAnonymous,
      initializing,
      authError,
      retryAnonymousSignIn: () => {
        anonAttemptsRef.current = 0;
        setAuthError(null);
        setInitializing(true);
        attemptAnonymousSignIn();
      },
      signIn: async (email, password) => {
        await signInWithEmail(email, password);
      },
      linkEmail: async (email, password) => {
        const current = getCurrentAuthUser();
        // linkEmail only ever upgrades the current anonymous account. The old
        // fallback here called createUserWithEmailAndPassword, which silently
        // signed into a brand-new account and stranded the anonymous one (and
        // every gifticon on it). The Settings UI only offers this while
        // anonymous, so anything else is a bug, not a sign-up path.
        if (!current || !current.isAnonymous) {
          throw new Error('linkEmail: no anonymous account to upgrade');
        }
        await linkEmailCredential(current, email, password);
      },
      signOut: async () => {
        await authSignOut();
      },
    }),
    [user, isAnonymous, initializing, authError, attemptAnonymousSignIn],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

function useAuthContext(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('Auth hooks must be used within AuthProvider');
  return ctx;
}

/** Just the identity — for screens that only care who is signed in. */
export function useCurrentUser(): CurrentUser {
  const { user, isAnonymous } = useAuthContext();
  return { user, isAnonymous };
}

/** The sign-in/link/sign-out operations — for the Settings screen. */
export function useAuthActions(): AuthActions {
  const { signIn, linkEmail, signOut } = useAuthContext();
  return { signIn, linkEmail, signOut };
}

/** Startup state — for the root navigator's gate. */
export function useAuthBootstrap(): AuthBootstrap {
  const { initializing, authError, retryAnonymousSignIn } = useAuthContext();
  return { initializing, authError, retryAnonymousSignIn };
}
