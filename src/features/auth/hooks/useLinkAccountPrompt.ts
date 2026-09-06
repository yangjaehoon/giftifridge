import { useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = 'linkAccountPromptDismissed';
// Don't nag on the first save — wait until there's a collection worth not
// losing. Account linking is always reachable from Settings regardless.
const MIN_GIFTICONS = 3;

/**
 * Whether to show the "link an account so you don't lose these" nudge: the user
 * is still anonymous, has at least a few gifticons, and hasn't dismissed it.
 * `show` is false until the dismissed flag has loaded, so the banner never
 * flashes in and back out.
 */
export function useLinkAccountPrompt(isAnonymous: boolean, gifticonCount: number) {
  const [dismissed, setDismissed] = useState<boolean | null>(null);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((v) => setDismissed(v === '1'))
      .catch(() => setDismissed(false));
  }, []);

  const dismiss = () => {
    setDismissed(true);
    AsyncStorage.setItem(STORAGE_KEY, '1').catch(() => {
      // best-effort: the nudge may reappear next launch
    });
  };

  return {
    show: isAnonymous && gifticonCount >= MIN_GIFTICONS && dismissed === false,
    dismiss,
  };
}
