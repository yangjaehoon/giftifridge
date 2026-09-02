type Unsubscribe = () => void;

export interface JoinedSources<T> {
  /**
   * Subscribe to the *set of keys* to join. Calls `onKeys` with the full key
   * list on every change; returns its own unsubscribe.
   */
  subscribeKeys: (onKeys: (keys: string[]) => void, onError: (error: Error) => void) => Unsubscribe;
  /**
   * Subscribe to one item by key. `onItem(null)` means the item is gone (and it
   * is dropped from the output). Returns its own unsubscribe.
   */
  subscribeItem: (
    key: string,
    onItem: (item: T | null) => void,
    onError: (error: Error) => void,
  ) => Unsubscribe;
  /** Optional ordering for the emitted list. */
  compare?: (a: T, b: T) => number;
}

/**
 * Live "join": a key-set subscription decides *which* items to watch, and each
 * key gets its own item subscription. The combined list is emitted once no
 * newly-added key is still waiting for its first item, so the consumer sees a
 * complete list instead of it filling in one entry at a time.
 *
 * - a key that leaves the set has its item subscription torn down
 * - one item subscription erroring drops only that item, not the whole list
 * - after the returned unsubscribe runs, no straggler snapshot can emit again
 */
export function subscribeJoined<T>(
  sources: JoinedSources<T>,
  onChange: (items: T[]) => void,
  onError?: (error: Error) => void,
): Unsubscribe {
  const { subscribeKeys, subscribeItem, compare } = sources;

  const itemsByKey = new Map<string, T>();
  const itemSubs = new Map<string, Unsubscribe>();
  // Keys whose first item snapshot hasn't arrived yet — hold the emit until
  // they all have, so a fresh join doesn't flash a partial list.
  const pending = new Set<string>();
  let stopped = false;

  const emit = () => {
    if (stopped || pending.size > 0) return;
    const list = [...itemsByKey.values()];
    onChange(compare ? list.sort(compare) : list);
  };

  const dropKey = (key: string) => {
    itemSubs.get(key)?.();
    itemSubs.delete(key);
    itemsByKey.delete(key);
    pending.delete(key);
  };

  const keysUnsub = subscribeKeys(
    (keys) => {
      const current = new Set(keys);

      for (const key of current) {
        if (itemSubs.has(key)) continue;
        pending.add(key);
        itemSubs.set(
          key,
          subscribeItem(
            key,
            (item) => {
              pending.delete(key);
              if (item !== null) itemsByKey.set(key, item);
              else itemsByKey.delete(key);
              emit();
            },
            () => {
              dropKey(key);
              emit();
            },
          ),
        );
      }

      for (const key of [...itemSubs.keys()]) {
        if (!current.has(key)) dropKey(key);
      }

      emit();
    },
    onError ?? (() => {}),
  );

  return () => {
    stopped = true;
    keysUnsub();
    for (const unsub of itemSubs.values()) unsub();
    itemSubs.clear();
    itemsByKey.clear();
    pending.clear();
  };
}
