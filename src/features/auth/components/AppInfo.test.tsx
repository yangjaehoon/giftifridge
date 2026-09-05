import React from 'react';
import { Alert, Linking } from 'react-native';
import { act, fireEvent, render } from '@testing-library/react-native';
import AppInfo from './AppInfo';
import { PRIVACY_POLICY_URL } from '../../../shared/constants/links';

jest.mock('expo-constants', () => ({
  __esModule: true,
  default: { expoConfig: { version: '1.2.3' } },
}));

beforeEach(() => {
  jest.clearAllMocks();
  jest.spyOn(Alert, 'alert').mockImplementation(() => {});
});

describe('AppInfo', () => {
  it('shows the app version from the Expo config', async () => {
    const { getByText } = await render(<AppInfo />);
    expect(getByText('1.2.3')).toBeTruthy();
  });

  it('opens the privacy policy URL', async () => {
    jest.spyOn(Linking, 'openURL').mockResolvedValue(true);
    const { getByLabelText } = await render(<AppInfo />);

    await act(async () => {
      fireEvent.press(getByLabelText('개인정보처리방침 열기'));
    });

    expect(Linking.openURL).toHaveBeenCalledWith(PRIVACY_POLICY_URL);
  });

  it('alerts when the link fails to open', async () => {
    jest.spyOn(Linking, 'openURL').mockRejectedValue(new Error('no handler'));
    const { getByLabelText } = await render(<AppInfo />);

    await act(async () => {
      fireEvent.press(getByLabelText('개인정보처리방침 열기'));
    });

    expect(Alert.alert).toHaveBeenCalledWith('오류', '페이지를 열지 못했어요.');
  });
});
