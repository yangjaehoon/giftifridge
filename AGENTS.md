# Expo HAS CHANGED

Read the exact versioned docs at https://docs.expo.dev/versions/v57.0.0/ before writing any code.

# Git workflow

Always commit when a task is finished — don't leave completed work uncommitted. Write commit messages following Conventional Commits (`type(scope): description`, e.g. `feat:`, `fix:`, `refactor:`, `docs:`).

# Project-specific gotchas

- **Must use a dev-client, not Expo Go.** `expo-notifications` throws a fatal error in Expo Go on SDK 53+ (remote push was removed from Expo Go). Test with a custom dev build (`npx expo run:android`) instead — `npx expo start --dev-client` afterward for iteration.
- **Firebase must not initialize eagerly.** `initializeApp`/`getAuth`/`getFirestore`/`getStorage` are only called when `isFirebaseConfigured` is true (see the Firebase config module). Calling them with missing/invalid env values throws synchronously (e.g. `auth/invalid-api-key`) before the app can render its own "setup required" screen.
- **Env vars**: Firebase config comes from `EXPO_PUBLIC_FIREBASE_*` vars in a local `.env` file (see `.env.example`). `.env` is gitignored and must be created per machine. Metro only reads `.env` at server startup, so restart the dev server after editing it.
- **Run/test**: `npm run dev` starts Metro and opens the app on the Android emulator (Pixel_8). The `predev` script (`scripts/ensure-emulator.js`) boots the emulator automatically if it isn't already running, so there's no need to start it by hand first.
