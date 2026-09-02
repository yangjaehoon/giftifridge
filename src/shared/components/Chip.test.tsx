import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import Chip from './Chip';

describe('Chip', () => {
  it('renders its label and calls onPress when tapped', async () => {
    const onPress = jest.fn();
    const { getByText } = await render(<Chip label="카페" active={false} onPress={onPress} />);

    fireEvent.press(getByText('카페'));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('exposes the label as the default accessibility label', async () => {
    const { getByLabelText } = await render(
      <Chip label="편의점" active={false} onPress={jest.fn()} />,
    );
    expect(getByLabelText('편의점')).toBeTruthy();
  });

  it('prefers an explicit accessibilityLabel over the visible label', async () => {
    const { getByLabelText, queryByLabelText } = await render(
      <Chip label="+" active={false} onPress={jest.fn()} accessibilityLabel="새 스페이스 만들기" />,
    );
    expect(getByLabelText('새 스페이스 만들기')).toBeTruthy();
    expect(queryByLabelText('+')).toBeNull();
  });
});
