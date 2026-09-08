import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import { handleGeofenceEnter, readGeofenceLabels, saveGeofenceLabels } from './geofenceTask';

jest.mock('expo-task-manager', () => ({ defineTask: jest.fn() }));
jest.mock('expo-location', () => ({ GeofencingEventType: { Enter: 1, Exit: 2 } }));
jest.mock('expo-notifications', () => ({ scheduleNotificationAsync: jest.fn() }));

const mockedSchedule = Notifications.scheduleNotificationAsync as jest.Mock;

beforeEach(async () => {
  jest.clearAllMocks();
  await AsyncStorage.clear();
});

describe('geofence label store', () => {
  it('round-trips the id → {brand,name} map', async () => {
    await saveGeofenceLabels({ g1: { brand: '스타벅스', name: '아메리카노' } });
    expect(await readGeofenceLabels()).toEqual({ g1: { brand: '스타벅스', name: '아메리카노' } });
  });

  it('reads back an empty map when nothing is stored or the value is corrupt', async () => {
    expect(await readGeofenceLabels()).toEqual({});
    await AsyncStorage.setItem('geofenceLabels', '{not json');
    expect(await readGeofenceLabels()).toEqual({});
  });
});

describe('handleGeofenceEnter', () => {
  it('fires a notification naming the gifticon for a known region', async () => {
    await saveGeofenceLabels({ g1: { brand: '스타벅스', name: '아메리카노' } });

    await handleGeofenceEnter('g1');

    expect(mockedSchedule).toHaveBeenCalledTimes(1);
    const [{ content }] = mockedSchedule.mock.calls[0];
    expect(content.body).toContain('스타벅스 아메리카노');
    expect(content.data).toEqual({ gifticonId: 'g1' });
  });

  it('does nothing for a region id it has no label for', async () => {
    await handleGeofenceEnter('unknown');
    expect(mockedSchedule).not.toHaveBeenCalled();
  });
});
