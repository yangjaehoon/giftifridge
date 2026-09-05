jest.mock('expo-task-manager', () => ({ defineTask: jest.fn() }));
jest.mock('expo-background-task', () => ({
  registerTaskAsync: jest.fn(),
  unregisterTaskAsync: jest.fn(),
  BackgroundTaskResult: { Success: 1, Failed: 2 },
}));
jest.mock('@react-native-async-storage/async-storage', () =>
  jest.requireActual('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);
jest.mock('../../../lib/firebase/auth', () => ({ waitForAuthUser: jest.fn() }));
jest.mock('./galleryImport', () => ({
  ENABLED_KEY: 'galleryImportEnabled',
  scanGalleryForGifticons: jest.fn(),
}));

type TaskManagerMock = { defineTask: jest.Mock };
type BackgroundTaskMock = {
  registerTaskAsync: jest.Mock;
  unregisterTaskAsync: jest.Mock;
  BackgroundTaskResult: { Success: number; Failed: number };
};
type AsyncStorageMock = {
  getItem: (key: string) => Promise<string | null>;
  setItem: (key: string, value: string) => Promise<void>;
  clear: () => Promise<void>;
};

let TaskManager: TaskManagerMock;
let BackgroundTask: BackgroundTaskMock;
let AsyncStorage: AsyncStorageMock;
let mockedWaitForAuthUser: jest.Mock;
let mockedScan: jest.Mock;
let GALLERY_IMPORT_TASK_NAME: string;
let registerGalleryImportTask: () => Promise<void>;
let unregisterGalleryImportTask: () => Promise<void>;
let executor: (body: unknown) => Promise<unknown>;

// The module under test calls TaskManager.defineTask at import time (a side
// effect it must, since defineTask has to run in global scope), so each test
// re-requires everything fresh after resetModules to get a clean executor —
// a static top-of-file import would keep pointing at the pre-reset mocks.
beforeEach(async () => {
  jest.resetModules();
  /* eslint-disable @typescript-eslint/no-require-imports */
  TaskManager = require('expo-task-manager');
  BackgroundTask = require('expo-background-task');
  AsyncStorage = require('@react-native-async-storage/async-storage');
  ({ waitForAuthUser: mockedWaitForAuthUser } = require('../../../lib/firebase/auth'));
  ({ scanGalleryForGifticons: mockedScan } = require('./galleryImport'));
  ({
    GALLERY_IMPORT_TASK_NAME,
    registerGalleryImportTask,
    unregisterGalleryImportTask,
  } = require('./galleryImportTask'));
  /* eslint-enable @typescript-eslint/no-require-imports */
  executor = TaskManager.defineTask.mock.calls[0][1];
  await AsyncStorage.clear();
  // Matches the on state the Settings toggle would have persisted; tests for
  // the off/disabled case set this back to something else explicitly.
  await AsyncStorage.setItem('galleryImportEnabled', 'true');
});

describe('galleryImportTask', () => {
  it('defines the task under a stable name', () => {
    expect(GALLERY_IMPORT_TASK_NAME).toBe('gifticon-gallery-import');
    expect(TaskManager.defineTask).toHaveBeenCalledWith(
      'gifticon-gallery-import',
      expect.any(Function),
    );
  });

  it('scans with the signed-in uid and reports success', async () => {
    mockedWaitForAuthUser.mockResolvedValue({ uid: 'u1' });
    mockedScan.mockResolvedValue(2);

    await expect(executor({})).resolves.toBe(BackgroundTask.BackgroundTaskResult.Success);
    expect(mockedScan).toHaveBeenCalledWith('u1');
  });

  it('reports success without scanning when the feature is off', async () => {
    await AsyncStorage.clear();
    mockedWaitForAuthUser.mockResolvedValue({ uid: 'u1' });

    await expect(executor({})).resolves.toBe(BackgroundTask.BackgroundTaskResult.Success);
    expect(mockedScan).not.toHaveBeenCalled();
    expect(mockedWaitForAuthUser).not.toHaveBeenCalled();
  });

  it('reports failure without a signed-in user, and never scans', async () => {
    mockedWaitForAuthUser.mockResolvedValue(null);

    await expect(executor({})).resolves.toBe(BackgroundTask.BackgroundTaskResult.Failed);
    expect(mockedScan).not.toHaveBeenCalled();
  });

  it('reports failure when the scan throws', async () => {
    mockedWaitForAuthUser.mockResolvedValue({ uid: 'u1' });
    mockedScan.mockRejectedValue(new Error('boom'));

    await expect(executor({})).resolves.toBe(BackgroundTask.BackgroundTaskResult.Failed);
  });

  it('registerGalleryImportTask registers with a minimum interval', async () => {
    await registerGalleryImportTask();
    expect(BackgroundTask.registerTaskAsync).toHaveBeenCalledWith('gifticon-gallery-import', {
      minimumInterval: 15,
    });
  });

  it('unregisterGalleryImportTask unregisters the task', async () => {
    await unregisterGalleryImportTask();
    expect(BackgroundTask.unregisterTaskAsync).toHaveBeenCalledWith('gifticon-gallery-import');
  });
});
