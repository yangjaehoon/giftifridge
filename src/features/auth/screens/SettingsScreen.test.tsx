import React from 'react';
import { Alert } from 'react-native';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import SettingsScreen from './SettingsScreen';
import { useAuthActions, useCurrentUser } from '../context/AuthContext';
import { seedDummyGifticons } from '../../gifticons/services/devSeed';
import {
  getNotificationOffsets,
  setNotificationOffsets,
} from '../../../shared/utils/notificationPrefs';

jest.mock('../context/AuthContext', () => ({
  useCurrentUser: jest.fn(),
  useAuthActions: jest.fn(),
}));
jest.mock('../../gifticons/services/devSeed', () => ({ seedDummyGifticons: jest.fn() }));
jest.mock('../../../shared/utils/notificationPrefs', () => ({
  getNotificationOffsets: jest.fn(),
  setNotificationOffsets: jest.fn(),
}));
jest.mock('../errors', () => ({ getAuthErrorMessage: () => '로그인에 실패했어요.' }));
jest.mock('../components/GalleryAutoImportSettings', () => ({
  __esModule: true,
  default: () => null,
}));

const mockedUseCurrentUser = useCurrentUser as jest.Mock;
const mockedUseAuthActions = useAuthActions as jest.Mock;
const mockedSeed = seedDummyGifticons as jest.Mock;
const mockedGetOffsets = getNotificationOffsets as jest.Mock;
const mockedSetOffsets = setNotificationOffsets as jest.Mock;

const authFns = {
  signIn: jest.fn(),
  linkEmail: jest.fn(),
  signOut: jest.fn(),
};

function setAuth(overrides: { user?: unknown; isAnonymous?: boolean } = {}) {
  mockedUseCurrentUser.mockReturnValue({
    user: { uid: 'u1', email: null },
    isAnonymous: true,
    ...overrides,
  });
}

beforeEach(() => {
  jest.clearAllMocks();
  jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  mockedUseAuthActions.mockReturnValue(authFns);
  mockedGetOffsets.mockResolvedValue([7, 3]);
  mockedSetOffsets.mockResolvedValue(undefined);
  setAuth();
});

describe('SettingsScreen — anonymous user', () => {
  it('validates that both email and password are entered before submitting', async () => {
    const { getByText } = await render(<SettingsScreen />);

    await act(async () => {
      fireEvent.press(getByText('회원가입'));
    });

    expect(Alert.alert).toHaveBeenCalledWith('알림', '이메일과 비밀번호를 입력해주세요.');
    expect(authFns.linkEmail).not.toHaveBeenCalled();
  });

  it('links the email account on sign-up and confirms success', async () => {
    authFns.linkEmail.mockResolvedValue(undefined);
    const { getByText, getByPlaceholderText } = await render(<SettingsScreen />);

    await act(async () => {
      fireEvent.changeText(getByPlaceholderText('이메일'), '  me@example.com  ');
      fireEvent.changeText(getByPlaceholderText('비밀번호'), 'secret1');
    });
    await act(async () => {
      fireEvent.press(getByText('회원가입'));
    });

    expect(authFns.linkEmail).toHaveBeenCalledWith('me@example.com', 'secret1');
    await waitFor(() =>
      expect(Alert.alert).toHaveBeenCalledWith(
        '완료',
        '계정이 연결되었어요. 이제 다른 기기에서도 로그인할 수 있어요.',
      ),
    );
  });

  it('switches to sign-in mode and calls signIn', async () => {
    authFns.signIn.mockResolvedValue(undefined);
    const { getByText, getByPlaceholderText } = await render(<SettingsScreen />);

    await act(async () => {
      fireEvent.press(getByText('이미 계정이 있으신가요? 로그인'));
    });
    await act(async () => {
      fireEvent.changeText(getByPlaceholderText('이메일'), 'me@example.com');
      fireEvent.changeText(getByPlaceholderText('비밀번호'), 'secret1');
    });
    await act(async () => {
      fireEvent.press(getByText('로그인'));
    });

    expect(authFns.signIn).toHaveBeenCalledWith('me@example.com', 'secret1');
  });

  it('shows an auth error message when linking fails', async () => {
    authFns.linkEmail.mockRejectedValue(new Error('bad'));
    const { getByText, getByPlaceholderText } = await render(<SettingsScreen />);

    await act(async () => {
      fireEvent.changeText(getByPlaceholderText('이메일'), 'me@example.com');
      fireEvent.changeText(getByPlaceholderText('비밀번호'), 'secret1');
    });
    await act(async () => {
      fireEvent.press(getByText('회원가입'));
    });

    await waitFor(() => expect(Alert.alert).toHaveBeenCalledWith('오류', '로그인에 실패했어요.'));
  });
});

describe('SettingsScreen — signed-in user', () => {
  beforeEach(() => {
    setAuth({ isAnonymous: false, user: { uid: 'u1', email: 'me@example.com' } });
  });

  it('shows the signed-in email and signs out', async () => {
    authFns.signOut.mockResolvedValue(undefined);
    const { getByText } = await render(<SettingsScreen />);

    expect(getByText('me@example.com로 로그인되어 있어요.')).toBeTruthy();
    await act(async () => {
      fireEvent.press(getByText('로그아웃'));
    });
    expect(authFns.signOut).toHaveBeenCalledTimes(1);
  });

  it('alerts when sign-out fails', async () => {
    authFns.signOut.mockRejectedValue(new Error('offline'));
    const { getByText } = await render(<SettingsScreen />);

    await act(async () => {
      fireEvent.press(getByText('로그아웃'));
    });

    await waitFor(() =>
      expect(Alert.alert).toHaveBeenCalledWith('오류', '로그아웃에 실패했어요. 다시 시도해주세요.'),
    );
  });

  it('seeds dummy gifticons and reports the count', async () => {
    mockedSeed.mockResolvedValue({ succeeded: 100, failed: 0 });
    const { getByText } = await render(<SettingsScreen />);

    await act(async () => {
      fireEvent.press(getByText('더미 기프티콘 추가'));
    });

    expect(mockedSeed).toHaveBeenCalledWith('u1');
    await waitFor(() =>
      expect(Alert.alert).toHaveBeenCalledWith('완료', '더미 기프티콘 100개를 추가했어요.'),
    );
  });

  it('reports a partial failure when some seed writes fail', async () => {
    mockedSeed.mockResolvedValue({ succeeded: 97, failed: 3 });
    const { getByText } = await render(<SettingsScreen />);

    await act(async () => {
      fireEvent.press(getByText('더미 기프티콘 추가'));
    });

    await waitFor(() =>
      expect(Alert.alert).toHaveBeenCalledWith(
        '일부만 완료',
        '더미 기프티콘 97개를 추가했어요. 3개는 실패했어요.',
      ),
    );
  });
});

describe('SettingsScreen — notification offsets', () => {
  it('renders the saved offsets and persists a toggle', async () => {
    setAuth({ isAnonymous: false, user: { uid: 'u1', email: 'me@example.com' } });
    const { getByText } = await render(<SettingsScreen />);

    await waitFor(() => expect(getByText('7일 전')).toBeTruthy());

    await act(async () => {
      fireEvent.press(getByText('1일 전'));
    });

    expect(mockedSetOffsets).toHaveBeenCalledWith([7, 3, 1]);
  });

  it('rolls back and alerts when saving the offset fails', async () => {
    setAuth({ isAnonymous: false, user: { uid: 'u1', email: 'me@example.com' } });
    mockedSetOffsets.mockRejectedValue(new Error('disk full'));
    const { getByText } = await render(<SettingsScreen />);

    await waitFor(() => expect(getByText('당일')).toBeTruthy());
    await act(async () => {
      fireEvent.press(getByText('당일'));
    });

    await waitFor(() =>
      expect(Alert.alert).toHaveBeenCalledWith(
        '오류',
        '알림 설정을 저장하지 못했어요. 다시 시도해주세요.',
      ),
    );
  });
});
