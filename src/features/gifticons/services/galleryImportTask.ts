import * as TaskManager from 'expo-task-manager';
import * as BackgroundTask from 'expo-background-task';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { waitForAuthUser } from '../../../lib/firebase/auth';
import { ENABLED_KEY, scanGalleryForGifticons } from './galleryImport';

// TaskManager requires defineTask to run in the JS bundle's global scope (not
// inside a component), so this module must be imported once at the top of
// index.ts — before registerRootComponent — so it's defined on every launch,
// including a headless one the OS wakes up to run the background task.

export const GALLERY_IMPORT_TASK_NAME = 'gifticon-gallery-import';

// The system controls how often this actually runs (at minimum ~15min, often
// much less frequently — see expo-background-task's docs) and, on iOS, may
// not run at all if the user force-quits the app from the app switcher; that
// is a platform restriction this code can't work around.
const MINIMUM_INTERVAL_MINUTES = 15;

TaskManager.defineTask(GALLERY_IMPORT_TASK_NAME, async () => {
  try {
    // Belt-and-suspenders alongside register/unregister: if those ever failed
    // to keep the native registration in sync with the Settings toggle, the
    // OS could still invoke this task while the user believes it's off.
    const enabled = await AsyncStorage.getItem(ENABLED_KEY);
    if (enabled !== 'true') return BackgroundTask.BackgroundTaskResult.Success;

    const user = await waitForAuthUser();
    if (!user) return BackgroundTask.BackgroundTaskResult.Failed;
    await scanGalleryForGifticons(user.uid);
    return BackgroundTask.BackgroundTaskResult.Success;
  } catch {
    return BackgroundTask.BackgroundTaskResult.Failed;
  }
});

export async function registerGalleryImportTask(): Promise<void> {
  await BackgroundTask.registerTaskAsync(GALLERY_IMPORT_TASK_NAME, {
    minimumInterval: MINIMUM_INTERVAL_MINUTES,
  });
}

export async function unregisterGalleryImportTask(): Promise<void> {
  await BackgroundTask.unregisterTaskAsync(GALLERY_IMPORT_TASK_NAME);
}
