import { Alert, Linking } from 'react-native';
import { alertPermissionDenied } from './permissionAlert';

beforeEach(() => {
  jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  jest.spyOn(Linking, 'openSettings').mockResolvedValue(undefined);
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('alertPermissionDenied', () => {
  it('shows the given title/message with a cancel and a settings button', () => {
    alertPermissionDenied('알림', '위치 접근 권한이 필요해요.');

    expect(Alert.alert).toHaveBeenCalledWith(
      '알림',
      '위치 접근 권한이 필요해요.',
      expect.arrayContaining([
        expect.objectContaining({ text: '취소', style: 'cancel' }),
        expect.objectContaining({ text: '설정으로 이동' }),
      ]),
    );
  });

  it('opens the app settings page when "설정으로 이동" is pressed', () => {
    alertPermissionDenied('알림', '위치 접근 권한이 필요해요.');

    const buttons = (Alert.alert as jest.Mock).mock.calls[0][2];
    const settingsButton = buttons.find((b: { text: string }) => b.text === '설정으로 이동');
    settingsButton.onPress();

    expect(Linking.openSettings).toHaveBeenCalledTimes(1);
  });
});
