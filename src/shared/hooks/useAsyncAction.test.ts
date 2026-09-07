import { act, renderHook } from '@testing-library/react-native';
import { Alert } from 'react-native';
import { useAsyncAction } from './useAsyncAction';

const getMessage = (err: unknown, fallback: string) =>
  err instanceof Error && err.message === 'slow' ? '느려요' : `fallback:${fallback}`;

beforeEach(() => {
  jest.spyOn(Alert, 'alert').mockImplementation(() => {});
});

describe('useAsyncAction', () => {
  it('holds busy for the duration of the op and clears it after', async () => {
    let release: () => void = () => {};
    const op = () => new Promise<void>((resolve) => (release = resolve));
    const { result } = await renderHook(() => useAsyncAction(getMessage));

    expect(result.current.busy).toBe(false);
    let done: Promise<boolean>;
    await act(async () => {
      done = result.current.run(op, { fallback: 'save' });
    });
    expect(result.current.busy).toBe(true);

    await act(async () => {
      release();
      await done;
    });
    expect(result.current.busy).toBe(false);
  });

  it('runs onSuccess with the result and returns true when the op resolves', async () => {
    const onSuccess = jest.fn();
    const { result } = await renderHook(() => useAsyncAction(getMessage));

    let ok = false;
    await act(async () => {
      ok = await result.current.run(() => Promise.resolve('id-1'), { fallback: 'save', onSuccess });
    });

    expect(ok).toBe(true);
    expect(onSuccess).toHaveBeenCalledWith('id-1');
    expect(Alert.alert).not.toHaveBeenCalled();
  });

  it('alerts with the resolved message, runs onError, and returns false when the op throws', async () => {
    const onError = jest.fn();
    const onSuccess = jest.fn();
    const { result } = await renderHook(() => useAsyncAction(getMessage));

    let ok = true;
    await act(async () => {
      ok = await result.current.run(() => Promise.reject(new Error('slow')), {
        fallback: 'save',
        onSuccess,
        onError,
      });
    });

    expect(ok).toBe(false);
    expect(onSuccess).not.toHaveBeenCalled();
    expect(onError).toHaveBeenCalledWith(expect.any(Error));
    expect(Alert.alert).toHaveBeenCalledWith('오류', '느려요');
  });

  it('falls back to the given key when the error is unclassifiable', async () => {
    const { result } = await renderHook(() => useAsyncAction(getMessage));

    await act(async () => {
      await result.current.run(() => Promise.reject(new Error('boom')), { fallback: 'delete' });
    });

    expect(Alert.alert).toHaveBeenCalledWith('오류', 'fallback:delete');
  });

  it('clears busy even when the op throws', async () => {
    const { result } = await renderHook(() => useAsyncAction(getMessage));

    await act(async () => {
      await result.current.run(() => Promise.reject(new Error('x')), { fallback: 'save' });
    });

    expect(result.current.busy).toBe(false);
  });
});
