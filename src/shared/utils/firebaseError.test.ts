import { isPermissionDenied } from './firebaseError';

describe('isPermissionDenied', () => {
  it('returns true for a Firestore permission-denied error', () => {
    expect(isPermissionDenied({ code: 'permission-denied' })).toBe(true);
  });

  it('returns false for other error codes', () => {
    expect(isPermissionDenied({ code: 'unavailable' })).toBe(false);
  });

  it('returns false for non-error values', () => {
    expect(isPermissionDenied(new Error('plain error'))).toBe(false);
    expect(isPermissionDenied(null)).toBe(false);
    expect(isPermissionDenied(undefined)).toBe(false);
    expect(isPermissionDenied('permission-denied')).toBe(false);
  });
});
