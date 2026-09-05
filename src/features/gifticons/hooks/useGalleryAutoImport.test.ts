import { act, renderHook, waitFor } from '@testing-library/react-native';
import { Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as MediaLibrary from 'expo-media-library';
import { ensureGalleryImportPermission, scanGalleryForGifticons } from '../services/galleryImport';
import {
  registerGalleryImportTask,
  unregisterGalleryImportTask,
} from '../services/galleryImportTask';
import { useGalleryAutoImport } from './useGalleryAutoImport';

jest.mock('@react-native-async-storage/async-storage', () =>
  jest.requireActual('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);
jest.mock('expo-media-library', () => ({ addListener: jest.fn() }));
jest.mock('../services/galleryImport', () => ({
  ensureGalleryImportPermission: jest.fn(),
  scanGalleryForGifticons: jest.fn(),
}));
jest.mock('../services/galleryImportTask', () => ({
  registerGalleryImportTask: jest.fn(),
  unregisterGalleryImportTask: jest.fn(),
}));

const mockedAddListener = MediaLibrary.addListener as jest.Mock;
const mockedEnsurePermission = ensureGalleryImportPermission as jest.Mock;
const mockedScan = scanGalleryForGifticons as jest.Mock;
const mockedRegisterTask = registerGalleryImportTask as jest.Mock;
const mockedUnregisterTask = unregisterGalleryImportTask as jest.Mock;

beforeEach(async () => {
  await AsyncStorage.clear();
  jest.clearAllMocks();
  jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  mockedAddListener.mockReturnValue({ remove: jest.fn() });
  mockedEnsurePermission.mockResolvedValue(true);
  mockedScan.mockResolvedValue(0);
  mockedRegisterTask.mockResolvedValue(undefined);
  mockedUnregisterTask.mockResolvedValue(undefined);
});

describe('useGalleryAutoImport', () => {
  it('starts disabled when nothing was ever persisted', async () => {
    const { result } = await renderHook(() => useGalleryAutoImport('u1'));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.enabled).toBe(false);
  });

  it('restores a previously-enabled state on mount', async () => {
    await AsyncStorage.setItem('galleryImportEnabled', 'true');
    const { result } = await renderHook(() => useGalleryAutoImport('u1'));
    await waitFor(() => expect(result.current.enabled).toBe(true));
  });

  it('turning on requests permission, registers the task, and scans once immediately', async () => {
    const { result } = await renderHook(() => useGalleryAutoImport('u1'));
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => result.current.toggle());

    expect(mockedRegisterTask).toHaveBeenCalledTimes(1);
    expect(mockedScan).toHaveBeenCalledWith('u1');
    expect(result.current.enabled).toBe(true);
    expect(await AsyncStorage.getItem('galleryImportEnabled')).toBe('true');
  });

  it('alerts and stays off when permission is refused', async () => {
    mockedEnsurePermission.mockResolvedValue(false);
    const { result } = await renderHook(() => useGalleryAutoImport('u1'));
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => result.current.toggle());

    expect(Alert.alert).toHaveBeenCalledWith('알림', '사진 접근 권한이 필요해요.');
    expect(mockedRegisterTask).not.toHaveBeenCalled();
    expect(result.current.enabled).toBe(false);
  });

  it('turning off unregisters the background task', async () => {
    await AsyncStorage.setItem('galleryImportEnabled', 'true');
    const { result } = await renderHook(() => useGalleryAutoImport('u1'));
    await waitFor(() => expect(result.current.enabled).toBe(true));

    await act(async () => result.current.toggle());

    expect(mockedUnregisterTask).toHaveBeenCalledTimes(1);
    expect(result.current.enabled).toBe(false);
    expect(await AsyncStorage.getItem('galleryImportEnabled')).toBe('false');
  });

  it('scans on every library change while enabled', async () => {
    await AsyncStorage.setItem('galleryImportEnabled', 'true');
    const { result } = await renderHook(() => useGalleryAutoImport('u1'));
    await waitFor(() => expect(result.current.enabled).toBe(true));

    const listener = mockedAddListener.mock.calls[0][0];
    await act(async () => listener({}));

    expect(mockedScan).toHaveBeenCalledWith('u1');
  });

  it('does not subscribe to library changes while disabled', async () => {
    const { result } = await renderHook(() => useGalleryAutoImport('u1'));
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(mockedAddListener).not.toHaveBeenCalled();
  });
});
