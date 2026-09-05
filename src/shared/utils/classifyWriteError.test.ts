import { classifyWriteError } from './classifyWriteError';
import { TimeoutError } from './withTimeout';

describe('classifyWriteError', () => {
  it('classifies a TimeoutError as "timeout"', () => {
    expect(classifyWriteError(new TimeoutError('slow'))).toBe('timeout');
  });

  it('classifies a Firestore permission-denied error as "permission"', () => {
    expect(classifyWriteError({ code: 'permission-denied' })).toBe('permission');
  });

  it('classifies a Firebase Storage error as "upload"', () => {
    expect(classifyWriteError({ code: 'storage/unauthorized' })).toBe('upload');
    expect(classifyWriteError({ code: 'storage/retry-limit-exceeded' })).toBe('upload');
  });

  it('classifies anything else as "other"', () => {
    expect(classifyWriteError(new Error('boom'))).toBe('other');
    expect(classifyWriteError({ code: 'unavailable' })).toBe('other');
    expect(classifyWriteError(undefined)).toBe('other');
  });
});
