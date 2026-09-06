import { Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { renderHook, waitFor } from '@testing-library/react-native';
import { useFirstRunNotice } from './useFirstRunNotice';

jest.mock('@react-native-async-storage/async-storage', () =>
  jest.requireActual('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);
jest.mock('../lib/firebase/config', () => ({ isFirebaseConfigured: true }));

beforeEach(async () => {
  await AsyncStorage.clear();
  jest.spyOn(Alert, 'alert').mockImplementation(() => {});
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('useFirstRunNotice', () => {
  it('shows the 180-day notice once and records that it was shown', async () => {
    renderHook(() => useFirstRunNotice());

    await waitFor(() => expect(Alert.alert).toHaveBeenCalledTimes(1));
    const [title, body] = (Alert.alert as jest.Mock).mock.calls[0];
    expect(title).toBe('안내');
    expect(body).toMatch(/180일/);
    await waitFor(async () => expect(await AsyncStorage.getItem('firstRunNoticeShown')).toBe('1'));
  });

  it('does not show again once the flag is set', async () => {
    await AsyncStorage.setItem('firstRunNoticeShown', '1');

    renderHook(() => useFirstRunNotice());

    await new Promise((r) => setTimeout(r, 0));
    expect(Alert.alert).not.toHaveBeenCalled();
  });
});
