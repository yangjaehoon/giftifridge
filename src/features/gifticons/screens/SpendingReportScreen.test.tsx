import React from 'react';
import { render } from '@testing-library/react-native';
import SpendingReportScreen from './SpendingReportScreen';
import { useCurrentUser } from '../../auth/context/AuthContext';
import { useGifticons } from '../hooks/useGifticons';
import type { Gifticon } from '../types';

jest.mock('../../auth/context/AuthContext', () => ({ useCurrentUser: jest.fn() }));
jest.mock('../hooks/useGifticons', () => ({ useGifticons: jest.fn() }));

const mockedUseCurrentUser = useCurrentUser as jest.Mock;
const mockedUseGifticons = useGifticons as jest.Mock;

function daysFromNow(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function g(overrides: Partial<Gifticon> & { id: string }): Gifticon {
  return {
    ownerId: 'u1',
    name: '아메리카노',
    brand: '스타벅스',
    category: 'cafe',
    imageUrl: 'https://x/y.jpg',
    expiresAt: daysFromNow(30),
    isUsed: false,
    createdAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

// The screen ignores its navigation props; the same `as never` casts the other
// screen tests use are enough here.
const navProps = {
  navigation: {} as never,
  route: { key: 'r', name: 'Report', params: undefined } as never,
};

beforeEach(() => {
  jest.clearAllMocks();
  mockedUseCurrentUser.mockReturnValue({ user: { uid: 'u1' } });
});

describe('SpendingReportScreen', () => {
  it('shows skeletons while the list is loading', async () => {
    mockedUseGifticons.mockReturnValue({ items: [], loading: true });
    const { queryByText } = await render(
      <SpendingReportScreen navigation={navProps.navigation} route={navProps.route} />,
    );
    expect(queryByText('만료로 놓친 금액')).toBeNull();
  });

  it('encourages the user when nothing has expired unused', async () => {
    mockedUseGifticons.mockReturnValue({
      items: [g({ id: 'a', amount: 5000, expiresAt: daysFromNow(10) })],
      loading: false,
    });
    const { getByText } = await render(
      <SpendingReportScreen navigation={navProps.navigation} route={navProps.route} />,
    );

    expect(getByText('만료된 기프티콘이 없어요. 잘하고 있어요!')).toBeTruthy();
  });

  it('surfaces the money lost to expiry and a category breakdown', async () => {
    mockedUseGifticons.mockReturnValue({
      items: [
        g({ id: 'lost', amount: 4000, expiresAt: daysFromNow(-3) }),
        g({ id: 'used', category: 'restaurant', amount: 15000, isUsed: true }),
      ],
      loading: false,
    });
    const { getByText } = await render(
      <SpendingReportScreen navigation={navProps.navigation} route={navProps.route} />,
    );

    expect(getByText('4,000원')).toBeTruthy();
    expect(getByText('1개를 쓰지 못하고 만료시켰어요')).toBeTruthy();
    expect(getByText('카테고리별 사용')).toBeTruthy();
    expect(getByText('음식점')).toBeTruthy();
  });
});
