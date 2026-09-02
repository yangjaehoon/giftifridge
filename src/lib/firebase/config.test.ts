/* eslint-disable @typescript-eslint/no-require-imports */
jest.mock('firebase/app', () => ({
  initializeApp: jest.fn(() => ({ name: 'app' })),
  getApps: jest.fn(() => [] as unknown[]),
  getApp: jest.fn(() => ({ name: 'app' })),
}));
jest.mock('firebase/auth', () => ({
  initializeAuth: jest.fn(() => ({ type: 'rn-auth' })),
  getAuth: jest.fn(() => ({ type: 'web-auth' })),
  getReactNativePersistence: jest.fn(() => 'persistence'),
}));
jest.mock('firebase/firestore', () => ({
  getFirestore: jest.fn(() => ({ type: 'firestore' })),
}));
jest.mock('firebase/storage', () => ({
  getStorage: jest.fn(() => ({ type: 'storage' })),
}));
jest.mock('@react-native-async-storage/async-storage', () => ({}));

const FIREBASE_ENV_KEYS = [
  'EXPO_PUBLIC_FIREBASE_API_KEY',
  'EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN',
  'EXPO_PUBLIC_FIREBASE_PROJECT_ID',
  'EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET',
  'EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID',
  'EXPO_PUBLIC_FIREBASE_APP_ID',
] as const;

const originalEnv = process.env;

type AppMock = { initializeApp: jest.Mock; getApps: jest.Mock; getApp: jest.Mock };
type AuthMock = { initializeAuth: jest.Mock; getAuth: jest.Mock };
type FirestoreMock = { getFirestore: jest.Mock };
type StorageMock = { getStorage: jest.Mock };

// jest.resetModules() re-runs the mock factories, so the fresh instances have to
// be re-grabbed after each reset rather than captured once at file scope.
function loadConfig() {
  const app = require('firebase/app') as AppMock;
  const auth = require('firebase/auth') as AuthMock;
  const firestore = require('firebase/firestore') as FirestoreMock;
  const storage = require('firebase/storage') as StorageMock;
  const mod = require('./config') as {
    isFirebaseConfigured: boolean;
    auth: unknown;
    db: unknown;
    storage: unknown;
  };
  return { app, auth, firestore, storage, mod };
}

beforeEach(() => {
  jest.resetModules();
  process.env = { ...originalEnv };
  for (const key of FIREBASE_ENV_KEYS) delete process.env[key];
});

afterAll(() => {
  process.env = originalEnv;
});

function setConfiguredEnv() {
  process.env.EXPO_PUBLIC_FIREBASE_API_KEY = 'key';
  process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID = 'proj';
  process.env.EXPO_PUBLIC_FIREBASE_APP_ID = 'app-id';
}

describe('firebase config', () => {
  it('reports not configured and never touches firebase when the env vars are missing', () => {
    const { app, firestore, storage, mod } = loadConfig();

    expect(mod.isFirebaseConfigured).toBe(false);
    expect(mod.auth).toBeUndefined();
    expect(mod.db).toBeUndefined();
    expect(mod.storage).toBeUndefined();
    expect(app.initializeApp).not.toHaveBeenCalled();
    expect(firestore.getFirestore).not.toHaveBeenCalled();
    expect(storage.getStorage).not.toHaveBeenCalled();
  });

  it('initializes app, RN auth persistence, firestore, and storage when configured', () => {
    setConfiguredEnv();
    const { app, auth, firestore, storage, mod } = loadConfig();

    expect(mod.isFirebaseConfigured).toBe(true);
    expect(app.initializeApp).toHaveBeenCalledWith(
      expect.objectContaining({ apiKey: 'key', projectId: 'proj', appId: 'app-id' }),
    );
    expect(auth.initializeAuth).toHaveBeenCalled();
    expect(firestore.getFirestore).toHaveBeenCalled();
    expect(storage.getStorage).toHaveBeenCalled();
    expect(mod.auth).toEqual({ type: 'rn-auth' });
    expect(mod.storage).toEqual({ type: 'storage' });
  });

  it('reuses the existing app instead of re-initializing when one already exists', () => {
    setConfiguredEnv();
    (require('firebase/app') as AppMock).getApps.mockReturnValue([{ name: 'existing' }]);

    const { app } = loadConfig();

    expect(app.getApp).toHaveBeenCalledTimes(1);
    expect(app.initializeApp).not.toHaveBeenCalled();
  });

  it('falls back to getAuth when initializeAuth throws (already initialized)', () => {
    setConfiguredEnv();
    (require('firebase/auth') as AuthMock).initializeAuth.mockImplementation(() => {
      throw new Error('already initialized');
    });

    const { auth, mod } = loadConfig();

    expect(auth.getAuth).toHaveBeenCalled();
    expect(mod.auth).toEqual({ type: 'web-auth' });
  });
});
