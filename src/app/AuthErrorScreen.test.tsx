import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import AuthErrorScreen from './AuthErrorScreen';

describe('AuthErrorScreen', () => {
  it('shows the given message and fires onRetry when the button is pressed', async () => {
    const onRetry = jest.fn();
    const { getByText } = await render(
      <AuthErrorScreen message="로그인 정보를 확인하지 못했어요." onRetry={onRetry} />,
    );

    expect(getByText('로그인 정보를 확인하지 못했어요.')).toBeTruthy();
    fireEvent.press(getByText('다시 시도'));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });
});
