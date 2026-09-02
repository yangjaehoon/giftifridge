import { useEffect } from 'react';
import { Linking } from 'react-native';
import * as Notifications from 'expo-notifications';
import { navigationRef } from './navigationRef';
import { navigateWhenReady } from './deferredNavigation';
import { parseInviteUrl } from '../features/spaces/inviteLink';

function openGifticonFromNotification(response: Notifications.NotificationResponse | null) {
  const gifticonId = response?.notification.request.content.data?.gifticonId;
  if (typeof gifticonId === 'string') {
    navigateWhenReady(() => navigationRef.navigate('GifticonDetail', { gifticonId }));
  }
}

function openJoinSpaceFromUrl(url: string | null) {
  const spaceId = parseInviteUrl(url);
  if (spaceId) {
    navigateWhenReady(() => navigationRef.navigate('JoinSpace', { spaceId }));
  }
}

/**
 * Wires the two ways the app can be opened at a specific screen — a tapped
 * expiry notification (→ GifticonDetail) and a giftifridge://join/<id> link
 * (→ JoinSpace) — for both the cold-start lookup and the already-running case.
 * navigateWhenReady defers each hop until the NavigationContainer has mounted.
 */
export function useDeepLinks(): void {
  useEffect(() => {
    Notifications.getLastNotificationResponseAsync()
      .then(openGifticonFromNotification)
      .catch(() => {
        // best-effort deep link; nothing to recover if this lookup fails
      });
    const subscription = Notifications.addNotificationResponseReceivedListener(
      openGifticonFromNotification,
    );
    return () => subscription.remove();
  }, []);

  useEffect(() => {
    Linking.getInitialURL()
      .then(openJoinSpaceFromUrl)
      .catch(() => {
        // best-effort deep link; nothing to recover if this lookup fails
      });
    const subscription = Linking.addEventListener('url', ({ url }) => openJoinSpaceFromUrl(url));
    return () => subscription.remove();
  }, []);
}
