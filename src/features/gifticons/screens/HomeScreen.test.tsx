import React from 'react';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import HomeScreen from './HomeScreen';
import { useAuth } from '../../auth/context/AuthContext';
import { useGifticons } from '../hooks/useGifticons';
import { useSpaceGifticons } from '../hooks/useSpaceGifticons';
import { useNearbyGifticons } from '../hooks/useNearbyGifticons';
import { useMySpaces } from '../../spaces/hooks/useMySpaces';
import type { Gifticon } from '../types';

jest.mock('../../auth/context/AuthContext', () => ({ useAuth: jest.fn() }));
jest.mock('../hooks/useGifticons', () => ({ useGifticons: jest.fn() }));
jest.mock('../hooks/useSpaceGifticons', () => ({ useSpaceGifticons: jest.fn() }));
jest.mock('../hooks/useNearbyGifticons', () => ({ useNearbyGifticons: jest.fn() }));
jest.mock('../../spaces/hooks/useMySpaces', () => ({ useMySpaces: jest.fn() }));

const mockedUseAuth = useAuth as jest.Mock;
const mockedUseGifticons = useGifticons as jest.Mock;
const mockedUseSpaceGifticons = useSpaceGifticons as jest.Mock;
const mockedUseNearby = useNearbyGifticons as jest.Mock;
const mockedUseMySpaces = useMySpaces as jest.Mock;

function daysFromNow(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString();
}

function makeGifticon(overrides: Partial<Gifticon> & { id: string }): Gifticon {
  return {
    ownerId: 'u1',
    name: '아메리카노',
    brand: '스타벅스',
    category: 'cafe',
    imageUrl: 'https://example.com/x.jpg',
    expiresAt: daysFromNow(10),
    isUsed: false,
    createdAt: daysFromNow(-5),
    ...overrides,
  };
}

const items: Gifticon[] = [
  makeGifticon({
    id: 'active-1',
    name: '아메리카노',
    brand: '스타벅스',
    expiresAt: daysFromNow(10),
  }),
  makeGifticon({ id: 'expired-1', name: '녹차', brand: '오설록', expiresAt: daysFromNow(-3) }),
  makeGifticon({ id: 'used-1', name: '라떼', brand: '이디야', isUsed: true }),
  makeGifticon({
    id: 'active-2',
    name: '기프트카드',
    brand: 'GS25',
    category: 'convenience',
    expiresAt: daysFromNow(2),
  }),
];

function setList(overrides: Partial<ReturnType<typeof useGifticons>> = {}) {
  mockedUseGifticons.mockReturnValue({
    items,
    loading: false,
    refreshing: false,
    error: null,
    refresh: jest.fn(),
    ...overrides,
  });
}

function makeNavigation() {
  return { navigate: jest.fn(), setOptions: jest.fn() };
}

async function renderScreen(navigation = makeNavigation()) {
  const utils = await render(<HomeScreen navigation={navigation as never} route={{} as never} />);
  return { ...utils, navigation };
}

beforeEach(() => {
  jest.clearAllMocks();
  mockedUseAuth.mockReturnValue({ user: { uid: 'u1' } });
  mockedUseMySpaces.mockReturnValue({ spaces: [], loading: false });
  mockedUseSpaceGifticons.mockReturnValue({
    items: [],
    loading: false,
    refreshing: false,
    error: null,
    refresh: jest.fn(),
  });
  mockedUseNearby.mockReturnValue([]);
  setList();
});

describe('HomeScreen', () => {
  it('shows tab counts derived from the item list', async () => {
    const { getByText } = await renderScreen();
    expect(getByText('사용가능 (2)')).toBeTruthy();
    expect(getByText('기한만료 (1)')).toBeTruthy();
    expect(getByText('사용완료 (1)')).toBeTruthy();
  });

  it('lists only active items by default and switches to the expired tab', async () => {
    const { getByText, queryByText } = await renderScreen();

    expect(getByText('아메리카노')).toBeTruthy();
    expect(queryByText('녹차')).toBeNull();

    await act(async () => {
      fireEvent.press(getByText('기한만료 (1)'));
    });

    expect(getByText('녹차')).toBeTruthy();
    expect(queryByText('아메리카노')).toBeNull();
  });

  it('filters by search query across name and brand', async () => {
    const { getByPlaceholderText, getByText, queryByText } = await renderScreen();

    await act(async () => {
      fireEvent.changeText(getByPlaceholderText('상품명, 브랜드 검색'), 'GS25');
    });

    expect(getByText('기프트카드')).toBeTruthy();
    expect(queryByText('아메리카노')).toBeNull();
  });

  it('filters by category chip', async () => {
    const { getByText, queryByText } = await renderScreen();

    await act(async () => {
      fireEvent.press(getByText('편의점'));
    });

    expect(getByText('기프트카드')).toBeTruthy();
    expect(queryByText('아메리카노')).toBeNull();
  });

  it('shows an empty message when the search matches nothing', async () => {
    const { getByPlaceholderText, getByText } = await renderScreen();

    await act(async () => {
      fireEvent.changeText(getByPlaceholderText('상품명, 브랜드 검색'), 'zzz없음');
    });

    expect(getByText('검색 결과가 없어요')).toBeTruthy();
  });

  it('navigates to the detail screen when a card is tapped', async () => {
    const { getByText, navigation } = await renderScreen();

    await act(async () => {
      fireEvent.press(getByText('아메리카노'));
    });

    expect(navigation.navigate).toHaveBeenCalledWith('GifticonDetail', { gifticonId: 'active-1' });
  });

  it('opens the add screen from the FAB (no space param in personal context)', async () => {
    const { getByLabelText, navigation } = await renderScreen();

    await act(async () => {
      fireEvent.press(getByLabelText('기프티콘 등록'));
    });

    expect(navigation.navigate).toHaveBeenCalledWith('AddGifticon', undefined);
  });

  it('renders skeletons while loading', async () => {
    setList({ loading: true, items: [] });
    const { queryByText } = await renderScreen();
    expect(queryByText('아메리카노')).toBeNull();
  });

  it('shows the full error screen when loading failed with no cached items', async () => {
    setList({ error: new Error('boom'), items: [] });
    const { getByText } = await renderScreen();
    expect(getByText('기프티콘을 불러오지 못했어요. 잠시 후 다시 시도해주세요.')).toBeTruthy();
  });

  it('shows an inline error banner when a refresh fails but items are cached', async () => {
    setList({ error: new Error('stale') });
    const { getByText } = await renderScreen();
    expect(
      getByText('최신 정보를 불러오지 못했어요. 화면을 당겨서 다시 시도해주세요.'),
    ).toBeTruthy();
  });

  it('reverses the sort direction toggle', async () => {
    const { getByText, getByLabelText } = await renderScreen();

    expect(getByText('↑ 오름차순')).toBeTruthy();
    await act(async () => {
      fireEvent.press(getByLabelText('정렬 방향 오름차순, 눌러서 전환'));
    });
    expect(getByText('↓ 내림차순')).toBeTruthy();
  });

  it('falls back to personal context when the selected space vanished', async () => {
    mockedUseMySpaces.mockReturnValue({ spaces: [], loading: false });
    const { getByText } = await renderScreen();

    // Select a space that isn't in `spaces`, then the derived context reverts.
    await act(async () => {
      fireEvent.press(getByText('내 기프티콘'));
    });
    // personal hook stays the active data source
    expect(mockedUseGifticons).toHaveBeenCalledWith('u1');
  });

  it('registers a header settings link', async () => {
    const { navigation } = await renderScreen();

    await waitFor(() => expect(navigation.setOptions).toHaveBeenCalled());
    const { headerRight } = navigation.setOptions.mock.calls.at(-1)[0];
    const { getByText } = await render(headerRight());
    fireEvent.press(getByText('설정'));
    expect(navigation.navigate).toHaveBeenCalledWith('Settings');
  });
});
