import AsyncStorage from '@react-native-async-storage/async-storage';

// The persisted state a gallery scan reads and writes: how far it has already
// looked (the cursor), which asset ids it has already handled (the dedupe set),
// and how many extra OCR passes a close-but-not-yet asset still gets (retries).
// Kept in one module so the foreground listener and the background task share
// exactly the same view of "new" and "already done".

const LAST_CHECKED_KEY = 'galleryImportLastCheckedAt';
const IMPORTED_IDS_KEY = 'galleryImportImportedIds';
const RETRIES_KEY = 'galleryImportRetries';

// Bounds the dedupe set's storage footprint; recent-enough that a normal scan
// cadence never sees the same asset id twice before it would roll off anyway.
const IMPORTED_IDS_CAP = 500;

export async function getLastCheckedAt(): Promise<number> {
  const raw = await AsyncStorage.getItem(LAST_CHECKED_KEY);
  if (raw != null) return Number(raw);
  // First run ever: only look forward from here, never backfill the user's
  // entire existing camera roll as "new".
  const now = Date.now();
  await AsyncStorage.setItem(LAST_CHECKED_KEY, String(now));
  return now;
}

export async function setLastCheckedAt(at: number): Promise<void> {
  await AsyncStorage.setItem(LAST_CHECKED_KEY, String(at));
}

export async function getImportedIds(): Promise<Set<string>> {
  const raw = await AsyncStorage.getItem(IMPORTED_IDS_KEY);
  if (!raw) return new Set();
  try {
    const parsed = JSON.parse(raw);
    return new Set(Array.isArray(parsed) ? parsed : []);
  } catch {
    return new Set();
  }
}

export async function saveImportedIds(ids: Set<string>): Promise<void> {
  const trimmed = Array.from(ids).slice(-IMPORTED_IDS_CAP);
  await AsyncStorage.setItem(IMPORTED_IDS_KEY, JSON.stringify(trimmed));
}

export async function getRetries(): Promise<Map<string, number>> {
  const raw = await AsyncStorage.getItem(RETRIES_KEY);
  if (!raw) return new Map();
  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return new Map();
    return new Map(
      Object.entries(parsed).filter(([, v]) => typeof v === 'number') as [string, number][],
    );
  } catch {
    return new Map();
  }
}

export async function saveRetries(retries: Map<string, number>): Promise<void> {
  const entries = Array.from(retries.entries()).slice(-IMPORTED_IDS_CAP);
  await AsyncStorage.setItem(RETRIES_KEY, JSON.stringify(Object.fromEntries(entries)));
}
