import React from 'react';
import { Text } from 'react-native';
import { act, render } from '@testing-library/react-native';
import {
  getCurrentAuthUser,
  linkEmailCredential,
  signInAnonymously,
  signInWithEmail,
  signOut as authSignOut,
  subscribeToAuthState,
} from '../../../lib/firebase/auth';
import { AuthProvider, useAuthActions, useAuthBootstrap, useCurrentUser } from './AuthContext';

jest.mock('../../../lib/firebase/config', () => ({ isFirebaseConfigured: true }));

jest.mock('../../../lib/firebase/auth', () => ({
  subscribeToAuthState: jest.fn(),
  signInAnonymously: jest.fn(),
  signInWithEmail: jest.fn(),
  signOut: jest.fn(),
  getCurrentAuthUser: jest.fn(() => null),
  linkEmailCredential: jest.fn(),
}));

const mockedSubscribe = subscribeToAuthState as jest.Mock;
const mockedSignInAnonymously = signInAnonymously as jest.Mock;
const mockedGetCurrentAuthUser = getCurrentAuthUser as jest.Mock;
const mockedLinkEmailCredential = linkEmailCredential as jest.Mock;

type AuthValue = ReturnType<typeof useCurrentUser> &
  ReturnType<typeof useAuthActions> &
  ReturnType<typeof useAuthBootstrap>;

// Mutable holder so tests can reach into the live context value; the field is
// updated from an effect, never during render.
const captured: { value: AuthValue | null } = { value: null };
const authValue = () => {
  if (!captured.value) throw new Error('AuthProvider not rendered yet');
  return captured.value;
};

function Probe() {
  const ctx: AuthValue = { ...useCurrentUser(), ...useAuthActions(), ...useAuthBootstrap() };
  React.useEffect(() => {
    captured.value = ctx;
  });
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
  mockedGetCurrentAuthUser.mockReturnValue(null);
  mockedSignInAnonymously.mockResolvedValue({});
});

describe('AuthProvider', () => {
  it('signs in anonymously when the auth listener reports no user', async () => {
    let emit: (user: unknown) => void = () => {};
    mockedSubscribe.mockImplementation((cb) => {
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
    mockedSubscribe.mockImplementation((cb) => {
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
    mockedSubscribe.mockImplementation((cb) => {
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
    mockedSubscribe.mockImplementation((cb) => {
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

  it('stops retrying anonymous sign-in after 3 consecutive failures', async () => {
    let emit: (user: unknown) => void = () => {};
    mockedSubscribe.mockImplementation((cb) => {
      emit = cb;
      return jest.fn();
    });
    // Every attempt "succeeds" but the session is immediately invalidated, so
    // onAuthStateChanged keeps firing null — the classic loop this guards against.
    mockedSignInAnonymously.mockImplementation(async () => {
      emit(null);
      return {};
    });

    await renderProvider();
    await act(async () => {
      emit(null);
    });

    // 3 attempts, then it gives up and surfaces the error instead of looping.
    expect(mockedSignInAnonymously).toHaveBeenCalledTimes(3);
  });

  it('resets the retry budget after retryAnonymousSignIn', async () => {
    let emit: (user: unknown) => void = () => {};
    mockedSubscribe.mockImplementation((cb) => {
      emit = cb;
      return jest.fn();
    });
    mockedSignInAnonymously.mockImplementation(async () => {
      emit(null);
      return {};
    });

    await renderProvider();
    await act(async () => {
      emit(null);
    });
    expect(mockedSignInAnonymously).toHaveBeenCalledTimes(3);

    await act(async () => {
      authValue().retryAnonymousSignIn();
    });

    // Budget reset → 3 more attempts.
    expect(mockedSignInAnonymously).toHaveBeenCalledTimes(6);
  });

  it('signIn delegates to the email sign-in wrapper', async () => {
    mockedSubscribe.mockReturnValue(jest.fn());
    await renderProvider();

    await act(async () => {
      await authValue().signIn('a@b.com', 'pw');
    });

    expect(signInWithEmail).toHaveBeenCalledWith('a@b.com', 'pw');
  });

  it('linkEmail links a credential onto the current anonymous account', async () => {
    mockedGetCurrentAuthUser.mockReturnValue({ isAnonymous: true });
    mockedSubscribe.mockReturnValue(jest.fn());
    await renderProvider();

    await act(async () => {
      await authValue().linkEmail('a@b.com', 'pw');
    });

    expect(mockedLinkEmailCredential).toHaveBeenCalledWith({ isAnonymous: true }, 'a@b.com', 'pw');
  });

  it('linkEmail refuses when there is no anonymous account to upgrade', async () => {
    mockedGetCurrentAuthUser.mockReturnValue({ isAnonymous: false });
    mockedSubscribe.mockReturnValue(jest.fn());
    await renderProvider();

    await expect(authValue().linkEmail('a@b.com', 'pw')).rejects.toThrow(
      'no anonymous account to upgrade',
    );
  });

  it('signOut delegates to the sign-out wrapper', async () => {
    mockedSubscribe.mockReturnValue(jest.fn());
    await renderProvider();

    await act(async () => {
      await authValue().signOut();
    });

    expect(authSignOut).toHaveBeenCalledTimes(1);
  });
});
