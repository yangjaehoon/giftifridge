import { navigationRef } from './navigationRef';

describe('navigationRef', () => {
  it('exposes a navigation container ref that is not ready before mount', () => {
    expect(navigationRef).toBeDefined();
    expect(typeof navigationRef.isReady).toBe('function');
    expect(navigationRef.isReady()).toBe(false);
  });
});
