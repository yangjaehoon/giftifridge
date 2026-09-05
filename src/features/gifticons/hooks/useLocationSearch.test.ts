import { act, renderHook } from '@testing-library/react-native';
import { Alert } from 'react-native';
import { searchAddress } from '../../../shared/utils/location';
import type { AddressCandidate } from '../../../shared/utils/location';
import { useLocationSearch } from './useLocationSearch';

jest.mock('../../../shared/utils/location', () => ({ searchAddress: jest.fn() }));

const mockedSearchAddress = searchAddress as jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
  jest.spyOn(Alert, 'alert').mockImplementation(() => {});
});

describe('useLocationSearch', () => {
  it('resets the query and results each time it opens', async () => {
    const { result } = await renderHook(() => useLocationSearch(jest.fn()));

    await act(() => result.current.setQuery('leftover'));
    await act(() => result.current.open());

    expect(result.current.visible).toBe(true);
    expect(result.current.query).toBe('');
    expect(result.current.results).toEqual([]);
  });

  it('closes without selecting', async () => {
    const { result } = await renderHook(() => useLocationSearch(jest.fn()));

    await act(() => result.current.open());
    await act(() => result.current.close());

    expect(result.current.visible).toBe(false);
  });

  it('populates results on a successful search', async () => {
    const candidates = [{ coordinates: { latitude: 37.5, longitude: 127 }, label: '서울 강남구' }];
    mockedSearchAddress.mockResolvedValue(candidates);
    const { result } = await renderHook(() => useLocationSearch(jest.fn()));

    await act(() => result.current.setQuery('강남'));
    await act(async () => result.current.search());

    expect(mockedSearchAddress).toHaveBeenCalledWith('강남');
    expect(result.current.results).toEqual(candidates);
  });

  it('does not search a blank query', async () => {
    const { result } = await renderHook(() => useLocationSearch(jest.fn()));

    await act(async () => result.current.search());

    expect(mockedSearchAddress).not.toHaveBeenCalled();
  });

  it('alerts when permission is missing (null result)', async () => {
    mockedSearchAddress.mockResolvedValue(null);
    const { result } = await renderHook(() => useLocationSearch(jest.fn()));

    await act(() => result.current.setQuery('강남'));
    await act(async () => result.current.search());

    expect(Alert.alert).toHaveBeenCalledWith(
      '알림',
      '위치 접근 권한이 필요해요.',
      expect.any(Array),
    );
  });

  it('alerts when no address matches', async () => {
    mockedSearchAddress.mockResolvedValue([]);
    const { result } = await renderHook(() => useLocationSearch(jest.fn()));

    await act(() => result.current.setQuery('없는주소'));
    await act(async () => result.current.search());

    expect(Alert.alert).toHaveBeenCalledWith('알림', '검색 결과가 없어요.');
  });

  it('discards a stale search result when a newer search starts before it resolves', async () => {
    const resolvers: ((v: AddressCandidate[]) => void)[] = [];
    mockedSearchAddress.mockImplementation(
      () => new Promise<AddressCandidate[]>((resolve) => resolvers.push(resolve)),
    );
    const { result } = await renderHook(() => useLocationSearch(jest.fn()));

    await act(() => result.current.setQuery('A'));
    await act(async () => {
      result.current.search(); // stays pending
    });
    await act(() => result.current.setQuery('B'));
    await act(async () => {
      result.current.search(); // starts before A's resolves
    });

    const candidatesB = [{ coordinates: { latitude: 1, longitude: 2 }, label: 'B' }];
    const candidatesA = [{ coordinates: { latitude: 3, longitude: 4 }, label: 'A' }];

    // B's search resolves first, then A's resolves late.
    await act(async () => resolvers[1](candidatesB));
    await act(async () => resolvers[0](candidatesA));

    expect(result.current.results).toEqual(candidatesB);
  });

  it('alerts on a search failure', async () => {
    mockedSearchAddress.mockRejectedValue(new Error('network down'));
    const { result } = await renderHook(() => useLocationSearch(jest.fn()));

    await act(() => result.current.setQuery('강남'));
    await act(async () => result.current.search());

    expect(Alert.alert).toHaveBeenCalledWith('오류', '주소를 검색하지 못했어요.');
  });

  it('selects a candidate, notifying the caller and closing the modal', async () => {
    const onSelect = jest.fn();
    const { result } = await renderHook(() => useLocationSearch(onSelect));
    const coordinates = { latitude: 37.5, longitude: 127 };

    await act(() => result.current.open());
    await act(() => result.current.select(coordinates));

    expect(onSelect).toHaveBeenCalledWith(coordinates);
    expect(result.current.visible).toBe(false);
  });
});
