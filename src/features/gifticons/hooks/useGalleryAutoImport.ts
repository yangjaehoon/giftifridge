import { useEffect, useState } from 'react';
import { Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as MediaLibrary from 'expo-media-library';
import {
  ENABLED_KEY,
  ensureGalleryImportPermission,
  scanGalleryForGifticons,
} from '../services/galleryImport';
import {
  registerGalleryImportTask,
  unregisterGalleryImportTask,
} from '../services/galleryImportTask';
import { alertPermissionDenied } from '../../../shared/utils/permissionAlert';

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
      .then((raw) => {
        const wasEnabled = raw === 'true';
        setEnabled(wasEnabled);
        // Re-register even though expo-background-task persists registration
        // itself — cheap, idempotent insurance against the native side losing
        // it independently of this flag (a restored device, an OS reset).
        if (wasEnabled) registerGalleryImportTask().catch(() => {});
      })
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
    setLoading(true);
    try {
      if (enabled) {
        await unregisterGalleryImportTask();
        await AsyncStorage.setItem(ENABLED_KEY, 'false');
        setEnabled(false);
        return;
      }

      const granted = await ensureGalleryImportPermission();
      if (!granted) {
        alertPermissionDenied('알림', '사진 접근 권한이 필요해요.');
        return;
      }
      await registerGalleryImportTask();
      await AsyncStorage.setItem(ENABLED_KEY, 'true');
      setEnabled(true);
      if (ownerId) scanGalleryForGifticons(ownerId).catch(() => {});
    } catch {
      Alert.alert('오류', '설정을 변경하지 못했어요. 다시 시도해주세요.');
    } finally {
      setLoading(false);
    }
  };

  return { enabled, loading, toggle };
}
