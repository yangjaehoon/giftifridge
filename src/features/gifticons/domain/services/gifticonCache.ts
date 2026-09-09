import AsyncStorage from '@react-native-async-storage/async-storage';
import { toGifticon } from './gifticonMapper';
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

// The mirror is trusted as little as any other stored blob: every entry is run
// back through toGifticon, so a row from an older app schema (or a corrupt
// one) can't reach a screen that assumes valid string fields.
function parseGifticons(raw: string | null): Gifticon[] | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return null;
    return parsed
      .map((g) => (g && typeof g === 'object' ? toGifticon((g as Gifticon).id, g) : null))
      .filter((g): g is Gifticon => g !== null);
  } catch {
    return null;
  }
}

async function readAt(fullKey: string): Promise<Gifticon[] | null> {
  try {
    return parseGifticons(await AsyncStorage.getItem(fullKey));
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
 * Every barcode across every cached list (personal + spaces). Gallery
 * auto-import uses it to skip re-photographing a gifticon the user already
 * has — best-effort: as fresh as the last list view, capped at MAX_CACHED per
 * list, and an empty set (offline cold start, storage error) just means "don't
 * dedupe this scan".
 */
export async function readCachedBarcodes(): Promise<Set<string>> {
  const barcodes = new Set<string>();
  try {
    const keys = (await AsyncStorage.getAllKeys()).filter((k) => k.startsWith(PREFIX));
    if (keys.length === 0) return barcodes;
    for (const [, raw] of await AsyncStorage.multiGet(keys)) {
      for (const gifticon of parseGifticons(raw) ?? []) {
        if (gifticon.barcode) barcodes.add(gifticon.barcode);
      }
    }
  } catch {
    // best-effort
  }
  return barcodes;
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
      const found = parseGifticons(raw)?.find((g) => g.id === id);
      if (found) return found;
    }
    return null;
  } catch {
    return null;
  }
}
