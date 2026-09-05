import { isPermissionDenied, isStorageError } from './firebaseError';

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

describe('isStorageError', () => {
  it('returns true for any storage/* error code', () => {
    expect(isStorageError({ code: 'storage/unauthorized' })).toBe(true);
    expect(isStorageError({ code: 'storage/retry-limit-exceeded' })).toBe(true);
    expect(isStorageError({ code: 'storage/unknown' })).toBe(true);
  });

  it('returns false for a Firestore error code or a non-string code', () => {
    expect(isStorageError({ code: 'permission-denied' })).toBe(false);
    expect(isStorageError({ code: 'unavailable' })).toBe(false);
    expect(isStorageError({ code: 500 })).toBe(false);
  });

  it('returns false for non-error values', () => {
    expect(isStorageError(new Error('plain error'))).toBe(false);
    expect(isStorageError(null)).toBe(false);
    expect(isStorageError(undefined)).toBe(false);
    expect(isStorageError('storage/unauthorized')).toBe(false);
  });
});
