import * as Haptics from 'expo-haptics';
import { haptics } from './haptics';

jest.mock('expo-haptics', () => ({
  notificationAsync: jest.fn(() => Promise.resolve()),
  impactAsync: jest.fn(() => Promise.resolve()),
  selectionAsync: jest.fn(() => Promise.resolve()),
  NotificationFeedbackType: { Success: 'success', Warning: 'warning' },
  ImpactFeedbackStyle: { Light: 'light' },
}));

const mockedNotify = Haptics.notificationAsync as jest.Mock;
const mockedImpact = Haptics.impactAsync as jest.Mock;
const mockedSelection = Haptics.selectionAsync as jest.Mock;

beforeEach(() => jest.clearAllMocks());

describe('haptics', () => {
  it('maps each intent to the right expo-haptics call', () => {
    haptics.success();
    expect(mockedNotify).toHaveBeenCalledWith('success');

    haptics.warning();
    expect(mockedNotify).toHaveBeenCalledWith('warning');

    haptics.light();
    expect(mockedImpact).toHaveBeenCalledWith('light');

    haptics.selection();
    expect(mockedSelection).toHaveBeenCalled();
  });

  it('swallows a rejected haptic call', async () => {
    mockedNotify.mockRejectedValueOnce(new Error('no engine'));
    expect(() => haptics.success()).not.toThrow();
    await Promise.resolve();
  });

  it('swallows a synchronous throw from the module', () => {
    mockedImpact.mockImplementationOnce(() => {
      throw new Error('unavailable');
    });
    expect(() => haptics.light()).not.toThrow();
  });
});
