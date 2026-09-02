import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import BarcodeScannerModal from './BarcodeScannerModal';

jest.mock('expo-camera', () => ({ CameraView: () => null }));

describe('BarcodeScannerModal', () => {
  it('renders a close control that calls onClose', async () => {
    const onClose = jest.fn();
    const { getByText } = await render(
      <BarcodeScannerModal visible onScanned={jest.fn()} onClose={onClose} />,
    );

    fireEvent.press(getByText('닫기'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('does not render the scanner UI when closed', async () => {
    const { queryByText } = await render(
      <BarcodeScannerModal visible={false} onScanned={jest.fn()} onClose={jest.fn()} />,
    );
    expect(queryByText('닫기')).toBeNull();
  });
});
