# Expo HAS CHANGED

Read the exact versioned docs at https://docs.expo.dev/versions/v57.0.0/ before writing any code.

# Git workflow

Always commit when a task is finished — don't leave completed work uncommitted. Write commit messages following Conventional Commits (`type(scope): description`, e.g. `feat:`, `fix:`, `refactor:`, `docs:`) — enforced on commit by commitlint via the `commit-msg` hook. After committing, push to `origin/master` too — don't leave finished work sitting local-only.

# Code conventions

- **Folder structure**: `src/features/<domain>/` holds everything for one domain (e.g. `gifticons`, `auth`), split into `components/`, `hooks/`, `screens/`, `services/`, and (where needed) `context/`. Cross-feature code goes in `src/shared/{components,hooks,theme,utils}`. `src/app` holds root navigation/setup screens; `src/lib` holds external-service configuration (e.g. Firebase).
- **Naming**: PascalCase for components/screens (`GifticonCard.tsx`), camelCase for hooks/services/utils (`useGifticons.ts`, `gifticonService.ts`).
- **Per-feature files**: each feature gets its own `errors.ts` (domain error types) and `types.ts` (domain types) at the feature root rather than a shared global file.
- **Tests**: colocate as `<name>.test.ts` next to the file under test, not in a separate `__tests__` tree.
- **Style enforcement**: ESLint (`eslint-config-expo` + `eslint-config-prettier`) and Prettier run via `lint-staged` on every commit; TypeScript `strict` is on — don't add `any` or non-null assertions to route around it.

# Project-specific gotchas

- **Must use a dev-client, not Expo Go.** `expo-notifications` throws a fatal error in Expo Go on SDK 53+ (remote push was removed from Expo Go). Test with a custom dev build (`npx expo run:android`) instead — `npx expo start --dev-client` afterward for iteration.
- **Firebase must not initialize eagerly.** `initializeApp`/`getAuth`/`getFirestore`/`getStorage` are only called when `isFirebaseConfigured` is true (see the Firebase config module). Calling them with missing/invalid env values throws synchronously (e.g. `auth/invalid-api-key`) before the app can render its own "setup required" screen.
- **Anonymous auth must be enabled in the Firebase console.** The app auto-signs in anonymously on launch (see `AuthContext`) so there's no forced login screen. If Anonymous sign-in isn't enabled under Authentication → Sign-in method, that sign-in silently fails and every write (e.g. saving a gifticon) silently no-ops — surfaced to the user via `AuthErrorScreen`, but easy to miss if you're only reading logs.
- **Env vars**: Firebase config comes from `EXPO_PUBLIC_FIREBASE_*` vars in a local `.env` file (see `.env.example`). `.env` is gitignored and must be created per machine. Metro only reads `.env` at server startup, so restart the dev server after editing it.
- **Run/test**: `npm run dev` starts Metro and opens the app on the Android emulator (Pixel_8). The `predev` script (`scripts/ensure-emulator.js`) boots the emulator automatically if it isn't already running, so there's no need to start it by hand first.
