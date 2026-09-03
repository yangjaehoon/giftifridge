import 'react-native-gesture-handler';
import React, { useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider } from './src/features/auth/context/AuthContext';
import { ToastProvider } from './src/shared/components/ToastProvider';
import ErrorBoundary from './src/app/ErrorBoundary';
import RootNavigator from './src/app/RootNavigator';
import { initNotifications } from './src/features/gifticons/services/notificationService';

export default function App() {
  useEffect(() => {
    initNotifications().catch(() => {
      // channel/handler setup is best-effort; scheduling still checks permission
    });
  }, []);

  return (
    <SafeAreaProvider>
      <ErrorBoundary>
        <AuthProvider>
          <ToastProvider>
            <RootNavigator />
          </ToastProvider>
        </AuthProvider>
      </ErrorBoundary>
      <StatusBar style="auto" />
    </SafeAreaProvider>
  );
}
