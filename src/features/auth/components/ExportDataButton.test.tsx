import React from 'react';
import { Alert } from 'react-native';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import ExportDataButton from './ExportDataButton';
import { useGifticons } from '../../gifticons/hooks/useGifticons';
import { exportGifticons } from '../../gifticons/services/gifticonExport';

jest.mock('../../gifticons/hooks/useGifticons', () => ({ useGifticons: jest.fn() }));
jest.mock('../../gifticons/services/gifticonExport', () => ({ exportGifticons: jest.fn() }));

const mockedUseGifticons = useGifticons as jest.Mock;
const mockedExport = exportGifticons as jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
  jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  mockedUseGifticons.mockReturnValue({ items: [{ id: 'a' }] });
  mockedExport.mockResolvedValue('shared');
});

describe('ExportDataButton', () => {
  it('exports the loaded gifticons on press', async () => {
    const { getByLabelText } = await render(<ExportDataButton uid="u1" />);

    await act(async () => fireEvent.press(getByLabelText('기프티콘 CSV로 내보내기')));

    await waitFor(() => expect(mockedExport).toHaveBeenCalledWith([{ id: 'a' }]));
    expect(Alert.alert).not.toHaveBeenCalled();
  });

  it('explains when there is nothing to export', async () => {
    mockedExport.mockResolvedValue('empty');
    const { getByLabelText } = await render(<ExportDataButton uid="u1" />);

    await act(async () => fireEvent.press(getByLabelText('기프티콘 CSV로 내보내기')));

    await waitFor(() =>
      expect(Alert.alert).toHaveBeenCalledWith(
        '내보낼 기프티콘이 없어요',
        expect.stringContaining('등록한 뒤'),
      ),
    );
  });

  it('alerts on failure', async () => {
    mockedExport.mockRejectedValue(new Error('share blew up'));
    const { getByLabelText } = await render(<ExportDataButton uid="u1" />);

    await act(async () => fireEvent.press(getByLabelText('기프티콘 CSV로 내보내기')));

    await waitFor(() =>
      expect(Alert.alert).toHaveBeenCalledWith('오류', expect.stringContaining('실패')),
    );
  });
});
