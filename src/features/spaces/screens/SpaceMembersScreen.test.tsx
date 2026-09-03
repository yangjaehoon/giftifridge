import React from 'react';
import { Alert, Share } from 'react-native';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import SpaceMembersScreen from './SpaceMembersScreen';
import { useCurrentUser } from '../../auth/context/AuthContext';
import { useSpace } from '../hooks/useSpace';
import { deleteSpace, leaveSpace } from '../services/spaceService';
import type { Space, SpaceMember } from '../types';

jest.mock('../../auth/context/AuthContext', () => ({ useCurrentUser: jest.fn() }));
jest.mock('../hooks/useSpace', () => ({ useSpace: jest.fn() }));
jest.mock('../services/spaceService', () => ({
  deleteSpace: jest.fn(),
  leaveSpace: jest.fn(),
}));

const mockedUseAuth = useCurrentUser as jest.Mock;
const mockedUseSpace = useSpace as jest.Mock;
const mockedDeleteSpace = deleteSpace as jest.Mock;
const mockedLeaveSpace = leaveSpace as jest.Mock;

const space: Space = { id: 'space-1', name: '우리집', ownerId: 'owner-1', createdAt: 't' };
const members: SpaceMember[] = [
  { uid: 'owner-1', role: 'owner', joinedAt: '2026-01-05T00:00:00.000Z' },
  { uid: 'user-2', role: 'member', joinedAt: '2026-01-06T00:00:00.000Z' },
];

function makeNavigation() {
  return { navigate: jest.fn(), replace: jest.fn() };
}

function setSpaceState(overrides: Partial<ReturnType<typeof useSpace>> = {}) {
  mockedUseSpace.mockReturnValue({
    space,
    members,
    loading: false,
    error: null,
    refresh: jest.fn(),
    ...overrides,
  });
}

async function renderScreen(navigation = makeNavigation()) {
  const utils = await render(
    <SpaceMembersScreen
      navigation={navigation as never}
      route={{ key: 'k', name: 'SpaceMembers', params: { spaceId: 'space-1' } } as never}
    />,
  );
  return { ...utils, navigation };
}

// Runs the destructive-action button from an Alert.alert(...) call.
function pressAlertAction(label: string) {
  const calls = (Alert.alert as jest.Mock).mock.calls;
  const withButtons = calls.find((c) => Array.isArray(c[2]));
  const button = withButtons?.[2].find((b: { text: string }) => b.text === label);
  return button.onPress();
}

beforeEach(() => {
  jest.clearAllMocks();
  mockedUseAuth.mockReturnValue({ user: { uid: 'owner-1' } });
  jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  jest.spyOn(Share, 'share').mockResolvedValue({ action: 'sharedAction' } as never);
  setSpaceState();
});

describe('SpaceMembersScreen', () => {
  it('shows the loading skeleton while the space is loading', async () => {
    setSpaceState({ loading: true });
    const { toJSON } = await renderScreen();
    expect(toJSON()).toBeTruthy();
  });

  it('shows an error state with a working retry button', async () => {
    const refresh = jest.fn();
    setSpaceState({ error: new Error('boom'), refresh });
    const { getByText } = await renderScreen();

    fireEvent.press(getByText('다시 시도'));
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it('lists members with role, join date, and a marker for the current user', async () => {
    const { getByText, getAllByText } = await renderScreen();
    expect(getByText('소유자')).toBeTruthy();
    expect(getByText('멤버')).toBeTruthy();
    expect(getByText('나')).toBeTruthy();
    expect(getByText('멤버 2명')).toBeTruthy();
    expect(getAllByText(/참여$/)).toHaveLength(2);
  });

  it('offers "스페이스 삭제" to the owner and deletes with the member uid list', async () => {
    mockedDeleteSpace.mockResolvedValue(undefined);
    const { getByText, navigation } = await renderScreen();

    await act(async () => {
      fireEvent.press(getByText('스페이스 삭제'));
    });
    await act(async () => {
      await pressAlertAction('삭제');
    });

    expect(mockedDeleteSpace).toHaveBeenCalledWith('space-1', ['owner-1', 'user-2']);
    await waitFor(() => expect(navigation.navigate).toHaveBeenCalledWith('Home'));
  });

  it('offers "나가기" to a non-owner and leaves the space', async () => {
    mockedUseAuth.mockReturnValue({ user: { uid: 'user-2' } });
    mockedLeaveSpace.mockResolvedValue(undefined);
    const { getByText, navigation } = await renderScreen();

    await act(async () => {
      fireEvent.press(getByText('나가기'));
    });
    await act(async () => {
      await pressAlertAction('나가기');
    });

    expect(mockedLeaveSpace).toHaveBeenCalledWith('space-1', 'user-2');
    await waitFor(() => expect(navigation.navigate).toHaveBeenCalledWith('Home'));
  });

  it('surfaces the delete error message when the write fails', async () => {
    mockedDeleteSpace.mockRejectedValue(new Error('nope'));
    const { getByText } = await renderScreen();

    await act(async () => {
      fireEvent.press(getByText('스페이스 삭제'));
    });
    await act(async () => {
      await pressAlertAction('삭제');
    });

    await waitFor(() =>
      expect(Alert.alert).toHaveBeenCalledWith('오류', '스페이스를 삭제하지 못했어요.'),
    );
  });

  it('shares an invite message containing the space code', async () => {
    const { getByText } = await renderScreen();

    await act(async () => {
      fireEvent.press(getByText('초대 링크 공유'));
    });

    expect(Share.share).toHaveBeenCalledWith(
      expect.objectContaining({ message: expect.stringContaining('space-1') }),
    );
  });
});
