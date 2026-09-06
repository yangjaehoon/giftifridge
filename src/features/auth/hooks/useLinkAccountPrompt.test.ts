import AsyncStorage from '@react-native-async-storage/async-storage';
import { act, renderHook, waitFor } from '@testing-library/react-native';
import { useLinkAccountPrompt } from './useLinkAccountPrompt';

jest.mock('@react-native-async-storage/async-storage', () =>
  jest.requireActual('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

beforeEach(async () => {
  await AsyncStorage.clear();
});

describe('useLinkAccountPrompt', () => {
  it('shows once an anonymous user has a few gifticons', async () => {
    const { result } = await renderHook(() => useLinkAccountPrompt(true, 3));
    await waitFor(() => expect(result.current.show).toBe(true));
  });

  it('stays hidden below the gifticon threshold', async () => {
    const { result } = await renderHook(() => useLinkAccountPrompt(true, 2));
    await act(async () => {}); // let the dismissed-flag load
    expect(result.current.show).toBe(false);
  });

  it('stays hidden for a linked (non-anonymous) account', async () => {
    const { result } = await renderHook(() => useLinkAccountPrompt(false, 10));
    await act(async () => {});
    expect(result.current.show).toBe(false);
  });

  it('stays hidden until the dismissed flag has loaded, then shows', async () => {
    let resolveGet: (v: string | null) => void = () => {};
    jest.spyOn(AsyncStorage, 'getItem').mockReturnValueOnce(new Promise((r) => (resolveGet = r)));

    const { result } = await renderHook(() => useLinkAccountPrompt(true, 5));
    expect(result.current.show).toBe(false); // flag not loaded yet

    await act(async () => {
      resolveGet(null);
    });
    expect(result.current.show).toBe(true);
  });

  it('dismiss() hides it and persists across mounts', async () => {
    const first = await renderHook(() => useLinkAccountPrompt(true, 5));
    await waitFor(() => expect(first.result.current.show).toBe(true));

    await act(async () => {
      first.result.current.dismiss();
    });
    expect(first.result.current.show).toBe(false);

    const second = await renderHook(() => useLinkAccountPrompt(true, 5));
    await act(async () => {});
    expect(second.result.current.show).toBe(false);
  });
});
