import { navigationRef } from './navigationRef';

// A notification tap or deep link can resolve before the NavigationContainer
// has mounted (auth still initializing → navigationRef.isReady() is false).
// This module owns the queue of those navigations so RootNavigator doesn't
// carry loose module-level state.
const pending: (() => void)[] = [];

export function navigateWhenReady(run: () => void): void {
  if (navigationRef.isReady()) {
    run();
  } else {
    pending.push(run);
  }
}

export function flushDeferredNavigations(): void {
  while (pending.length > 0) {
    pending.shift()?.();
  }
}
