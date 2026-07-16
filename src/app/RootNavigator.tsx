import React, { useEffect } from 'react';
import { ActivityIndicator, Linking, View } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import * as Notifications from 'expo-notifications';
import { useAuth } from '../features/auth/context/AuthContext';
import { isFirebaseConfigured } from '../lib/firebase/config';
import HomeScreen from '../features/gifticons/screens/HomeScreen';
import AddGifticonScreen from '../features/gifticons/screens/AddGifticonScreen';
import GifticonDetailScreen from '../features/gifticons/screens/GifticonDetailScreen';
import SettingsScreen from '../features/auth/screens/SettingsScreen';
import CreateSpaceScreen from '../features/spaces/screens/CreateSpaceScreen';
import JoinSpaceScreen from '../features/spaces/screens/JoinSpaceScreen';
import SpaceMembersScreen from '../features/spaces/screens/SpaceMembersScreen';
import SetupRequiredScreen from './SetupRequiredScreen';
import AuthErrorScreen from './AuthErrorScreen';
import OfflineBanner from '../shared/components/OfflineBanner';
import { navigationRef } from './navigationRef';

export type RootStackParamList = {
  Home: undefined;
  AddGifticon: { spaceId?: string } | undefined;
  GifticonDetail: { gifticonId: string };
  Settings: undefined;
  CreateSpace: undefined;
  JoinSpace: { spaceId?: string } | undefined;
  SpaceMembers: { spaceId: string };
};

const Stack = createNativeStackNavigator<RootStackParamList>();

function openGifticonFromNotification(response: Notifications.NotificationResponse | null) {
  const gifticonId = response?.notification.request.content.data?.gifticonId;
  if (typeof gifticonId === 'string' && navigationRef.isReady()) {
    navigationRef.navigate('GifticonDetail', { gifticonId });
  }
}

function parseJoinSpaceId(url: string | null): string | undefined {
  if (!url) return undefined;
  return url.match(/^giftifridge:\/\/join\/([^/?#]+)/)?.[1];
}

function openJoinSpaceFromUrl(url: string | null) {
  const spaceId = parseJoinSpaceId(url);
  if (spaceId && navigationRef.isReady()) {
    navigationRef.navigate('JoinSpace', { spaceId });
  }
}

export default function RootNavigator() {
  const { user, initializing, authError, retryAnonymousSignIn } = useAuth();

  useEffect(() => {
    Notifications.getLastNotificationResponseAsync().then(openGifticonFromNotification);
    const subscription = Notifications.addNotificationResponseReceivedListener(
      openGifticonFromNotification,
    );
    return () => subscription.remove();
  }, []);

  useEffect(() => {
    Linking.getInitialURL().then(openJoinSpaceFromUrl);
    const subscription = Linking.addEventListener('url', ({ url }) => openJoinSpaceFromUrl(url));
    return () => subscription.remove();
  }, []);

  if (!isFirebaseConfigured) {
    return <SetupRequiredScreen />;
  }

  if (initializing) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  if (!user && authError) {
    return <AuthErrorScreen message={authError} onRetry={retryAnonymousSignIn} />;
  }

  return (
    <>
      <OfflineBanner />
      <NavigationContainer ref={navigationRef}>
        <Stack.Navigator>
          <Stack.Screen name="Home" component={HomeScreen} options={{ title: '기프티냉장콘' }} />
          <Stack.Screen
            name="AddGifticon"
            component={AddGifticonScreen}
            options={{ title: '기프티콘 등록', presentation: 'modal' }}
          />
          <Stack.Screen
            name="GifticonDetail"
            component={GifticonDetailScreen}
            options={{ title: '상세보기' }}
          />
          <Stack.Screen name="Settings" component={SettingsScreen} options={{ title: '설정' }} />
          <Stack.Screen
            name="CreateSpace"
            component={CreateSpaceScreen}
            options={{ title: '스페이스 만들기', presentation: 'modal' }}
          />
          <Stack.Screen
            name="JoinSpace"
            component={JoinSpaceScreen}
            options={{ title: '스페이스 참여', presentation: 'modal' }}
          />
          <Stack.Screen
            name="SpaceMembers"
            component={SpaceMembersScreen}
            options={{ title: '멤버 관리' }}
          />
        </Stack.Navigator>
      </NavigationContainer>
    </>
  );
}
