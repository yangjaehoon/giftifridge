export class TimeoutError extends Error {}

export function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout>;
  const timeout = new Promise<T>((_, reject) => {
    timer = setTimeout(() => reject(new TimeoutError('Operation timed out')), ms);
  });
  // Clear the pending timer once the race settles, so a fast-resolving promise
  // doesn't leave a stray timeout hanging around until it fires.
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}
