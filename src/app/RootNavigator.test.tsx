/* eslint-disable @typescript-eslint/no-require-imports */
import React from 'react';
import { Linking } from 'react-native';
import * as Notifications from 'expo-notifications';
import { act, render, waitFor } from '@testing-library/react-native';
import RootNavigator from './RootNavigator';
import { useCurrentUser, useAuthBootstrap } from '../features/auth/context/AuthContext';
import { navigationRef } from './navigationRef';

const configState = { isFirebaseConfigured: true };
jest.mock('../lib/firebase/config', () => ({
  get isFirebaseConfigured() {
    return configState.isFirebaseConfigured;
  },
}));

jest.mock('../features/auth/context/AuthContext', () => ({
  useCurrentUser: jest.fn(),
  useAuthBootstrap: jest.fn(),
}));

jest.mock('./navigationRef', () => ({
  navigationRef: { isReady: jest.fn(() => true), navigate: jest.fn() },
}));

jest.mock('@react-navigation/native', () => ({
  NavigationContainer: ({ children }: { children: React.ReactNode }) => children,
}));

jest.mock('@react-navigation/native-stack', () => ({
  createNativeStackNavigator: () => ({
    Navigator: ({ children }: { children: React.ReactNode }) => children,
    Screen: () => null,
  }),
}));

jest.mock('../features/gifticons/screens/HomeScreen', () => () => null);
jest.mock('../features/gifticons/screens/AddGifticonScreen', () => () => null);
jest.mock('../features/gifticons/screens/GifticonDetailScreen', () => () => null);
jest.mock('../features/auth/screens/SettingsScreen', () => () => null);
jest.mock('../features/spaces/screens/CreateSpaceScreen', () => () => null);
jest.mock('../features/spaces/screens/JoinSpaceScreen', () => () => null);
jest.mock('../features/spaces/screens/SpaceMembersScreen', () => () => null);
jest.mock('../features/gifticons/components/GifticonCardSkeleton', () => {
  const { Text: RNText } = require('react-native');
  const MockSkeleton = () => <RNText>skeleton</RNText>;
  return MockSkeleton;
});
jest.mock('./SetupRequiredScreen', () => {
  const { Text: RNText } = require('react-native');
  const MockSetupRequired = () => <RNText>setup required</RNText>;
  return MockSetupRequired;
});
jest.mock('./AuthErrorScreen', () => {
  const { Text: RNText } = require('react-native');
  const MockAuthError = ({ message }: { message: string }) => (
    <RNText>auth error: {message}</RNText>
  );
  return MockAuthError;
});
jest.mock('../shared/components/OfflineBanner', () => {
  const { Text: RNText } = require('react-native');
  const MockOfflineBanner = () => <RNText>offline banner</RNText>;
  return MockOfflineBanner;
});

jest.mock('expo-notifications', () => ({
  getLastNotificationResponseAsync: jest.fn(),
  addNotificationResponseReceivedListener: jest.fn(() => ({ remove: jest.fn() })),
}));

const mockedUseCurrentUser = useCurrentUser as jest.Mock;
const mockedUseAuthBootstrap = useAuthBootstrap as jest.Mock;

function setAuth(state: {
  user?: { uid: string } | null;
  initializing?: boolean;
  authError?: string | null;
}) {
  mockedUseCurrentUser.mockReturnValue({ user: state.user ?? null, isAnonymous: !state.user });
  mockedUseAuthBootstrap.mockReturnValue({
    initializing: state.initializing ?? false,
    authError: state.authError ?? null,
    retryAnonymousSignIn: jest.fn(),
  });
}

const mockedGetLastNotif = Notifications.getLastNotificationResponseAsync as jest.Mock;
const mockedAddNotifListener = Notifications.addNotificationResponseReceivedListener as jest.Mock;
const mockedNavRef = navigationRef as unknown as { isReady: jest.Mock; navigate: jest.Mock };

beforeEach(() => {
  jest.clearAllMocks();
  configState.isFirebaseConfigured = true;
  setAuth({ user: { uid: 'u1' } });
  mockedGetLastNotif.mockResolvedValue(null);
  mockedAddNotifListener.mockReturnValue({ remove: jest.fn() });
  mockedNavRef.isReady.mockReturnValue(true);
  jest.spyOn(Linking, 'getInitialURL').mockResolvedValue(null);
  jest.spyOn(Linking, 'addEventListener').mockReturnValue({ remove: jest.fn() } as never);
});

describe('RootNavigator', () => {
  it('renders the setup screen when Firebase is not configured', async () => {
    configState.isFirebaseConfigured = false;
    const { getByText } = await render(<RootNavigator />);
    expect(getByText('setup required')).toBeTruthy();
  });

  it('renders loading skeletons while auth is initializing', async () => {
    setAuth({ user: null, initializing: true });
    const { getAllByText } = await render(<RootNavigator />);
    expect(getAllByText('skeleton')).toHaveLength(5);
  });

  it('renders the auth error screen when sign-in failed with no user', async () => {
    setAuth({ user: null, authError: '로그인 실패' });
    const { getByText } = await render(<RootNavigator />);
    expect(getByText('auth error: 로그인 실패')).toBeTruthy();
  });

  it('renders the navigator with the offline banner once signed in', async () => {
    const { getByText } = await render(<RootNavigator />);
    expect(getByText('offline banner')).toBeTruthy();
  });

  it('navigates to a gifticon when launched from a notification tap', async () => {
    mockedGetLastNotif.mockResolvedValue({
      notification: { request: { content: { data: { gifticonId: 'g-42' } } } },
    });

    await render(<RootNavigator />);

    await waitFor(() =>
      expect(mockedNavRef.navigate).toHaveBeenCalledWith('GifticonDetail', { gifticonId: 'g-42' }),
    );
  });

  it('routes a giftifridge://join deep link to the JoinSpace screen', async () => {
    (Linking.getInitialURL as jest.Mock).mockResolvedValue('giftifridge://join/space-7');

    await render(<RootNavigator />);

    await waitFor(() =>
      expect(mockedNavRef.navigate).toHaveBeenCalledWith('JoinSpace', { spaceId: 'space-7' }),
    );
  });

  it('forwards a live notification response through the registered listener', async () => {
    await render(<RootNavigator />);

    const handler = mockedAddNotifListener.mock.calls[0][0];
    await act(async () => {
      handler({ notification: { request: { content: { data: { gifticonId: 'g-9' } } } } });
    });

    expect(mockedNavRef.navigate).toHaveBeenCalledWith('GifticonDetail', { gifticonId: 'g-9' });
  });

  it('ignores a notification response without a gifticonId', async () => {
    mockedGetLastNotif.mockResolvedValue({
      notification: { request: { content: { data: {} } } },
    });

    await act(async () => {
      await render(<RootNavigator />);
    });

    expect(mockedGetLastNotif).toHaveBeenCalled();
    expect(mockedNavRef.navigate).not.toHaveBeenCalled();
  });
});
