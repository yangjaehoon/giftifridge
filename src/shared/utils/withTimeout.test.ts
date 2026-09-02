import { TimeoutError, withTimeout } from './withTimeout';

describe('withTimeout', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('resolves with the promise value when it settles before the timeout', async () => {
    await expect(withTimeout(Promise.resolve('ok'), 1000)).resolves.toBe('ok');
  });

  it('rejects with the underlying error when the promise rejects first', async () => {
    await expect(withTimeout(Promise.reject(new Error('boom')), 1000)).rejects.toThrow('boom');
  });

  it('rejects with a TimeoutError once ms elapses without the promise settling', async () => {
    const pending = new Promise(() => {});
    const raced = withTimeout(pending, 1000);
    const assertion = expect(raced).rejects.toBeInstanceOf(TimeoutError);

    jest.advanceTimersByTime(1000);

    await assertion;
  });
});
