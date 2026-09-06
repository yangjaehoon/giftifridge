import { useEffect } from 'react';
import { Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { isFirebaseConfigured } from '../lib/firebase/config';

const STORAGE_KEY = 'firstRunNoticeShown';

const NOTICE_BODY =
  '로그인 없이 바로 사용할 수 있어요. 다만 180일 동안 앱을 한 번도 실행하지 않으면 등록한 ' +
  '기프티콘과 사진이 자동으로 삭제될 수 있어요. 오래 보관하려면 가끔 앱을 열어주세요.';

/**
 * One-time notice on the first launch after install. The app uses anonymous
 * sign-in with no forced login, and a scheduled Cloud Function
 * (cleanupInactiveAnonymousUsers) deletes an anonymous account — and every
 * gifticon it registered — after 180 days with no app opens. The seen-flag
 * lives in AsyncStorage, so clearing the app's data (which also orphans the
 * anonymous account) resets it and the notice shows again on the next launch,
 * which is the right moment to repeat it.
 */
export function useFirstRunNotice() {
  useEffect(() => {
    if (!isFirebaseConfigured) return;
    let cancelled = false;
    (async () => {
      try {
        const seen = await AsyncStorage.getItem(STORAGE_KEY);
        if (cancelled || seen) return;
        Alert.alert('안내', NOTICE_BODY, [{ text: '확인' }]);
        await AsyncStorage.setItem(STORAGE_KEY, '1');
      } catch {
        // Best-effort: a storage failure just means the notice may show again.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);
}
