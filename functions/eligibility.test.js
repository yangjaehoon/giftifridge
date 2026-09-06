const { isAnonymous, lastActiveMs, isEligibleForCleanup, MAX_IDLE_MS } = require('./eligibility');

const DAY = 24 * 60 * 60 * 1000;
const NOW = Date.parse('2026-09-06T00:00:00Z');

function user(overrides = {}) {
  return {
    uid: 'u1',
    disabled: false,
    providerData: [],
    metadata: { lastRefreshTime: new Date(NOW - 10 * DAY).toISOString() },
    ...overrides,
  };
}

describe('isAnonymous', () => {
  it('is true when there are no linked providers', () => {
    expect(isAnonymous(user({ providerData: [] }))).toBe(true);
    expect(isAnonymous(user({ providerData: undefined }))).toBe(true);
  });

  it('is false once an account is linked', () => {
    expect(isAnonymous(user({ providerData: [{ providerId: 'google.com' }] }))).toBe(false);
  });

  it('is false for an account that carries an email or phone but no provider', () => {
    expect(isAnonymous(user({ email: 'a@b.c' }))).toBe(false);
    expect(isAnonymous(user({ phoneNumber: '+821000000000' }))).toBe(false);
  });
});

describe('lastActiveMs', () => {
  it('prefers lastRefreshTime, then lastSignInTime, then creationTime', () => {
    const refresh = new Date(NOW - 1 * DAY).toISOString();
    const signIn = new Date(NOW - 5 * DAY).toISOString();
    const created = new Date(NOW - 400 * DAY).toISOString();
    expect(lastActiveMs({ metadata: { lastRefreshTime: refresh, lastSignInTime: signIn } })).toBe(
      Date.parse(refresh),
    );
    expect(lastActiveMs({ metadata: { lastSignInTime: signIn, creationTime: created } })).toBe(
      Date.parse(signIn),
    );
    expect(lastActiveMs({ metadata: { creationTime: created } })).toBe(Date.parse(created));
  });

  it('returns 0 when there is no usable timestamp', () => {
    expect(lastActiveMs({})).toBe(0);
    expect(lastActiveMs({ metadata: { lastRefreshTime: 'not-a-date' } })).toBe(0);
  });
});

describe('isEligibleForCleanup', () => {
  it('deletes an anonymous account idle past the threshold', () => {
    const idle = user({ metadata: { lastRefreshTime: new Date(NOW - 181 * DAY).toISOString() } });
    expect(isEligibleForCleanup(idle, NOW, MAX_IDLE_MS)).toBe(true);
  });

  it('keeps an anonymous account that was active within the threshold', () => {
    const recent = user({ metadata: { lastRefreshTime: new Date(NOW - 179 * DAY).toISOString() } });
    expect(isEligibleForCleanup(recent, NOW, MAX_IDLE_MS)).toBe(false);
  });

  it('never deletes a linked account, however old', () => {
    const linked = user({
      providerData: [{ providerId: 'password' }],
      metadata: { lastRefreshTime: new Date(NOW - 1000 * DAY).toISOString() },
    });
    expect(isEligibleForCleanup(linked, NOW, MAX_IDLE_MS)).toBe(false);
  });

  it('never deletes a disabled account', () => {
    const disabled = user({
      disabled: true,
      metadata: { lastRefreshTime: new Date(NOW - 1000 * DAY).toISOString() },
    });
    expect(isEligibleForCleanup(disabled, NOW, MAX_IDLE_MS)).toBe(false);
  });

  it('does not delete when no timestamp is available (cannot prove idleness)', () => {
    expect(isEligibleForCleanup(user({ metadata: {} }), NOW, MAX_IDLE_MS)).toBe(false);
  });

  it('falls back to creationTime when that is all there is', () => {
    const old = user({ metadata: { creationTime: new Date(NOW - 200 * DAY).toISOString() } });
    expect(isEligibleForCleanup(old, NOW, MAX_IDLE_MS)).toBe(true);
  });
});
