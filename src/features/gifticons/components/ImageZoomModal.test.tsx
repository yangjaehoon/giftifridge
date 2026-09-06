import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import ImageZoomModal from './ImageZoomModal';

describe('ImageZoomModal', () => {
  it('does not render its content when closed', async () => {
    const { queryByLabelText } = await render(
      <ImageZoomModal visible={false} uri="https://example/x.jpg" onClose={jest.fn()} />,
    );
    expect(queryByLabelText('이미지 확대 화면 닫기')).toBeNull();
  });

  it('shows the image and closes on tap', async () => {
    const onClose = jest.fn();
    const { getByLabelText } = await render(
      <ImageZoomModal visible uri="https://example/x.jpg" onClose={onClose} />,
    );

    expect(getByLabelText('기프티콘 이미지 확대')).toBeTruthy();
    fireEvent.press(getByLabelText('이미지 확대 화면 닫기'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
