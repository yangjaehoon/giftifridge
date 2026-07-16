import React, { useEffect } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import * as Notifications from 'expo-notifications';
import { useAuth } from '../features/auth/context/AuthContext';
import { isFirebaseConfigured } from '../lib/firebase/config';
import LoginScreen from '../features/auth/screens/LoginScreen';
import HomeScreen from '../features/gifticons/screens/HomeScreen';
import AddGifticonScreen from '../features/gifticons/screens/AddGifticonScreen';
import GifticonDetailScreen from '../features/gifticons/screens/GifticonDetailScreen';
import SetupRequiredScreen from './SetupRequiredScreen';
import OfflineBanner from '../shared/components/OfflineBanner';
import { navigationRef } from './navigationRef';

export type RootStackParamList = {
  Login: undefined;
  Home: undefined;
  AddGifticon: undefined;
  GifticonDetail: { gifticonId: string };
};

const Stack = createNativeStackNavigator<RootStackParamList>();

function openGifticonFromNotification(response: Notifications.NotificationResponse | null) {
  const gifticonId = response?.notification.request.content.data?.gifticonId;
  if (typeof gifticonId === 'string' && navigationRef.isReady()) {
    navigationRef.navigate('GifticonDetail', { gifticonId });
  }
}

export default function RootNavigator() {
  const { user, initializing } = useAuth();

  useEffect(() => {
    Notifications.getLastNotificationResponseAsync().then(openGifticonFromNotification);
    const subscription = Notifications.addNotificationResponseReceivedListener(
      openGifticonFromNotification,
    );
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

  return (
    <>
      <OfflineBanner />
      <NavigationContainer ref={navigationRef}>
        <Stack.Navigator>
          {user ? (
            <>
              <Stack.Screen
                name="Home"
                component={HomeScreen}
                options={{ title: '기프티프리지' }}
              />
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
            </>
          ) : (
            <Stack.Screen name="Login" component={LoginScreen} options={{ headerShown: false }} />
          )}
        </Stack.Navigator>
      </NavigationContainer>
    </>
  );
}
