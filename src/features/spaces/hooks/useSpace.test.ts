import { act, renderHook } from '@testing-library/react-native';
import { useSpace } from './useSpace';
import { subscribeToSpace, subscribeToSpaceMembers } from '../services/spaceService';
import type { Space, SpaceMember } from '../types';

jest.mock('../services/spaceService', () => ({
  subscribeToSpace: jest.fn(),
  subscribeToSpaceMembers: jest.fn(),
}));

const mockedSubscribeToSpace = subscribeToSpace as jest.Mock;
const mockedSubscribeToSpaceMembers = subscribeToSpaceMembers as jest.Mock;

let spaceCallbacks: { onChange: (s: Space | null) => void; onError: (e: Error) => void };
let membersCallbacks: { onChange: (m: SpaceMember[]) => void; onError: (e: Error) => void };

function wireMocks() {
  const unsubSpace = jest.fn();
  const unsubMembers = jest.fn();
  mockedSubscribeToSpace.mockImplementation((_id, onChange, onError) => {
    spaceCallbacks = { onChange, onError };
    return unsubSpace;
  });
  mockedSubscribeToSpaceMembers.mockImplementation((_id, onChange, onError) => {
    membersCallbacks = { onChange, onError };
    return unsubMembers;
  });
  return { unsubSpace, unsubMembers };
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe('useSpace', () => {
  it('does not subscribe and returns empty state when spaceId is undefined', async () => {
    const { result } = await renderHook(() => useSpace(undefined));

    expect(mockedSubscribeToSpace).not.toHaveBeenCalled();
    expect(result.current.loading).toBe(false);
    expect(result.current.space).toBeNull();
    expect(result.current.members).toEqual([]);
  });

  it('exposes the space and members once their snapshots arrive', async () => {
    wireMocks();
    const { result } = await renderHook(() => useSpace('space-1'));
    expect(result.current.loading).toBe(true);

    await act(async () => {
      spaceCallbacks.onChange({ id: 'space-1', name: '집' } as Space);
      membersCallbacks.onChange([{ uid: 'a', role: 'owner' } as SpaceMember]);
    });

    expect(result.current.space).toEqual({ id: 'space-1', name: '집' });
    expect(result.current.members).toEqual([{ uid: 'a', role: 'owner' }]);
    expect(result.current.loading).toBe(false);
  });

  it('surfaces a space listener error', async () => {
    wireMocks();
    const { result } = await renderHook(() => useSpace('space-1'));

    await act(async () => {
      spaceCallbacks.onError(new Error('no access'));
    });

    expect(result.current.error?.message).toBe('no access');
    expect(result.current.loading).toBe(false);
  });

  it('tears down both subscriptions on unmount', async () => {
    const { unsubSpace, unsubMembers } = wireMocks();
    const { unmount } = await renderHook(() => useSpace('space-1'));

    await unmount();

    expect(unsubSpace).toHaveBeenCalledTimes(1);
    expect(unsubMembers).toHaveBeenCalledTimes(1);
  });

  it('refresh() re-subscribes', async () => {
    wireMocks();
    const { result } = await renderHook(() => useSpace('space-1'));

    await act(async () => {
      result.current.refresh();
    });

    expect(mockedSubscribeToSpace).toHaveBeenCalledTimes(2);
  });
});
