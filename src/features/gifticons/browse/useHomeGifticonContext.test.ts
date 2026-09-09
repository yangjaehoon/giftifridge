import { act, renderHook } from '@testing-library/react-native';
import { useHomeGifticonContext } from './useHomeGifticonContext';
import { useGifticons } from '../domain/hooks/useGifticons';
import { useSpaceGifticons } from '../domain/hooks/useSpaceGifticons';

jest.mock('../domain/hooks/useGifticons', () => ({ useGifticons: jest.fn() }));
jest.mock('../domain/hooks/useSpaceGifticons', () => ({ useSpaceGifticons: jest.fn() }));

const mockedPersonal = useGifticons as jest.Mock;
const mockedSpace = useSpaceGifticons as jest.Mock;

const personalList = {
  items: [{ id: 'p1' }],
  loading: false,
  refreshing: false,
  error: null,
  refresh: jest.fn(),
};
const spaceList = {
  items: [{ id: 's1' }],
  loading: false,
  refreshing: false,
  error: null,
  refresh: jest.fn(),
};

beforeEach(() => {
  jest.clearAllMocks();
  mockedPersonal.mockReturnValue(personalList);
  mockedSpace.mockReturnValue(spaceList);
});

describe('useHomeGifticonContext', () => {
  it('defaults to the personal list and does not subscribe to a space', async () => {
    const { result } = await renderHook(() => useHomeGifticonContext('u1', [], false));

    expect(result.current.context).toEqual({ type: 'personal' });
    expect(mockedPersonal).toHaveBeenLastCalledWith('u1');
    expect(mockedSpace).toHaveBeenLastCalledWith(undefined);
    expect(result.current.list).toBe(personalList);
  });

  it('switches to a space that exists and sources its list', async () => {
    const { result } = await renderHook(() => useHomeGifticonContext('u1', ['space-1'], false));

    await act(async () => {
      result.current.setContext({ type: 'space', spaceId: 'space-1' });
    });

    expect(result.current.context).toEqual({ type: 'space', spaceId: 'space-1' });
    expect(mockedSpace).toHaveBeenLastCalledWith('space-1');
    expect(mockedPersonal).toHaveBeenLastCalledWith(undefined);
    expect(result.current.list).toBe(spaceList);
  });

  it('falls back to personal when the selected space is gone from the list', async () => {
    const { result } = await renderHook(() => useHomeGifticonContext('u1', [], false));

    await act(async () => {
      result.current.setContext({ type: 'space', spaceId: 'space-gone' });
    });

    expect(result.current.context).toEqual({ type: 'personal' });
    expect(mockedPersonal).toHaveBeenLastCalledWith('u1');
  });

  it('does not fall back while the space list is still loading', async () => {
    const { result } = await renderHook(() => useHomeGifticonContext('u1', [], true));

    await act(async () => {
      result.current.setContext({ type: 'space', spaceId: 'space-1' });
    });

    expect(result.current.context).toEqual({ type: 'space', spaceId: 'space-1' });
    expect(mockedSpace).toHaveBeenLastCalledWith('space-1');
  });
});
