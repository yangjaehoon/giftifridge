import { Alert } from 'react-native';
import { act, renderHook } from '@testing-library/react-native';
import { useGifticonUsage } from './useGifticonUsage';
import { deleteGifticonUsageRecord, recordGifticonUsage } from '../services/gifticonLifecycle';
import type { Gifticon } from '../types';

jest.mock('../services/gifticonLifecycle', () => ({
  recordGifticonUsage: jest.fn(),
  deleteGifticonUsageRecord: jest.fn(),
}));

const mockedRecord = recordGifticonUsage as jest.Mock;
const mockedDelete = deleteGifticonUsageRecord as jest.Mock;

const gifticon = { id: 'g1', amount: 10000 } as Gifticon;

beforeEach(() => {
  jest.clearAllMocks();
  jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  mockedRecord.mockResolvedValue(undefined);
  mockedDelete.mockResolvedValue(undefined);
});

describe('useGifticonUsage', () => {
  it('records a usage amount against the current gifticon and acting uid', async () => {
    const { result } = await renderHook(() => useGifticonUsage(gifticon, 'owner'));

    await act(async () => {
      await result.current.recordUsage(3000);
    });

    expect(mockedRecord).toHaveBeenCalledWith(gifticon, 3000, 'owner');
    expect(Alert.alert).not.toHaveBeenCalled();
  });

  it('does nothing when there is no gifticon yet', async () => {
    const { result } = await renderHook(() => useGifticonUsage(null, 'owner'));

    await act(async () => {
      await result.current.recordUsage(3000);
      await result.current.deleteRecord({ amount: 3000, usedAt: 't' });
    });

    expect(mockedRecord).not.toHaveBeenCalled();
    expect(mockedDelete).not.toHaveBeenCalled();
  });

  it('alerts with the mapped error message when recording fails', async () => {
    mockedRecord.mockRejectedValue(new Error('boom'));
    const { result } = await renderHook(() => useGifticonUsage(gifticon, 'owner'));

    await act(async () => {
      await result.current.recordUsage(3000);
    });

    expect(Alert.alert).toHaveBeenCalledWith('오류', expect.any(String));
  });

  it('deletes a record by gifticon id', async () => {
    const { result } = await renderHook(() => useGifticonUsage(gifticon, 'owner'));

    await act(async () => {
      await result.current.deleteRecord({ amount: 3000, usedAt: 't1' });
    });

    expect(mockedDelete).toHaveBeenCalledWith('g1', { amount: 3000, usedAt: 't1' });
  });

  it('alerts when deleting a record fails', async () => {
    mockedDelete.mockRejectedValue(new Error('boom'));
    const { result } = await renderHook(() => useGifticonUsage(gifticon, 'owner'));

    await act(async () => {
      await result.current.deleteRecord({ amount: 3000, usedAt: 't1' });
    });

    expect(Alert.alert).toHaveBeenCalledWith('오류', expect.any(String));
  });

  it('clears the busy flag once recordUsage settles', async () => {
    const { result } = await renderHook(() => useGifticonUsage(gifticon, 'owner'));

    await act(async () => {
      await result.current.recordUsage(1000);
    });

    expect(result.current.busy).toBe(false);
  });
});
