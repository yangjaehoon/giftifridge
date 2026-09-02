import { navigationRef } from './navigationRef';
import { navigateWhenReady, flushDeferredNavigations } from './deferredNavigation';

jest.mock('./navigationRef', () => ({
  navigationRef: { isReady: jest.fn() },
}));

const mockedIsReady = navigationRef.isReady as jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
  // Drain anything a prior test left queued.
  mockedIsReady.mockReturnValue(true);
  flushDeferredNavigations();
});

describe('deferredNavigation', () => {
  it('runs the callback immediately when navigation is ready', () => {
    mockedIsReady.mockReturnValue(true);
    const run = jest.fn();

    navigateWhenReady(run);

    expect(run).toHaveBeenCalledTimes(1);
  });

  it('queues the callback until the next flush when navigation is not ready', () => {
    mockedIsReady.mockReturnValue(false);
    const a = jest.fn();
    const b = jest.fn();

    navigateWhenReady(a);
    navigateWhenReady(b);
    expect(a).not.toHaveBeenCalled();
    expect(b).not.toHaveBeenCalled();

    flushDeferredNavigations();

    expect(a).toHaveBeenCalledTimes(1);
    expect(b).toHaveBeenCalledTimes(1);
  });

  it('flushes in FIFO order and leaves the queue empty', () => {
    mockedIsReady.mockReturnValue(false);
    const order: string[] = [];
    navigateWhenReady(() => order.push('first'));
    navigateWhenReady(() => order.push('second'));

    flushDeferredNavigations();
    flushDeferredNavigations();

    expect(order).toEqual(['first', 'second']);
  });
});
