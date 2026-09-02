import React from 'react';
import { Alert } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import AddGifticonScreen from './AddGifticonScreen';
import { useCurrentUser } from '../../auth/context/AuthContext';
import { useGifticon } from '../hooks/useGifticon';
import { useGifticons } from '../hooks/useGifticons';
import { useSpaceGifticons } from '../hooks/useSpaceGifticons';
import {
  createGifticon,
  newGifticonId,
  setGifticonNotificationIds,
  updateGifticon,
} from '../services/gifticonService';
import { uploadGifticonImage } from '../services/gifticonImage';
import { cancelNotifications, scheduleExpiryNotifications } from '../services/notificationService';
import { recognizeExpiryDate } from '../services/ocrService';
import { getCurrentLocation } from '../../../shared/utils/location';
import { getNotificationOffsets } from '../../../shared/utils/notificationPrefs';
import { TimeoutError } from '../../../shared/utils/withTimeout';
import type { Gifticon } from '../types';

jest.mock('../../auth/context/AuthContext', () => ({ useCurrentUser: jest.fn() }));
jest.mock('../hooks/useGifticon', () => ({ useGifticon: jest.fn() }));
jest.mock('../hooks/useGifticons', () => ({ useGifticons: jest.fn() }));
jest.mock('../hooks/useSpaceGifticons', () => ({ useSpaceGifticons: jest.fn() }));
jest.mock('../services/gifticonService', () => ({
  createGifticon: jest.fn(),
  newGifticonId: jest.fn(() => 'draft-id'),
  setGifticonNotificationIds: jest.fn(),
  updateGifticon: jest.fn(),
}));
jest.mock('../services/gifticonImage', () => ({ uploadGifticonImage: jest.fn() }));
jest.mock('../services/notificationService', () => ({
  cancelNotifications: jest.fn(),
  scheduleExpiryNotifications: jest.fn(),
}));
jest.mock('../services/ocrService', () => ({ recognizeExpiryDate: jest.fn() }));
jest.mock('../../../shared/utils/location', () => ({ getCurrentLocation: jest.fn() }));
jest.mock('../../../shared/utils/notificationPrefs', () => ({ getNotificationOffsets: jest.fn() }));
jest.mock('expo-image-picker', () => ({
  launchImageLibraryAsync: jest.fn(),
  launchCameraAsync: jest.fn(),
}));
jest.mock('expo-camera', () => ({
  CameraView: () => null,
  useCameraPermissions: () => [{ granted: true }, jest.fn().mockResolvedValue({ granted: true })],
}));
jest.mock('@react-native-community/datetimepicker', () => () => null);

const mockedUseAuth = useCurrentUser as jest.Mock;
const mockedUseGifticon = useGifticon as jest.Mock;
const mockedUseGifticons = useGifticons as jest.Mock;
const mockedUseSpaceGifticons = useSpaceGifticons as jest.Mock;
const mockedCreate = createGifticon as jest.Mock;
const mockedUpdate = updateGifticon as jest.Mock;
const mockedUpload = uploadGifticonImage as jest.Mock;
const mockedSetNotifIds = setGifticonNotificationIds as jest.Mock;
const mockedCancelNotifs = cancelNotifications as jest.Mock;
const mockedSchedule = scheduleExpiryNotifications as jest.Mock;
const mockedRecognize = recognizeExpiryDate as jest.Mock;
const mockedGetLocation = getCurrentLocation as jest.Mock;
const mockedGetOffsets = getNotificationOffsets as jest.Mock;
const mockedLibrary = ImagePicker.launchImageLibraryAsync as jest.Mock;

function makeNavigation() {
  return { goBack: jest.fn(), navigate: jest.fn(), setOptions: jest.fn() };
}

async function renderScreen(
  params: Record<string, unknown> | undefined,
  navigation = makeNavigation(),
) {
  const utils = await render(
    <AddGifticonScreen
      navigation={navigation as never}
      route={{ key: 'k', name: 'AddGifticon', params } as never}
    />,
  );
  return { ...utils, navigation };
}

const existingGifticon: Gifticon = {
  id: 'g1',
  ownerId: 'u1',
  name: '기존아메리카노',
  brand: '기존스타벅스',
  category: 'cafe',
  imageUrl: 'https://storage.example/gifticons/g1.jpg',
  expiresAt: '2027-01-01',
  isUsed: false,
  createdAt: '2026-01-01T00:00:00.000Z',
  amount: 5000,
};

beforeEach(() => {
  jest.clearAllMocks();
  jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  mockedUseAuth.mockReturnValue({ user: { uid: 'u1' } });
  mockedUseGifticon.mockReturnValue({ gifticon: null, loading: false });
  mockedUseGifticons.mockReturnValue({ items: [] });
  mockedUseSpaceGifticons.mockReturnValue({ items: [] });
  (newGifticonId as jest.Mock).mockReturnValue('draft-id');
  mockedUpload.mockResolvedValue('https://storage.example/gifticons/draft-id.jpg');
  mockedCreate.mockResolvedValue('draft-id');
  mockedUpdate.mockResolvedValue(undefined);
  mockedSetNotifIds.mockResolvedValue(undefined);
  mockedCancelNotifs.mockResolvedValue(undefined);
  mockedSchedule.mockResolvedValue(['notif-1']);
  mockedRecognize.mockResolvedValue(null);
  mockedGetLocation.mockResolvedValue(null);
  mockedGetOffsets.mockResolvedValue([7, 3]);
});

type Screen = Awaited<ReturnType<typeof renderScreen>>;

async function pickImage(getByText: Screen['getByText']) {
  mockedLibrary.mockResolvedValue({ canceled: false, assets: [{ uri: 'file:///photo.jpg' }] });
  await act(async () => {
    fireEvent.press(getByText(/탭하여 사진 선택/));
  });
}

describe('AddGifticonScreen — create', () => {
  it('sets the header title for the create flow', async () => {
    const { navigation } = await renderScreen(undefined);
    await waitFor(() =>
      expect(navigation.setOptions).toHaveBeenCalledWith({ title: '기프티콘 등록' }),
    );
  });

  it('shows field errors and does not save when required fields are empty', async () => {
    const { getByText } = await renderScreen(undefined);

    await act(async () => {
      fireEvent.press(getByText('등록하기'));
    });

    expect(getByText('기프티콘 사진을 등록해주세요.')).toBeTruthy();
    expect(getByText('상품명을 입력해주세요.')).toBeTruthy();
    expect(getByText('브랜드를 입력해주세요.')).toBeTruthy();
    expect(mockedCreate).not.toHaveBeenCalled();
  });

  it('picks an image, runs OCR, and clears the image field error', async () => {
    mockedRecognize.mockResolvedValue('2026-12-31');
    const { getByText, queryByText } = await renderScreen(undefined);

    await pickImage(getByText);

    expect(mockedRecognize).toHaveBeenCalledWith('file:///photo.jpg');
    await waitFor(() =>
      expect(getByText('사진에서 유효기한을 자동으로 인식했어요. 확인해주세요.')).toBeTruthy(),
    );
    expect(queryByText('기프티콘 사진을 등록해주세요.')).toBeNull();
  });

  it('discards a stale OCR result when a newer image is picked before it resolves', async () => {
    const resolvers: ((v: string | null) => void)[] = [];
    mockedRecognize.mockImplementation(
      () => new Promise<string | null>((resolve) => resolvers.push(resolve)),
    );
    const { getByText, getByTestId, queryByText } = await renderScreen(undefined);

    // Pick image A (its OCR stays pending), then image B.
    mockedLibrary.mockResolvedValue({ canceled: false, assets: [{ uri: 'file:///a.jpg' }] });
    await act(async () => fireEvent.press(getByTestId('image-picker')));
    mockedLibrary.mockResolvedValue({ canceled: false, assets: [{ uri: 'file:///b.jpg' }] });
    await act(async () => fireEvent.press(getByTestId('image-picker')));

    // B's OCR resolves first with a date, then A's resolves late with a different one.
    await act(async () => resolvers[1]('2027-05-05'));
    await act(async () => resolvers[0]('2020-01-01'));

    expect(getByText('2027.05.05')).toBeTruthy();
    expect(queryByText('2020.01.01')).toBeNull();
  });

  it('uploads the image, creates the gifticon, schedules reminders, and goes back', async () => {
    const { getByText, getByPlaceholderText, navigation } = await renderScreen(undefined);

    await pickImage(getByText);
    await act(async () => {
      fireEvent.changeText(getByPlaceholderText('아메리카노 Tall'), '  아메리카노  ');
      fireEvent.changeText(getByPlaceholderText('스타벅스'), '스타벅스');
      fireEvent.changeText(getByPlaceholderText('10000'), '4500');
    });
    await act(async () => {
      fireEvent.press(getByText('등록하기'));
    });

    await waitFor(() => expect(mockedCreate).toHaveBeenCalled());
    expect(mockedUpload).toHaveBeenCalledWith('draft-id', 'file:///photo.jpg');
    const [draftId, uid, data] = mockedCreate.mock.calls[0];
    expect(draftId).toBe('draft-id');
    expect(uid).toBe('u1');
    expect(data).toMatchObject({
      name: '아메리카노',
      brand: '스타벅스',
      amount: 4500,
      expiresAt: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
    });
    expect(mockedSchedule).toHaveBeenCalled();
    expect(mockedSetNotifIds).toHaveBeenCalledWith('draft-id', ['notif-1']);
    await waitFor(() => expect(navigation.goBack).toHaveBeenCalled());
  });

  it('warns about a duplicate barcode and aborts when the user cancels', async () => {
    mockedUseGifticons.mockReturnValue({
      items: [{ id: 'other', brand: '스타벅스', name: '라떼', barcode: '123456' }],
    });
    const { getByText, getByPlaceholderText } = await renderScreen(undefined);

    await pickImage(getByText);
    await act(async () => {
      fireEvent.changeText(getByPlaceholderText('아메리카노 Tall'), '아메리카노');
      fireEvent.changeText(getByPlaceholderText('스타벅스'), '스타벅스');
      fireEvent.changeText(getByPlaceholderText('숫자 직접 입력 또는 스캔'), '123456');
    });
    await act(async () => {
      fireEvent.press(getByText('등록하기'));
      // confirmAsync's Alert is mocked; simulate the user picking "취소".
      const call = (Alert.alert as jest.Mock).mock.calls.find((c) => Array.isArray(c[2]));
      call[2].find((b: { text: string }) => b.text === '취소').onPress();
    });

    expect(mockedCreate).not.toHaveBeenCalled();
  });

  it('maps a save timeout to the timeout message', async () => {
    mockedCreate.mockRejectedValue(new TimeoutError('slow'));
    const { getByText, getByPlaceholderText } = await renderScreen(undefined);

    await pickImage(getByText);
    await act(async () => {
      fireEvent.changeText(getByPlaceholderText('아메리카노 Tall'), '아메리카노');
      fireEvent.changeText(getByPlaceholderText('스타벅스'), '스타벅스');
    });
    await act(async () => {
      fireEvent.press(getByText('등록하기'));
    });

    await waitFor(() =>
      expect(Alert.alert).toHaveBeenCalledWith(
        '오류',
        '응답이 늦어지고 있어요. 잠시 후 목록에서 확인해주세요.',
      ),
    );
  });

  it('saves the current location or alerts when permission is missing', async () => {
    mockedGetLocation.mockResolvedValue(null);
    const { getByText } = await renderScreen(undefined);

    await act(async () => {
      fireEvent.press(getByText('지금 여기를 매장 위치로 저장'));
    });

    expect(Alert.alert).toHaveBeenCalledWith('알림', '위치 접근 권한이 필요해요.');
  });

  it('stores coordinates when the location lookup succeeds', async () => {
    mockedGetLocation.mockResolvedValue({ latitude: 37.5, longitude: 127 });
    const { getByText } = await renderScreen(undefined);

    await act(async () => {
      fireEvent.press(getByText('지금 여기를 매장 위치로 저장'));
    });

    await waitFor(() => expect(getByText('현재 위치로 저장됨 ✓')).toBeTruthy());
  });
});

describe('AddGifticonScreen — edit', () => {
  it('shows the skeleton while the existing gifticon loads', async () => {
    mockedUseGifticon.mockReturnValue({ gifticon: null, loading: true });
    const { toJSON } = await renderScreen({ gifticonId: 'g1' });
    expect(toJSON()).toBeTruthy();
  });

  it('shows a not-found message when the gifticon does not exist', async () => {
    mockedUseGifticon.mockReturnValue({ gifticon: null, loading: false });
    const { getByText } = await renderScreen({ gifticonId: 'g1' });
    expect(getByText('기프티콘을 찾을 수 없어요.')).toBeTruthy();
  });

  it('hydrates the form from the existing gifticon and updates it on save', async () => {
    mockedUseGifticon.mockReturnValue({ gifticon: existingGifticon, loading: false });
    const { getByDisplayValue, getByText, navigation } = await renderScreen({ gifticonId: 'g1' });

    await waitFor(() => expect(getByDisplayValue('기존아메리카노')).toBeTruthy());
    expect(getByText('저장하기')).toBeTruthy();

    await act(async () => {
      fireEvent.press(getByText('저장하기'));
    });

    await waitFor(() => expect(mockedUpdate).toHaveBeenCalledWith('g1', expect.any(Object)));
    // The image wasn't changed, so it should not be re-encoded.
    expect(mockedUpload).not.toHaveBeenCalled();
    await waitFor(() => expect(navigation.goBack).toHaveBeenCalled());
  });
});
