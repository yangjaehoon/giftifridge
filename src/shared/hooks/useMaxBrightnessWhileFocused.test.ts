import { act, renderHook, waitFor } from '@testing-library/react-native';
import * as Brightness from 'expo-brightness';
import { useMaxBrightnessWhileFocused } from './useMaxBrightnessWhileFocused';

jest.mock('expo-brightness', () => ({
  getBrightnessAsync: jest.fn(),
  setBrightnessAsync: jest.fn(),
}));

// Run useFocusEffect's callback like a plain effect (no navigator in the test).
jest.mock('@react-navigation/native', () => ({
  useFocusEffect: (cb: () => void | (() => void)) => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { useEffect } = require('react');
    useEffect(() => cb(), [cb]);
  },
}));

const mockedGet = Brightness.getBrightnessAsync as jest.Mock;
const mockedSet = Brightness.setBrightnessAsync as jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
  mockedGet.mockResolvedValue(0.4);
  mockedSet.mockResolvedValue(undefined);
});

describe('useMaxBrightnessWhileFocused', () => {
  it('ramps to full brightness on mount and restores the previous level on unmount', async () => {
    const { unmount } = await renderHook(() => useMaxBrightnessWhileFocused());

    await waitFor(() => expect(mockedSet).toHaveBeenCalledWith(1));

    await act(async () => {
      unmount();
    });
    expect(mockedSet).toHaveBeenLastCalledWith(0.4);
  });

  it('does nothing when disabled', async () => {
    await renderHook(() => useMaxBrightnessWhileFocused(false));
    expect(mockedGet).not.toHaveBeenCalled();
    expect(mockedSet).not.toHaveBeenCalled();
  });

  it('skips the restore when reading the current brightness fails', async () => {
    mockedGet.mockRejectedValue(new Error('unsupported'));
    const { unmount } = await renderHook(() => useMaxBrightnessWhileFocused());

    await act(async () => {
      unmount();
    });
    // only the (failed) read was attempted; no set(1), no restore
    expect(mockedSet).not.toHaveBeenCalled();
  });
});
