import React from 'react';
import { act, fireEvent, render } from '@testing-library/react-native';
import ExpiryCalendarScreen from './ExpiryCalendarScreen';
import { useCurrentUser } from '../../../shared/auth/AuthContext';
import { useGifticons } from '../hooks/useGifticons';
import { todayDateString } from '../../../shared/utils/date';
import type { Gifticon } from '../types';

jest.mock('../../../shared/auth/AuthContext', () => ({ useCurrentUser: jest.fn() }));
jest.mock('../hooks/useGifticons', () => ({ useGifticons: jest.fn() }));

const mockedUseCurrentUser = useCurrentUser as jest.Mock;
const mockedUseGifticons = useGifticons as jest.Mock;

function g(overrides: Partial<Gifticon> & { id: string }): Gifticon {
  return {
    ownerId: 'u1',
    name: '아메리카노',
    brand: '스타벅스',
    category: 'cafe',
    imageUrl: 'https://x/y.jpg',
    expiresAt: todayDateString(),
    isUsed: false,
    createdAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

const navigation = { navigate: jest.fn() };
const navProps = {
  navigation: navigation as never,
  route: { key: 'c', name: 'Calendar', params: undefined } as never,
};

beforeEach(() => {
  jest.clearAllMocks();
  mockedUseCurrentUser.mockReturnValue({ user: { uid: 'u1' } });
});

describe('ExpiryCalendarScreen', () => {
  it('shows skeletons while loading', async () => {
    mockedUseGifticons.mockReturnValue({ items: [], loading: true });
    const { queryByText } = await render(
      <ExpiryCalendarScreen navigation={navProps.navigation} route={navProps.route} />,
    );
    expect(queryByText('일')).toBeNull();
  });

  it('lists what expires on the pre-selected today and opens a gifticon', async () => {
    mockedUseGifticons.mockReturnValue({
      items: [g({ id: 'today-1', name: '오늘만료아메리카노' })],
      loading: false,
    });
    const { getByText } = await render(
      <ExpiryCalendarScreen navigation={navProps.navigation} route={navProps.route} />,
    );

    fireEvent.press(getByText('오늘만료아메리카노'));
    expect(navigation.navigate).toHaveBeenCalledWith('GifticonDetail', { gifticonId: 'today-1' });
  });

  it('moves to the next month and clears the day selection', async () => {
    mockedUseGifticons.mockReturnValue({
      items: [g({ id: 'today-1', name: '오늘만료아메리카노' })],
      loading: false,
    });
    const { getByText, getByLabelText, queryByText } = await render(
      <ExpiryCalendarScreen navigation={navProps.navigation} route={navProps.route} />,
    );

    expect(getByText('오늘만료아메리카노')).toBeTruthy();
    await act(async () => fireEvent.press(getByLabelText('다음 달')));
    expect(queryByText('오늘만료아메리카노')).toBeNull();
  });
});
