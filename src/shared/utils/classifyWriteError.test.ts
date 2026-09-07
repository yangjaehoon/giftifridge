import { classifyWriteError, makeErrorMessages, WRITE_ERROR_MESSAGES } from './classifyWriteError';
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

describe('makeErrorMessages', () => {
  const { get, getWrite } = makeErrorMessages({
    ...WRITE_ERROR_MESSAGES,
    permission: '권한이 없어요.',
    save: '저장 실패.',
  });

  it('get() returns the message for a key', () => {
    expect(get('save')).toBe('저장 실패.');
    expect(get('timeout')).toBe(WRITE_ERROR_MESSAGES.timeout);
  });

  it('getWrite() maps a classified write error to its message', () => {
    expect(getWrite(new TimeoutError('slow'), 'save')).toBe(WRITE_ERROR_MESSAGES.timeout);
    expect(getWrite({ code: 'permission-denied' }, 'save')).toBe('권한이 없어요.');
    expect(getWrite({ code: 'storage/unauthorized' }, 'save')).toBe(WRITE_ERROR_MESSAGES.upload);
  });

  it('getWrite() falls back to the given key for an unclassifiable error', () => {
    expect(getWrite(new Error('boom'), 'save')).toBe('저장 실패.');
  });
});
