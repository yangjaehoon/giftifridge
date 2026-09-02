import { Linking } from 'react-native';
import * as Notifications from 'expo-notifications';
import { act, renderHook } from '@testing-library/react-native';
import { useDeepLinks } from './useDeepLinks';
import { navigationRef } from './navigationRef';

jest.mock('./navigationRef', () => ({
  navigationRef: { isReady: jest.fn(() => true), navigate: jest.fn() },
}));

jest.mock('expo-notifications', () => ({
  getLastNotificationResponseAsync: jest.fn(),
  addNotificationResponseReceivedListener: jest.fn(() => ({ remove: jest.fn() })),
}));

const mockedGetLastNotif = Notifications.getLastNotificationResponseAsync as jest.Mock;
const mockedAddNotifListener = Notifications.addNotificationResponseReceivedListener as jest.Mock;
const mockedNav = navigationRef as unknown as { isReady: jest.Mock; navigate: jest.Mock };

let urlHandler: (e: { url: string }) => void;
const notifRemove = jest.fn();
const urlRemove = jest.fn();

beforeEach(() => {
  jest.clearAllMocks();
  mockedNav.isReady.mockReturnValue(true);
  mockedGetLastNotif.mockResolvedValue(null);
  mockedAddNotifListener.mockReturnValue({ remove: notifRemove });
  jest.spyOn(Linking, 'getInitialURL').mockResolvedValue(null);
  jest.spyOn(Linking, 'addEventListener').mockImplementation(((_event: string, cb: never) => {
    urlHandler = cb;
    return { remove: urlRemove };
  }) as never);
});

describe('useDeepLinks — notifications', () => {
  it('navigates to the gifticon from a cold-start notification tap', async () => {
    mockedGetLastNotif.mockResolvedValue({
      notification: { request: { content: { data: { gifticonId: 'g-42' } } } },
    });

    await renderHook(() => useDeepLinks());

    expect(mockedNav.navigate).toHaveBeenCalledWith('GifticonDetail', { gifticonId: 'g-42' });
  });

  it('navigates when a notification is tapped while the app is running', async () => {
    await renderHook(() => useDeepLinks());
    const liveHandler = mockedAddNotifListener.mock.calls[0][0];

    await act(async () => {
      liveHandler({ notification: { request: { content: { data: { gifticonId: 'g-9' } } } } });
    });

    expect(mockedNav.navigate).toHaveBeenCalledWith('GifticonDetail', { gifticonId: 'g-9' });
  });

  it('ignores a notification response with no gifticonId', async () => {
    mockedGetLastNotif.mockResolvedValue({
      notification: { request: { content: { data: {} } } },
    });

    await renderHook(() => useDeepLinks());

    expect(mockedNav.navigate).not.toHaveBeenCalled();
  });

  it('swallows a failed cold-start lookup', async () => {
    mockedGetLastNotif.mockRejectedValue(new Error('no permission'));

    await expect(renderHook(() => useDeepLinks())).resolves.toBeDefined();
    expect(mockedNav.navigate).not.toHaveBeenCalled();
  });
});

describe('useDeepLinks — invite URLs', () => {
  it('routes a giftifridge://join link from a cold start', async () => {
    (Linking.getInitialURL as jest.Mock).mockResolvedValue('giftifridge://join/space-7');

    await renderHook(() => useDeepLinks());

    expect(mockedNav.navigate).toHaveBeenCalledWith('JoinSpace', { spaceId: 'space-7' });
  });

  it('routes a giftifridge://join link received while running', async () => {
    await renderHook(() => useDeepLinks());

    await act(async () => {
      urlHandler({ url: 'giftifridge://join/space-live' });
    });

    expect(mockedNav.navigate).toHaveBeenCalledWith('JoinSpace', { spaceId: 'space-live' });
  });

  it('ignores a URL that is not an invite link', async () => {
    await renderHook(() => useDeepLinks());

    await act(async () => {
      urlHandler({ url: 'https://example.com/other' });
    });

    expect(mockedNav.navigate).not.toHaveBeenCalled();
  });

  it('swallows a failed initial-URL lookup', async () => {
    (Linking.getInitialURL as jest.Mock).mockRejectedValue(new Error('unavailable'));

    await expect(renderHook(() => useDeepLinks())).resolves.toBeDefined();
    expect(mockedNav.navigate).not.toHaveBeenCalled();
  });
});

describe('useDeepLinks — teardown', () => {
  it('removes both subscriptions on unmount', async () => {
    const { unmount } = await renderHook(() => useDeepLinks());

    await unmount();

    expect(notifRemove).toHaveBeenCalledTimes(1);
    expect(urlRemove).toHaveBeenCalledTimes(1);
  });
});
