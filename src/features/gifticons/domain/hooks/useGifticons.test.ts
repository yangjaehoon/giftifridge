import { renderHook } from '@testing-library/react-native';
import { useGifticons } from './useGifticons';
import { useSpaceGifticons } from './useSpaceGifticons';
import { useFirestoreList } from '../../../../shared/hooks/useFirestoreList';
import { subscribeToGifticons, subscribeToSpaceGifticons } from '../services/gifticonService';

jest.mock('../../../../shared/hooks/useFirestoreList', () => ({
  useFirestoreList: jest.fn(() => ({ items: [], loading: false })),
}));
jest.mock('../services/gifticonService', () => ({
  subscribeToGifticons: jest.fn(),
  subscribeToSpaceGifticons: jest.fn(),
}));
jest.mock('../services/gifticonCache', () => ({
  gifticonListCache: jest.fn((scope: string) => ({ scope, read: jest.fn(), write: jest.fn() })),
}));

const mockedUseFirestoreList = useFirestoreList as jest.Mock;
const anyCache = { read: expect.any(Function), write: expect.any(Function) };

beforeEach(() => {
  jest.clearAllMocks();
});

it('useGifticons wires the ownerId key to the personal-gifticons subscription', async () => {
  await renderHook(() => useGifticons('owner-1'));
  expect(mockedUseFirestoreList).toHaveBeenCalledWith(
    'owner-1',
    subscribeToGifticons,
    expect.objectContaining({ ...anyCache, scope: 'owner' }),
  );
});

it('useSpaceGifticons wires the spaceId key to the space-gifticons subscription', async () => {
  await renderHook(() => useSpaceGifticons('space-1'));
  expect(mockedUseFirestoreList).toHaveBeenCalledWith(
    'space-1',
    subscribeToSpaceGifticons,
    expect.objectContaining({ ...anyCache, scope: 'space' }),
  );
});

it('passes an undefined key straight through', async () => {
  await renderHook(() => useGifticons(undefined));
  expect(mockedUseFirestoreList).toHaveBeenCalledWith(
    undefined,
    subscribeToGifticons,
    expect.objectContaining(anyCache),
  );
});
