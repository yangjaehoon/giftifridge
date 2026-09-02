import React from 'react';
import { Alert } from 'react-native';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import CreateSpaceScreen from './CreateSpaceScreen';
import { useAuth } from '../../auth/context/AuthContext';
import { createSpace } from '../services/spaceService';
import { TimeoutError } from '../../../shared/utils/withTimeout';

jest.mock('../../auth/context/AuthContext', () => ({ useAuth: jest.fn() }));
jest.mock('../services/spaceService', () => ({ createSpace: jest.fn() }));

const mockedUseAuth = useAuth as jest.Mock;
const mockedCreateSpace = createSpace as jest.Mock;

function makeNavigation() {
  return { replace: jest.fn(), navigate: jest.fn() };
}

async function renderScreen(navigation = makeNavigation()) {
  const utils = await render(
    <CreateSpaceScreen
      navigation={navigation as never}
      route={{ key: 'k', name: 'CreateSpace' } as never}
    />,
  );
  return { ...utils, navigation };
}

beforeEach(() => {
  jest.clearAllMocks();
  mockedUseAuth.mockReturnValue({ user: { uid: 'user-1' } });
  jest.spyOn(Alert, 'alert').mockImplementation(() => {});
});

describe('CreateSpaceScreen', () => {
  it('warns and does not create a space when the name is blank', async () => {
    const { getByText } = await renderScreen();

    fireEvent.press(getByText('만들기'));

    expect(Alert.alert).toHaveBeenCalledWith('알림', '스페이스 이름을 입력해주세요.');
    expect(mockedCreateSpace).not.toHaveBeenCalled();
  });

  it('creates the space with the trimmed name and navigates to its members screen', async () => {
    mockedCreateSpace.mockResolvedValue('space-9');
    const { getByText, getByPlaceholderText, navigation } = await renderScreen();

    await act(async () => {
      fireEvent.changeText(getByPlaceholderText('우리 가족'), '  우리집  ');
    });
    await act(async () => {
      fireEvent.press(getByText('만들기'));
    });

    expect(mockedCreateSpace).toHaveBeenCalledWith('user-1', '우리집');
    await waitFor(() =>
      expect(navigation.replace).toHaveBeenCalledWith('SpaceMembers', { spaceId: 'space-9' }),
    );
  });

  it('shows the create error message when the write fails', async () => {
    mockedCreateSpace.mockRejectedValue(new Error('boom'));
    const { getByText, getByPlaceholderText } = await renderScreen();

    await act(async () => {
      fireEvent.changeText(getByPlaceholderText('우리 가족'), '회사');
    });
    await act(async () => {
      fireEvent.press(getByText('만들기'));
    });

    await waitFor(() =>
      expect(Alert.alert).toHaveBeenCalledWith(
        '오류',
        '스페이스를 만들지 못했어요. 다시 시도해주세요.',
      ),
    );
  });

  it('shows the network message when the write times out', async () => {
    mockedCreateSpace.mockRejectedValue(new TimeoutError('timed out'));
    const { getByText, getByPlaceholderText } = await renderScreen();

    await act(async () => {
      fireEvent.changeText(getByPlaceholderText('우리 가족'), '회사');
    });
    await act(async () => {
      fireEvent.press(getByText('만들기'));
    });

    await waitFor(() =>
      expect(Alert.alert).toHaveBeenCalledWith(
        '오류',
        '네트워크 연결을 확인해주세요. 오프라인 상태일 수 있어요.',
      ),
    );
  });

  it('navigates to JoinSpace from the invite-code link', async () => {
    const { getByText, navigation } = await renderScreen();

    await act(async () => {
      fireEvent.press(getByText('이미 초대받았나요? 코드로 참여하기'));
    });

    expect(navigation.navigate).toHaveBeenCalledWith('JoinSpace');
  });
});
