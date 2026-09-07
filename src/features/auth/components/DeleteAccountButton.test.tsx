import React from 'react';
import { Alert } from 'react-native';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import DeleteAccountButton from './DeleteAccountButton';
import { deleteAccount } from '../services/accountDeletion';
import { confirmAsync } from '../../../shared/utils/confirmAsync';

jest.mock('../services/accountDeletion', () => ({ deleteAccount: jest.fn() }));
jest.mock('../../../shared/utils/confirmAsync', () => ({ confirmAsync: jest.fn() }));

const mockedDelete = deleteAccount as jest.Mock;
const mockedConfirm = confirmAsync as jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
  jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  mockedConfirm.mockResolvedValue(true);
  mockedDelete.mockResolvedValue(undefined);
});

describe('DeleteAccountButton', () => {
  it('confirms, deletes the account, and reports success', async () => {
    const { getByText } = await render(<DeleteAccountButton />);

    await act(async () => {
      fireEvent.press(getByText('계정 삭제'));
    });

    expect(mockedConfirm).toHaveBeenCalledWith(
      '계정을 삭제할까요?',
      expect.stringContaining('되돌릴 수 없어요'),
      '삭제',
    );
    expect(mockedDelete).toHaveBeenCalledTimes(1);
    await waitFor(() =>
      expect(Alert.alert).toHaveBeenCalledWith('완료', '계정과 데이터가 삭제되었어요.'),
    );
  });

  it('does nothing when the confirmation is dismissed', async () => {
    mockedConfirm.mockResolvedValue(false);
    const { getByText } = await render(<DeleteAccountButton />);

    await act(async () => {
      fireEvent.press(getByText('계정 삭제'));
    });

    expect(mockedDelete).not.toHaveBeenCalled();
    expect(Alert.alert).not.toHaveBeenCalled();
  });

  it('alerts when the deletion fails', async () => {
    mockedDelete.mockRejectedValue(new Error('internal'));
    const { getByText } = await render(<DeleteAccountButton />);

    await act(async () => {
      fireEvent.press(getByText('계정 삭제'));
    });

    await waitFor(() =>
      expect(Alert.alert).toHaveBeenCalledWith(
        '오류',
        '계정 삭제에 실패했어요. 잠시 후 다시 시도해주세요.',
      ),
    );
  });
});
