import React from 'react';
import { Alert } from 'react-native';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import DevSeedButton from './DevSeedButton';
import { seedDummyGifticons } from '../../gifticons/services/devSeed';

jest.mock('../../gifticons/services/devSeed', () => ({ seedDummyGifticons: jest.fn() }));

const mockedSeed = seedDummyGifticons as jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
  jest.spyOn(Alert, 'alert').mockImplementation(() => {});
});

describe('DevSeedButton', () => {
  it('seeds the given uid and reports the total on success', async () => {
    mockedSeed.mockResolvedValue({ succeeded: 100, failed: 0 });
    const { getByText } = await render(<DevSeedButton uid="u1" />);

    await act(async () => {
      fireEvent.press(getByText('더미 기프티콘 추가'));
    });

    expect(mockedSeed).toHaveBeenCalledWith('u1');
    await waitFor(() =>
      expect(Alert.alert).toHaveBeenCalledWith('완료', '더미 기프티콘 100개를 추가했어요.'),
    );
  });

  it('reports a partial failure', async () => {
    mockedSeed.mockResolvedValue({ succeeded: 97, failed: 3 });
    const { getByText } = await render(<DevSeedButton uid="u1" />);

    await act(async () => {
      fireEvent.press(getByText('더미 기프티콘 추가'));
    });

    await waitFor(() =>
      expect(Alert.alert).toHaveBeenCalledWith(
        '일부만 완료',
        '더미 기프티콘 97개를 추가했어요. 3개는 실패했어요.',
      ),
    );
  });

  it('alerts when the seed call throws', async () => {
    mockedSeed.mockRejectedValue(new Error('offline'));
    const { getByText } = await render(<DevSeedButton uid="u1" />);

    await act(async () => {
      fireEvent.press(getByText('더미 기프티콘 추가'));
    });

    await waitFor(() =>
      expect(Alert.alert).toHaveBeenCalledWith('오류', '더미 데이터 추가에 실패했어요.'),
    );
  });

  it('renders nothing when not in a dev build', async () => {
    const devFlag = globalThis as unknown as { __DEV__: boolean };
    const original = devFlag.__DEV__;
    devFlag.__DEV__ = false;
    try {
      const { toJSON } = await render(<DevSeedButton uid="u1" />);
      expect(toJSON()).toBeNull();
    } finally {
      devFlag.__DEV__ = original;
    }
  });
});
