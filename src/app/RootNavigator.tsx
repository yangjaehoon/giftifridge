import React, { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import { DarkTheme, DefaultTheme, NavigationContainer, type Theme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useTheme, useThemedStyles } from '../shared/theme/ThemeProvider';
import type { Palette } from '../shared/theme/colors';
import { useCurrentUser, useAuthBootstrap } from '../shared/auth/AuthContext';
import { isFirebaseConfigured } from '../lib/firebase/config';
import HomeScreen from '../features/gifticons/browse/HomeScreen';
import AddGifticonScreen from '../features/gifticons/capture/AddGifticonScreen';
import GifticonDetailScreen from '../features/gifticons/detail/GifticonDetailScreen';
import SpendingReportScreen from '../features/gifticons/reporting/SpendingReportScreen';
import ExpiryCalendarScreen from '../features/gifticons/reporting/ExpiryCalendarScreen';
import GifticonCardSkeleton from '../features/gifticons/domain/components/GifticonCardSkeleton';
import SettingsScreen from '../features/auth/screens/SettingsScreen';
import CreateSpaceScreen from '../features/spaces/screens/CreateSpaceScreen';
import JoinSpaceScreen from '../features/spaces/screens/JoinSpaceScreen';
import SpaceMembersScreen from '../features/spaces/screens/SpaceMembersScreen';
import SetupRequiredScreen from './SetupRequiredScreen';
import AuthErrorScreen from './AuthErrorScreen';
import OfflineBanner from '../shared/components/OfflineBanner';
import { navigationRef } from './navigationRef';
import { flushDeferredNavigations } from './deferredNavigation';
import { useDeepLinks } from './useDeepLinks';
import { useFirstRunNotice } from './useFirstRunNotice';
import type { RootStackParamList } from './navigationTypes';

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function RootNavigator() {
  const { user } = useCurrentUser();
  const { initializing, authError, retryAnonymousSignIn } = useAuthBootstrap();
  const { scheme, colors } = useTheme();
  const styles = useThemedStyles(makeStyles);
  // Memoised so NavigationContainer doesn't see a new `theme` object (and
  // re-notify every navigation-tree consumer) on unrelated RootNavigator
  // re-renders.
  const navTheme = useMemo(() => navigationTheme(scheme, colors), [scheme, colors]);

  useDeepLinks();
  useFirstRunNotice();

  if (!isFirebaseConfigured) {
    return <SetupRequiredScreen />;
  }

  if (initializing) {
    return (
      <View style={styles.initializing}>
        {Array.from({ length: 5 }).map((_, i) => (
          <GifticonCardSkeleton key={i} />
        ))}
      </View>
    );
  }

  if (!user && authError) {
    return <AuthErrorScreen message={authError} onRetry={retryAnonymousSignIn} />;
  }

  return (
    <>
      <OfflineBanner />
      <NavigationContainer ref={navigationRef} onReady={flushDeferredNavigations} theme={navTheme}>
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
          <Stack.Screen
            name="Report"
            component={SpendingReportScreen}
            options={{ title: '소비 리포트' }}
          />
          <Stack.Screen
            name="Calendar"
            component={ExpiryCalendarScreen}
            options={{ title: '만료 달력' }}
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

// React Navigation draws the header and the screen background behind our own
// screens, so its theme has to track ours or a dark screen sits on a white gap.
function navigationTheme(scheme: 'light' | 'dark', colors: Palette): Theme {
  const base = scheme === 'dark' ? DarkTheme : DefaultTheme;
  return {
    ...base,
    colors: {
      ...base.colors,
      primary: colors.primary,
      background: colors.background,
      card: colors.surface,
      text: colors.gray900,
      border: colors.border,
    },
  };
}

const makeStyles = (colors: Palette) =>
  StyleSheet.create({
    initializing: {
      flex: 1,
      justifyContent: 'center',
      paddingTop: 60,
      backgroundColor: colors.background,
    },
  });
