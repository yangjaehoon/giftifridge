import { useEffect, useState } from 'react';
import { Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as MediaLibrary from 'expo-media-library';
import { ensureGalleryImportPermission, scanGalleryForGifticons } from '../services/galleryImport';
import {
  registerGalleryImportTask,
  unregisterGalleryImportTask,
} from '../services/galleryImportTask';

const ENABLED_KEY = 'galleryImportEnabled';

/**
 * Settings-screen toggle for gallery auto-import: persists on/off across
 * restarts, (de)registers the background task, and — while on and the app is
 * in the foreground — runs an immediate scan on every library change instead
 * of waiting for the OS's own (much less frequent) background schedule.
 */
export function useGalleryAutoImport(ownerId: string | undefined) {
  const [enabled, setEnabled] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    AsyncStorage.getItem(ENABLED_KEY)
      .then((raw) => setEnabled(raw === 'true'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!enabled || !ownerId) return;
    const subscription = MediaLibrary.addListener(() => {
      scanGalleryForGifticons(ownerId).catch(() => {
        // best-effort; the next library change or background run tries again
      });
    });
    return () => subscription.remove();
  }, [enabled, ownerId]);

  const toggle = async () => {
    if (enabled) {
      setEnabled(false);
      await AsyncStorage.setItem(ENABLED_KEY, 'false');
      await unregisterGalleryImportTask();
      return;
    }

    setLoading(true);
    try {
      const granted = await ensureGalleryImportPermission();
      if (!granted) {
        Alert.alert('알림', '사진 접근 권한이 필요해요.');
        return;
      }
      await registerGalleryImportTask();
      setEnabled(true);
      await AsyncStorage.setItem(ENABLED_KEY, 'true');
      if (ownerId) scanGalleryForGifticons(ownerId).catch(() => {});
    } finally {
      setLoading(false);
    }
  };

  return { enabled, loading, toggle };
}
