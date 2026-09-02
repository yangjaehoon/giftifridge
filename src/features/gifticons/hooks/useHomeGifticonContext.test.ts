import { act, renderHook } from '@testing-library/react-native';
import { useHomeGifticonContext } from './useHomeGifticonContext';
import { useGifticons } from './useGifticons';
import { useSpaceGifticons } from './useSpaceGifticons';
import { useMySpaces } from '../../spaces/hooks/useMySpaces';

jest.mock('./useGifticons', () => ({ useGifticons: jest.fn() }));
jest.mock('./useSpaceGifticons', () => ({ useSpaceGifticons: jest.fn() }));
jest.mock('../../spaces/hooks/useMySpaces', () => ({ useMySpaces: jest.fn() }));

const mockedPersonal = useGifticons as jest.Mock;
const mockedSpace = useSpaceGifticons as jest.Mock;
const mockedMySpaces = useMySpaces as jest.Mock;

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
  mockedMySpaces.mockReturnValue({ spaces: [], loading: false });
});

describe('useHomeGifticonContext', () => {
  it('defaults to the personal list and does not subscribe to a space', async () => {
    const { result } = await renderHook(() => useHomeGifticonContext('u1'));

    expect(result.current.context).toEqual({ type: 'personal' });
    expect(mockedPersonal).toHaveBeenLastCalledWith('u1');
    expect(mockedSpace).toHaveBeenLastCalledWith(undefined);
    expect(result.current.list).toBe(personalList);
  });

  it('switches to a space that exists and sources its list', async () => {
    mockedMySpaces.mockReturnValue({ spaces: [{ id: 'space-1', name: '집' }], loading: false });
    const { result } = await renderHook(() => useHomeGifticonContext('u1'));

    await act(async () => {
      result.current.setContext({ type: 'space', spaceId: 'space-1' });
    });

    expect(result.current.context).toEqual({ type: 'space', spaceId: 'space-1' });
    expect(mockedSpace).toHaveBeenLastCalledWith('space-1');
    expect(mockedPersonal).toHaveBeenLastCalledWith(undefined);
    expect(result.current.list).toBe(spaceList);
  });

  it('falls back to personal when the selected space is gone from the list', async () => {
    mockedMySpaces.mockReturnValue({ spaces: [], loading: false });
    const { result } = await renderHook(() => useHomeGifticonContext('u1'));

    await act(async () => {
      result.current.setContext({ type: 'space', spaceId: 'space-gone' });
    });

    expect(result.current.context).toEqual({ type: 'personal' });
    expect(mockedPersonal).toHaveBeenLastCalledWith('u1');
  });

  it('does not fall back while the space list is still loading', async () => {
    mockedMySpaces.mockReturnValue({ spaces: [], loading: true });
    const { result } = await renderHook(() => useHomeGifticonContext('u1'));

    await act(async () => {
      result.current.setContext({ type: 'space', spaceId: 'space-1' });
    });

    expect(result.current.context).toEqual({ type: 'space', spaceId: 'space-1' });
    expect(mockedSpace).toHaveBeenLastCalledWith('space-1');
  });
});
