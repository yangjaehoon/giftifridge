import React from 'react';
import { Text } from 'react-native';
import { act, render } from '@testing-library/react-native';
import {
  EmailAuthProvider,
  linkWithCredential,
  onAuthStateChanged,
  signInAnonymously,
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
} from 'firebase/auth';
import { AuthProvider, useAuth } from './AuthContext';

jest.mock('../../../lib/firebase/config', () => ({
  auth: { currentUser: null },
  isFirebaseConfigured: true,
}));

jest.mock('firebase/auth', () => ({
  EmailAuthProvider: { credential: jest.fn(() => 'mock-credential') },
  linkWithCredential: jest.fn(),
  onAuthStateChanged: jest.fn(),
  signInAnonymously: jest.fn(),
  signInWithEmailAndPassword: jest.fn(),
  signOut: jest.fn(),
}));

// eslint-disable-next-line @typescript-eslint/no-require-imports
const config = require('../../../lib/firebase/config') as {
  auth: { currentUser: unknown };
};

const mockedOnAuthStateChanged = onAuthStateChanged as jest.Mock;
const mockedSignInAnonymously = signInAnonymously as jest.Mock;
const mockedLinkWithCredential = linkWithCredential as jest.Mock;

// Mutable holder so tests can reach into the live context value; the field is
// updated from an effect, never during render.
const captured: { value: ReturnType<typeof useAuth> | null } = { value: null };
const authValue = () => {
  if (!captured.value) throw new Error('AuthProvider not rendered yet');
  return captured.value;
};

function Probe() {
  const ctx = useAuth();
  React.useEffect(() => {
    captured.value = ctx;
  }, [ctx]);
  return (
    <>
      <Text testID="initializing">{String(ctx.initializing)}</Text>
      <Text testID="anonymous">{String(ctx.isAnonymous)}</Text>
      <Text testID="error">{ctx.authError ?? 'none'}</Text>
    </>
  );
}

async function renderProvider() {
  return render(
    <AuthProvider>
      <Probe />
    </AuthProvider>,
  );
}

beforeEach(() => {
  jest.clearAllMocks();
  captured.value = null;
  config.auth.currentUser = null;
  mockedSignInAnonymously.mockResolvedValue({});
});

describe('AuthProvider', () => {
  it('signs in anonymously when the auth listener reports no user', async () => {
    let emit: (user: unknown) => void = () => {};
    mockedOnAuthStateChanged.mockImplementation((_auth, cb) => {
      emit = cb;
      return jest.fn();
    });

    await renderProvider();

    await act(async () => {
      emit(null);
    });

    expect(mockedSignInAnonymously).toHaveBeenCalledTimes(1);
  });

  it('exposes the signed-in user and stops initializing once a user arrives', async () => {
    let emit: (user: unknown) => void = () => {};
    mockedOnAuthStateChanged.mockImplementation((_auth, cb) => {
      emit = cb;
      return jest.fn();
    });

    const { getByTestId } = await renderProvider();

    await act(async () => {
      emit({ isAnonymous: false, uid: 'u1' });
    });

    expect(getByTestId('initializing').props.children).toBe('false');
    expect(getByTestId('anonymous').props.children).toBe('false');
  });

  it('surfaces an auth error when the anonymous sign-in fails', async () => {
    mockedSignInAnonymously.mockRejectedValue(new Error('network'));
    let emit: (user: unknown) => void = () => {};
    mockedOnAuthStateChanged.mockImplementation((_auth, cb) => {
      emit = cb;
      return jest.fn();
    });

    const { getByTestId } = await renderProvider();

    await act(async () => {
      emit(null);
    });

    expect(getByTestId('error').props.children).toBe('로그인 정보를 확인하지 못했어요.');
  });

  it('retryAnonymousSignIn clears the error and signs in again', async () => {
    mockedSignInAnonymously.mockRejectedValueOnce(new Error('network'));
    let emit: (user: unknown) => void = () => {};
    mockedOnAuthStateChanged.mockImplementation((_auth, cb) => {
      emit = cb;
      return jest.fn();
    });

    const { getByTestId } = await renderProvider();
    await act(async () => {
      emit(null);
    });
    expect(getByTestId('error').props.children).not.toBe('none');

    await act(async () => {
      authValue().retryAnonymousSignIn();
    });

    expect(mockedSignInAnonymously).toHaveBeenCalledTimes(2);
    expect(getByTestId('error').props.children).toBe('none');
  });

  it('signIn delegates to signInWithEmailAndPassword', async () => {
    mockedOnAuthStateChanged.mockReturnValue(jest.fn());
    await renderProvider();

    await act(async () => {
      await authValue().signIn('a@b.com', 'pw');
    });

    expect(signInWithEmailAndPassword).toHaveBeenCalledWith(expect.anything(), 'a@b.com', 'pw');
  });

  it('linkEmail links a credential onto the current anonymous account', async () => {
    config.auth.currentUser = { isAnonymous: true };
    mockedOnAuthStateChanged.mockReturnValue(jest.fn());
    await renderProvider();

    await act(async () => {
      await authValue().linkEmail('a@b.com', 'pw');
    });

    expect(EmailAuthProvider.credential).toHaveBeenCalledWith('a@b.com', 'pw');
    expect(mockedLinkWithCredential).toHaveBeenCalledWith({ isAnonymous: true }, 'mock-credential');
  });

  it('linkEmail refuses when there is no anonymous account to upgrade', async () => {
    config.auth.currentUser = { isAnonymous: false };
    mockedOnAuthStateChanged.mockReturnValue(jest.fn());
    await renderProvider();

    await expect(authValue().linkEmail('a@b.com', 'pw')).rejects.toThrow(
      'no anonymous account to upgrade',
    );
  });

  it('signOut delegates to firebase signOut', async () => {
    mockedOnAuthStateChanged.mockReturnValue(jest.fn());
    await renderProvider();

    await act(async () => {
      await authValue().signOut();
    });

    expect(firebaseSignOut).toHaveBeenCalledTimes(1);
  });
});
