import AsyncStorage from '@react-native-async-storage/async-storage';
import { getNotificationOffsets, setNotificationOffsets } from './notificationPrefs';

jest.mock('@react-native-async-storage/async-storage', () =>
  jest.requireActual('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

describe('notificationPrefs', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
  });

  it('returns the default offset [3] when nothing has been saved', async () => {
    expect(await getNotificationOffsets()).toEqual([3]);
  });

  it('returns previously saved offsets', async () => {
    await setNotificationOffsets([7, 1, 0]);
    expect(await getNotificationOffsets()).toEqual([7, 1, 0]);
  });

  it('falls back to the default when the stored value is not a number array', async () => {
    await AsyncStorage.setItem('notificationOffsets', JSON.stringify('not-an-array'));
    expect(await getNotificationOffsets()).toEqual([3]);
  });

  it('falls back to the default on invalid JSON', async () => {
    await AsyncStorage.setItem('notificationOffsets', '{not valid json');
    expect(await getNotificationOffsets()).toEqual([3]);
  });
});
