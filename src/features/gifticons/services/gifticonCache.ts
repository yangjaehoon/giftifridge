import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Gifticon } from '../types';

// A write-through mirror of a gifticon list in AsyncStorage. The web Firebase
// JS SDK keeps no on-disk cache on React Native, so a cold start with no
// network would otherwise show nothing — no list, no barcode, exactly when the
// user is standing at a counter. Live Firestore snapshots always win; this
// only fills the gap before the first one arrives, or when it never does.

const PREFIX = 'gifticonCache:';
// AsyncStorage is not meant for megabytes; the barcode + core fields of a few
// hundred gifticons is well under 100 KB.
const MAX_CACHED = 300;

const scopedKey = (scope: string, key: string) => `${PREFIX}${scope}:${key}`;

async function readAt(fullKey: string): Promise<Gifticon[] | null> {
  try {
    const raw = await AsyncStorage.getItem(fullKey);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as Gifticon[]) : null;
  } catch {
    return null;
  }
}

async function writeAt(fullKey: string, gifticons: Gifticon[]): Promise<void> {
  try {
    await AsyncStorage.setItem(fullKey, JSON.stringify(gifticons.slice(0, MAX_CACHED)));
  } catch {
    // best-effort mirror
  }
}

export interface GifticonListCache {
  read: (key: string) => Promise<Gifticon[] | null>;
  write: (key: string, items: Gifticon[]) => void;
}

/** The cache adapter for one list scope, passed to useFirestoreList. */
export function gifticonListCache(scope: 'owner' | 'space'): GifticonListCache {
  return {
    read: (key) => readAt(scopedKey(scope, key)),
    write: (key, items) => {
      void writeAt(scopedKey(scope, key), items);
    },
  };
}

/**
 * Finds one gifticon by id across every cached list — the detail screen only
 * has the id, not which list it came from. Null on a miss or any storage error.
 */
export async function readCachedGifticon(id: string): Promise<Gifticon | null> {
  try {
    const keys = (await AsyncStorage.getAllKeys()).filter((k) => k.startsWith(PREFIX));
    if (keys.length === 0) return null;
    for (const [, raw] of await AsyncStorage.multiGet(keys)) {
      if (!raw) continue;
      try {
        const list = JSON.parse(raw);
        if (!Array.isArray(list)) continue;
        const found = (list as Gifticon[]).find((g) => g?.id === id);
        if (found) return found;
      } catch {
        // skip a corrupt entry
      }
    }
    return null;
  } catch {
    return null;
  }
}
