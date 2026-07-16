import React from 'react';
import { ActivityIndicator, View } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useAuth } from '../features/auth/context/AuthContext';
import { isFirebaseConfigured } from '../lib/firebase/config';
import LoginScreen from '../features/auth/screens/LoginScreen';
import HomeScreen from '../features/gifticons/screens/HomeScreen';
import AddGifticonScreen from '../features/gifticons/screens/AddGifticonScreen';
import GifticonDetailScreen from '../features/gifticons/screens/GifticonDetailScreen';
import SetupRequiredScreen from './SetupRequiredScreen';
import type { Gifticon } from '../features/gifticons/types';

export type RootStackParamList = {
  Login: undefined;
  Home: undefined;
  AddGifticon: undefined;
  GifticonDetail: { gifticon: Gifticon };
};

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function RootNavigator() {
  const { user, initializing } = useAuth();

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
    <NavigationContainer>
      <Stack.Navigator>
        {user ? (
          <>
            <Stack.Screen name="Home" component={HomeScreen} options={{ title: '기프티프리지' }} />
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
  );
}
