import { Alert } from 'react-native';
import { act, renderHook } from '@testing-library/react-native';
import { useGifticonBatchActions } from './useGifticonBatchActions';
import { markGifticonsUsed, removeGifticons } from '../domain/services/gifticonLifecycle';
import type { Gifticon } from '../domain/types';

jest.mock('../domain/services/gifticonLifecycle', () => ({
  markGifticonsUsed: jest.fn(),
  removeGifticons: jest.fn(),
}));

const mockedMarkUsed = markGifticonsUsed as jest.Mock;
const mockedRemove = removeGifticons as jest.Mock;

const items = [{ id: 'a' }, { id: 'b' }] as Gifticon[];

async function setup(overrides: Partial<Parameters<typeof useGifticonBatchActions>[0]> = {}) {
  const onDone = jest.fn();
  const { result } = await renderHook(() =>
    useGifticonBatchActions({ selectedItems: items, count: 2, uid: 'owner', onDone, ...overrides }),
  );
  return { result, onDone };
}

/** Grabs the button list handed to the most recent Alert.alert call. */
function alertButtons() {
  const call = (Alert.alert as jest.Mock).mock.calls.at(-1);
  return (call?.[2] ?? []) as { text?: string; onPress?: () => void }[];
}

beforeEach(() => {
  jest.clearAllMocks();
  jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  mockedMarkUsed.mockResolvedValue({ succeeded: 2, failed: 0 });
  mockedRemove.mockResolvedValue({ succeeded: 2, failed: 0 });
});

describe('useGifticonBatchActions', () => {
  it('marks the selected items used against the acting uid and clears the selection', async () => {
    const { result, onDone } = await setup();

    await act(async () => {
      await result.current.markUsed();
    });

    expect(mockedMarkUsed).toHaveBeenCalledWith(items, 'owner');
    expect(onDone).toHaveBeenCalledTimes(1);
    expect(Alert.alert).not.toHaveBeenCalled();
  });

  it('still resolves (and clears) on a partial failure', async () => {
    mockedMarkUsed.mockResolvedValue({ succeeded: 1, failed: 1 });
    const { result, onDone } = await setup();

    await act(async () => {
      await result.current.markUsed();
    });

    expect(onDone).toHaveBeenCalledTimes(1);
  });

  it('confirms with the selection count, not the visible-item count, before deleting', async () => {
    // 3 picked, but a filter hides one so only 2 are in selectedItems.
    const { result } = await setup({ count: 3 });

    await act(async () => {
      result.current.remove();
    });

    expect(Alert.alert).toHaveBeenCalledWith('삭제', '선택한 3개를 삭제할까요?', expect.any(Array));
  });

  it('removes the selected items only after the confirm button is pressed', async () => {
    const { result, onDone } = await setup();

    await act(async () => {
      result.current.remove();
    });
    expect(mockedRemove).not.toHaveBeenCalled();

    await act(async () => {
      await alertButtons()
        .find((b) => b.text === '삭제')
        ?.onPress?.();
    });

    expect(mockedRemove).toHaveBeenCalledWith(items);
    expect(onDone).toHaveBeenCalledTimes(1);
  });

  it('exposes a busy flag that settles after the action', async () => {
    const { result } = await setup();

    await act(async () => {
      await result.current.markUsed();
    });

    expect(result.current.busy).toBe(false);
  });
});
