import React from 'react';
import { act, fireEvent, render } from '@testing-library/react-native';
import Button from './Button';

describe('Button', () => {
  it('renders the label and fires onPress', async () => {
    const onPress = jest.fn();
    const { getByText } = await render(<Button label="저장" onPress={onPress} />);

    await act(async () => {
      fireEvent.press(getByText('저장'));
    });

    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('shows a spinner and blocks presses while loading', async () => {
    const onPress = jest.fn();
    const { queryByText, getByRole } = await render(
      <Button label="저장" onPress={onPress} loading />,
    );

    expect(queryByText('저장')).toBeNull();
    await act(async () => {
      fireEvent.press(getByRole('button'));
    });
    expect(onPress).not.toHaveBeenCalled();
  });

  it('does not fire onPress when disabled', async () => {
    const onPress = jest.fn();
    const { getByText } = await render(<Button label="저장" onPress={onPress} disabled />);

    await act(async () => {
      fireEvent.press(getByText('저장'));
    });

    expect(onPress).not.toHaveBeenCalled();
  });

  it('exposes an accessibilityLabel override and busy state', async () => {
    const { getByLabelText } = await render(
      <Button label="X" onPress={jest.fn()} accessibilityLabel="닫기" loading />,
    );
    const node = getByLabelText('닫기');
    expect(node.props.accessibilityState).toEqual(
      expect.objectContaining({ busy: true, disabled: true }),
    );
  });

  it('renders each variant', async () => {
    for (const variant of ['primary', 'secondary', 'ghostDanger'] as const) {
      const { getByText } = await render(
        <Button label={variant} variant={variant} onPress={jest.fn()} />,
      );
      expect(getByText(variant)).toBeTruthy();
    }
  });
});
