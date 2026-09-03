import * as Haptics from 'expo-haptics';

// Thin wrapper so screens express intent ("this succeeded") rather than reach
// into expo-haptics, and so a device without a haptic engine (or an emulator)
// never turns a missing buzz into an error.
function run(fn: () => Promise<unknown>): void {
  try {
    void Promise.resolve(fn()).catch(() => {});
  } catch {
    // haptics unavailable on this device
  }
}

export const haptics = {
  success: () => run(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)),
  warning: () => run(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning)),
  light: () => run(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)),
  selection: () => run(() => Haptics.selectionAsync()),
};
