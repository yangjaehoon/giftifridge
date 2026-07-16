import React from 'react';
import { ActivityIndicator, View } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useAuth } from '../context/AuthContext';
import { isFirebaseConfigured } from '../firebase/config';
import LoginScreen from '../screens/LoginScreen';
import HomeScreen from '../screens/HomeScreen';
import AddGifticonScreen from '../screens/AddGifticonScreen';
import GifticonDetailScreen from '../screens/GifticonDetailScreen';
import SetupRequiredScreen from '../screens/SetupRequiredScreen';
import type { Gifticon } from '../types/gifticon';

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
