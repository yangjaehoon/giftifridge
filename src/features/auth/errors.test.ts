import { getAuthErrorMessage } from './errors';

describe('getAuthErrorMessage', () => {
  it('maps known Firebase Auth error codes to Korean messages', () => {
    expect(getAuthErrorMessage({ code: 'auth/invalid-email' })).toMatch(/이메일 형식/);
    expect(getAuthErrorMessage({ code: 'auth/email-already-in-use' })).toMatch(/이미 가입/);
    expect(getAuthErrorMessage({ code: 'auth/weak-password' })).toMatch(/6자 이상/);
  });

  it('maps every credential-mismatch code to the same message', () => {
    const invalidCredential = getAuthErrorMessage({ code: 'auth/invalid-credential' });
    expect(getAuthErrorMessage({ code: 'auth/wrong-password' })).toBe(invalidCredential);
    expect(getAuthErrorMessage({ code: 'auth/user-not-found' })).toBe(invalidCredential);
  });

  it('falls back to a generic message for unknown or missing codes', () => {
    expect(getAuthErrorMessage({ code: 'auth/something-new' })).toMatch(/다시 시도/);
    expect(getAuthErrorMessage(new Error('network down'))).toMatch(/다시 시도/);
    expect(getAuthErrorMessage(undefined)).toMatch(/다시 시도/);
  });
});
