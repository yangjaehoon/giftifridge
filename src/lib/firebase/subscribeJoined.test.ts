import { subscribeJoined, type JoinedSources } from './subscribeJoined';

type Item = { id: string; label: string };

/**
 * A hand-driven pair of fake subscriptions: `emitKeys` pushes a new key set,
 * `emitItem`/`errorItem` drive a single key's item subscription, and the
 * `*Unsub` mocks record teardown.
 */
function makeHarness(compare?: (a: Item, b: Item) => number) {
  let pushKeys: (keys: string[]) => void = () => {};
  let pushKeysError: (e: Error) => void = () => {};
  const keysUnsub = jest.fn();

  const itemChannels = new Map<
    string,
    { onItem: (i: Item | null) => void; onError: (e: Error) => void; unsub: jest.Mock }
  >();
  const subscribeItemCalls: string[] = [];

  const sources: JoinedSources<Item> = {
    subscribeKeys: (onKeys, onError) => {
      pushKeys = onKeys;
      pushKeysError = onError;
      return keysUnsub;
    },
    subscribeItem: (key, onItem, onError) => {
      subscribeItemCalls.push(key);
      const unsub = jest.fn();
      itemChannels.set(key, { onItem, onError, unsub });
      return unsub;
    },
    compare,
  };

  const onChange = jest.fn<void, [Item[]]>();
  const onError = jest.fn();

  return {
    sources,
    onChange,
    onError,
    keysUnsub,
    subscribeItemCalls,
    start: () => subscribeJoined(sources, onChange, onError),
    emitKeys: (keys: string[]) => pushKeys(keys),
    emitKeysError: (e: Error) => pushKeysError(e),
    channel: (key: string) => {
      const c = itemChannels.get(key);
      if (!c) throw new Error(`no item subscription for ${key}`);
      return c;
    },
  };
}

const byLabel = (a: Item, b: Item) => a.label.localeCompare(b.label);

describe('subscribeJoined', () => {
  it('holds the first emit until every newly-added key has reported', () => {
    const h = makeHarness(byLabel);
    h.start();

    h.emitKeys(['a', 'b']);
    expect(h.onChange).not.toHaveBeenCalled();

    h.channel('a').onItem({ id: 'a', label: 'Anna' });
    expect(h.onChange).not.toHaveBeenCalled();

    h.channel('b').onItem({ id: 'b', label: 'Bob' });
    expect(h.onChange).toHaveBeenCalledWith([
      { id: 'a', label: 'Anna' },
      { id: 'b', label: 'Bob' },
    ]);
  });

  it('re-emits on a later item change without touching the other subscriptions', () => {
    const h = makeHarness(byLabel);
    h.start();
    h.emitKeys(['a']);
    h.channel('a').onItem({ id: 'a', label: 'old' });
    h.onChange.mockClear();

    h.channel('a').onItem({ id: 'a', label: 'new' });

    expect(h.onChange).toHaveBeenCalledWith([{ id: 'a', label: 'new' }]);
  });

  it('drops an item whose subscription reports it gone (null)', () => {
    const h = makeHarness(byLabel);
    h.start();
    h.emitKeys(['a', 'b']);
    h.channel('a').onItem({ id: 'a', label: 'Anna' });
    h.channel('b').onItem({ id: 'b', label: 'Bob' });
    h.onChange.mockClear();

    h.channel('b').onItem(null);

    expect(h.onChange).toHaveBeenLastCalledWith([{ id: 'a', label: 'Anna' }]);
  });

  it('drops only the failing item when its subscription errors', () => {
    const h = makeHarness(byLabel);
    h.start();
    h.emitKeys(['a', 'b']);
    h.channel('a').onItem({ id: 'a', label: 'Anna' });
    h.channel('b').onItem({ id: 'b', label: 'Bob' });
    const bUnsub = h.channel('b').unsub;
    h.onChange.mockClear();

    h.channel('b').onError(new Error('permission-denied'));

    expect(bUnsub).toHaveBeenCalledTimes(1);
    expect(h.onChange).toHaveBeenLastCalledWith([{ id: 'a', label: 'Anna' }]);
  });

  it('tears down the subscription for a key that leaves the set', () => {
    const h = makeHarness(byLabel);
    h.start();
    h.emitKeys(['a', 'b']);
    h.channel('a').onItem({ id: 'a', label: 'Anna' });
    h.channel('b').onItem({ id: 'b', label: 'Bob' });
    const bUnsub = h.channel('b').unsub;
    h.onChange.mockClear();

    h.emitKeys(['a']);

    expect(bUnsub).toHaveBeenCalledTimes(1);
    expect(h.onChange).toHaveBeenLastCalledWith([{ id: 'a', label: 'Anna' }]);
  });

  it('does not re-subscribe a key that is still in the set', () => {
    const h = makeHarness();
    h.start();
    h.emitKeys(['a']);
    h.emitKeys(['a', 'b']);
    h.emitKeys(['a', 'b']);

    expect(h.subscribeItemCalls).toEqual(['a', 'b']);
  });

  it('forwards a key-set subscription error', () => {
    const h = makeHarness();
    h.start();

    h.emitKeysError(new Error('boom'));

    expect(h.onError).toHaveBeenCalledWith(new Error('boom'));
  });

  it('swallows a key-set error when no onError is supplied', () => {
    const h = makeHarness();
    const unsub = subscribeJoined(h.sources, jest.fn());

    expect(() => h.emitKeysError(new Error('boom'))).not.toThrow();
    expect(typeof unsub).toBe('function');
  });

  it('the returned unsubscribe stops every subscription and silences later emits', () => {
    const h = makeHarness(byLabel);
    const stop = h.start();
    h.emitKeys(['a']);
    h.channel('a').onItem({ id: 'a', label: 'Anna' });
    const aUnsub = h.channel('a').unsub;
    h.onChange.mockClear();

    stop();

    expect(h.keysUnsub).toHaveBeenCalledTimes(1);
    expect(aUnsub).toHaveBeenCalledTimes(1);

    h.channel('a').onItem({ id: 'a', label: 'straggler' });
    expect(h.onChange).not.toHaveBeenCalled();
  });

  it('emits an unsorted list when no comparator is given', () => {
    const h = makeHarness();
    h.start();
    h.emitKeys(['b', 'a']);
    h.channel('b').onItem({ id: 'b', label: 'Bob' });
    h.channel('a').onItem({ id: 'a', label: 'Anna' });

    expect(h.onChange).toHaveBeenLastCalledWith([
      { id: 'b', label: 'Bob' },
      { id: 'a', label: 'Anna' },
    ]);
  });
});
