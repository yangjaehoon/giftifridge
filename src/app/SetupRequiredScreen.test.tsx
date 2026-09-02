import React from 'react';
import { render } from '@testing-library/react-native';
import SetupRequiredScreen from './SetupRequiredScreen';

describe('SetupRequiredScreen', () => {
  it('explains that Firebase config is missing and lists the setup steps', async () => {
    const { getByText } = await render(<SetupRequiredScreen />);

    expect(getByText('Firebase 설정이 필요해요')).toBeTruthy();
    expect(getByText(/1\. https:\/\/console\.firebase\.google\.com/)).toBeTruthy();
    expect(getByText(/5\. \.env 파일에 값 입력 후 앱 재시작/)).toBeTruthy();
  });
});
