import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import BarcodeZoomModal from './BarcodeZoomModal';

jest.mock('@kichiyaki/react-native-barcode-generator', () => ({
  __esModule: true,
  default: () => null,
}));

describe('BarcodeZoomModal', () => {
  it('does not render when closed', async () => {
    const { queryByText } = await render(
      <BarcodeZoomModal visible={false} value="8801234567890" onClose={jest.fn()} />,
    );
    expect(queryByText('화면을 탭하면 닫혀요')).toBeNull();
  });

  it('shows the formatted barcode number and closes on tap', async () => {
    const onClose = jest.fn();
    const { getByText, getByLabelText } = await render(
      <BarcodeZoomModal visible value="8801234567890" onClose={onClose} />,
    );

    expect(getByText('8801 2345 6789 0')).toBeTruthy();
    fireEvent.press(getByLabelText('바코드 확대 화면 닫기'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
