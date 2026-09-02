import React from 'react';
import { Alert } from 'react-native';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import JoinSpaceScreen from './JoinSpaceScreen';
import { useCurrentUser } from '../../auth/context/AuthContext';
import { getSpacePreview, joinSpace } from '../services/spaceService';
import { TimeoutError } from '../../../shared/utils/withTimeout';
import type { Space } from '../types';

jest.mock('../../auth/context/AuthContext', () => ({ useCurrentUser: jest.fn() }));
jest.mock('../services/spaceService', () => ({
  getSpacePreview: jest.fn(),
  joinSpace: jest.fn(),
}));

const mockedUseAuth = useCurrentUser as jest.Mock;
const mockedGetSpacePreview = getSpacePreview as jest.Mock;
const mockedJoinSpace = joinSpace as jest.Mock;

const space: Space = { id: 'space-1', name: '우리집', ownerId: 'owner', createdAt: 't' };

function makeNavigation() {
  return { replace: jest.fn(), navigate: jest.fn() };
}

async function renderScreen(params?: { spaceId?: string }, navigation = makeNavigation()) {
  const utils = await render(
    <JoinSpaceScreen
      navigation={navigation as never}
      route={{ key: 'k', name: 'JoinSpace', params } as never}
    />,
  );
  return { ...utils, navigation };
}

beforeEach(() => {
  jest.clearAllMocks();
  mockedUseAuth.mockReturnValue({ user: { uid: 'user-1' } });
  jest.spyOn(Alert, 'alert').mockImplementation(() => {});
});

describe('JoinSpaceScreen', () => {
  it('extracts the space id from a full invite link before looking it up', async () => {
    mockedGetSpacePreview.mockResolvedValue(space);
    const { getByText, getByPlaceholderText } = await renderScreen();

    await act(async () => {
      fireEvent.changeText(
        getByPlaceholderText('giftifridge://join/...'),
        'giftifridge://join/space-1?ref=x',
      );
    });
    await act(async () => {
      fireEvent.press(getByText('확인'));
    });

    expect(mockedGetSpacePreview).toHaveBeenCalledWith('space-1');
    await waitFor(() => expect(getByText('우리집')).toBeTruthy());
  });

  it('alerts when the code does not resolve to a space', async () => {
    mockedGetSpacePreview.mockResolvedValue(null);
    const { getByText, getByPlaceholderText } = await renderScreen();

    await act(async () => {
      fireEvent.changeText(getByPlaceholderText('giftifridge://join/...'), 'nope');
    });
    await act(async () => {
      fireEvent.press(getByText('확인'));
    });

    await waitFor(() =>
      expect(Alert.alert).toHaveBeenCalledWith('알림', '스페이스를 찾을 수 없어요.'),
    );
  });

  it('auto-looks up the space id passed via route params', async () => {
    mockedGetSpacePreview.mockResolvedValue(space);
    const { getByText } = await renderScreen({ spaceId: 'space-1' });

    await waitFor(() => expect(mockedGetSpacePreview).toHaveBeenCalledWith('space-1'));
    await waitFor(() => expect(getByText('우리집')).toBeTruthy());
  });

  it('joins the previewed space and navigates to its members screen', async () => {
    mockedGetSpacePreview.mockResolvedValue(space);
    mockedJoinSpace.mockResolvedValue(undefined);
    const { getByText, navigation } = await renderScreen({ spaceId: 'space-1' });

    await waitFor(() => expect(getByText('참여하기')).toBeTruthy());
    await act(async () => {
      fireEvent.press(getByText('참여하기'));
    });

    expect(mockedJoinSpace).toHaveBeenCalledWith('space-1', 'user-1');
    await waitFor(() =>
      expect(navigation.replace).toHaveBeenCalledWith('SpaceMembers', { spaceId: 'space-1' }),
    );
  });

  it('shows the timeout message when joining times out', async () => {
    mockedGetSpacePreview.mockResolvedValue(space);
    mockedJoinSpace.mockRejectedValue(new TimeoutError('timed out'));
    const { getByText } = await renderScreen({ spaceId: 'space-1' });

    await waitFor(() => expect(getByText('참여하기')).toBeTruthy());
    await act(async () => {
      fireEvent.press(getByText('참여하기'));
    });

    await waitFor(() =>
      expect(Alert.alert).toHaveBeenCalledWith(
        '오류',
        '응답이 늦어지고 있어요. 잠시 후 목록에서 확인해주세요.',
      ),
    );
  });
});
