import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import LinkAccountBanner from './LinkAccountBanner';

describe('LinkAccountBanner', () => {
  it('explains why to link and wires both actions', async () => {
    const onLink = jest.fn();
    const onDismiss = jest.fn();
    const { getByText, getByLabelText } = await render(
      <LinkAccountBanner onLink={onLink} onDismiss={onDismiss} />,
    );

    expect(getByText(/기기를 바꿔도/)).toBeTruthy();

    fireEvent.press(getByText('계정 연결'));
    expect(onLink).toHaveBeenCalledTimes(1);

    fireEvent.press(getByLabelText('나중에 하기'));
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });
});
