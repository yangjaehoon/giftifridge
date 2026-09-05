import React from 'react';
import { Alert } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import GifticonDetailScreen from './GifticonDetailScreen';
import { useCurrentUser } from '../../auth/context/AuthContext';
import { useGifticon } from '../hooks/useGifticon';
import {
  deleteGifticonUsageRecord,
  recordGifticonUsage,
  removeGifticon,
  setGifticonUsed,
} from '../services/gifticonLifecycle';
import { TimeoutError } from '../../../shared/utils/withTimeout';
import type { Gifticon } from '../types';

jest.mock('../../auth/context/AuthContext', () => ({ useCurrentUser: jest.fn() }));
jest.mock('../hooks/useGifticon', () => ({ useGifticon: jest.fn() }));
jest.mock('../services/gifticonLifecycle', () => ({
  removeGifticon: jest.fn(),
  setGifticonUsed: jest.fn(),
  recordGifticonUsage: jest.fn(),
  deleteGifticonUsageRecord: jest.fn(),
}));
jest.mock('expo-clipboard', () => ({ setStringAsync: jest.fn() }));
jest.mock('../components/GifticonBarcode', () => ({ __esModule: true, default: () => null }));
jest.mock('../../../shared/hooks/useMaxBrightnessWhileFocused', () => ({
  useMaxBrightnessWhileFocused: jest.fn(),
}));

const mockedUseGifticon = useGifticon as jest.Mock;
const mockedSetUsed = setGifticonUsed as jest.Mock;
const mockedRemove = removeGifticon as jest.Mock;
const mockedRecordUsage = recordGifticonUsage as jest.Mock;
const mockedDeleteUsageRecord = deleteGifticonUsageRecord as jest.Mock;
const mockedClipboard = Clipboard.setStringAsync as jest.Mock;
const mockedUseAuth = useCurrentUser as jest.Mock;

function daysFromNow(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString();
}

function makeGifticon(overrides: Partial<Gifticon> = {}): Gifticon {
  return {
    id: 'g1',
    ownerId: 'owner',
    name: '아메리카노',
    brand: '스타벅스',
    category: 'cafe',
    imageUrl: 'https://example.com/x.jpg',
    expiresAt: daysFromNow(10),
    isUsed: false,
    createdAt: daysFromNow(-5),
    ...overrides,
  };
}

function setHook(overrides: Partial<ReturnType<typeof useGifticon>> = {}) {
  mockedUseGifticon.mockReturnValue({
    gifticon: makeGifticon(),
    loading: false,
    error: null,
    refresh: jest.fn(),
    ...overrides,
  });
}

function makeNavigation() {
  return { goBack: jest.fn(), navigate: jest.fn(), setOptions: jest.fn() };
}

async function renderScreen(navigation = makeNavigation()) {
  const utils = await render(
    <GifticonDetailScreen
      navigation={navigation as never}
      route={{ key: 'k', name: 'GifticonDetail', params: { gifticonId: 'g1' } } as never}
    />,
  );
  return { ...utils, navigation };
}

function pressAlertAction(label: string) {
  const call = (Alert.alert as jest.Mock).mock.calls.find((c) => Array.isArray(c[2]));
  return call[2].find((b: { text: string }) => b.text === label).onPress();
}

beforeEach(() => {
  jest.clearAllMocks();
  jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  // makeGifticon defaults ownerId to 'owner', so the viewer owns it by default.
  mockedUseAuth.mockReturnValue({ user: { uid: 'owner' } });
  mockedSetUsed.mockResolvedValue(undefined);
  mockedRemove.mockResolvedValue(undefined);
  mockedRecordUsage.mockResolvedValue(undefined);
  mockedDeleteUsageRecord.mockResolvedValue(undefined);
  mockedClipboard.mockResolvedValue(undefined);
  setHook();
});

describe('GifticonDetailScreen', () => {
  it('renders the skeleton while loading', async () => {
    setHook({ loading: true, gifticon: null });
    const { toJSON } = await renderScreen();
    expect(toJSON()).toBeTruthy();
  });

  it('renders an error state whose retry button calls refresh', async () => {
    const refresh = jest.fn();
    setHook({ error: new Error('boom'), gifticon: null, refresh });
    const { getByText } = await renderScreen();

    await act(async () => {
      fireEvent.press(getByText('다시 시도'));
    });
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it('renders a not-found state when the gifticon is missing', async () => {
    setHook({ gifticon: null });
    const { getByText } = await renderScreen();
    expect(getByText('기프티콘을 찾을 수 없어요.')).toBeTruthy();
  });

  it('shows the gifticon details and D-day', async () => {
    const { getByText } = await renderScreen();
    expect(getByText('스타벅스 · 카페')).toBeTruthy();
    expect(getByText('아메리카노')).toBeTruthy();
    expect(getByText(/D-10/)).toBeTruthy();
  });

  it('marks the gifticon used with the acting uid and stays on the screen', async () => {
    setHook({ gifticon: makeGifticon({ notificationIds: ['n1'] }) });
    const { getByText, navigation } = await renderScreen();

    await act(async () => {
      fireEvent.press(getByText('사용완료로 표시'));
    });

    expect(mockedSetUsed).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'g1', notificationIds: ['n1'] }),
      true,
      'owner',
    );
    expect(navigation.goBack).not.toHaveBeenCalled();
  });

  it('reverts a used gifticon by marking it unused', async () => {
    setHook({ gifticon: makeGifticon({ isUsed: true, notificationIds: ['n1'] }) });
    const { getByText } = await renderScreen();

    await act(async () => {
      fireEvent.press(getByText('사용가능으로 되돌리기'));
    });

    expect(mockedSetUsed).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'g1' }),
      false,
      'owner',
    );
  });

  it('passes the viewer uid through so the service can apply the owner-only rule', async () => {
    mockedUseAuth.mockReturnValue({ user: { uid: 'someone-else' } });
    setHook({ gifticon: makeGifticon({ ownerId: 'owner', notificationIds: ['n1'] }) });
    const { getByText } = await renderScreen();

    await act(async () => {
      fireEvent.press(getByText('사용완료로 표시'));
    });

    expect(mockedSetUsed).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'g1' }),
      true,
      'someone-else',
    );
  });

  it('maps a timeout on mark-used to the timeout message', async () => {
    mockedSetUsed.mockRejectedValue(new TimeoutError('slow'));
    const { getByText } = await renderScreen();

    await act(async () => {
      fireEvent.press(getByText('사용완료로 표시'));
    });

    await waitFor(() =>
      expect(Alert.alert).toHaveBeenCalledWith(
        '오류',
        '응답이 늦어지고 있어요. 잠시 후 목록에서 확인해주세요.',
      ),
    );
  });

  it('deletes the gifticon after confirmation and goes back', async () => {
    setHook({ gifticon: makeGifticon({ notificationIds: ['n1', 'n2'] }) });
    const { getByText, navigation } = await renderScreen();

    await act(async () => {
      fireEvent.press(getByText('삭제하기'));
    });
    await act(async () => {
      await pressAlertAction('삭제');
    });

    expect(mockedRemove).toHaveBeenCalledWith(expect.objectContaining({ id: 'g1' }));
    await waitFor(() => expect(navigation.goBack).toHaveBeenCalled());
  });

  it('copies the barcode to the clipboard', async () => {
    setHook({ gifticon: makeGifticon({ barcode: '8801234567' }) });
    const { getByLabelText } = await renderScreen();

    await act(async () => {
      fireEvent.press(getByLabelText('바코드 번호 복사'));
    });

    expect(mockedClipboard).toHaveBeenCalledWith('8801234567');
  });

  it('registers a header edit action that navigates to the edit screen', async () => {
    const { navigation } = await renderScreen();

    await waitFor(() => expect(navigation.setOptions).toHaveBeenCalled());
    const { headerRight } = navigation.setOptions.mock.calls.at(-1)[0];
    const { getByLabelText } = await render(headerRight());
    fireEvent.press(getByLabelText('기프티콘 수정'));

    expect(navigation.navigate).toHaveBeenCalledWith('AddGifticon', { gifticonId: 'g1' });
  });

  describe('amount-based usage panel', () => {
    it('shows the usage panel and records a partial spend as the acting uid', async () => {
      const gifticon = makeGifticon({ amount: 10000 });
      setHook({ gifticon });
      const { getByText, getByPlaceholderText } = await renderScreen();

      expect(getByText('10,000원 사용 가능')).toBeTruthy();

      await act(async () => {
        fireEvent.press(getByText('사용 금액 입력'));
      });
      await act(async () => {
        fireEvent.changeText(getByPlaceholderText('사용한 금액'), '3000');
      });
      await act(async () => {
        fireEvent.press(getByText('등록'));
      });

      expect(mockedRecordUsage).toHaveBeenCalledWith(gifticon, 3000, 'owner');
    });

    it('does not show the usage panel for an item voucher with no amount', async () => {
      setHook({ gifticon: makeGifticon() });
      const { queryByText } = await renderScreen();

      expect(queryByText('사용 내역')).toBeNull();
    });
  });
});
