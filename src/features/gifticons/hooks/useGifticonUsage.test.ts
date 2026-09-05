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
const record = { id: 'u1', amount: 3000, usedAt: 't1' };

beforeEach(() => {
  jest.clearAllMocks();
  jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  mockedRecord.mockResolvedValue(undefined);
  mockedDelete.mockResolvedValue(undefined);
});

describe('useGifticonUsage', () => {
  it('records a usage record against the current gifticon and acting uid, reporting success', async () => {
    const { result } = await renderHook(() => useGifticonUsage(gifticon, 'owner'));

    let succeeded = false;
    await act(async () => {
      succeeded = await result.current.recordUsage(record);
    });

    expect(mockedRecord).toHaveBeenCalledWith(gifticon, record, 'owner');
    expect(succeeded).toBe(true);
    expect(Alert.alert).not.toHaveBeenCalled();
  });

  it('does nothing when there is no gifticon yet', async () => {
    const { result } = await renderHook(() => useGifticonUsage(null, 'owner'));

    let succeeded = true;
    await act(async () => {
      succeeded = await result.current.recordUsage(record);
      await result.current.deleteRecord(record);
    });

    expect(succeeded).toBe(false);
    expect(mockedRecord).not.toHaveBeenCalled();
    expect(mockedDelete).not.toHaveBeenCalled();
  });

  it('alerts and reports failure when recording fails', async () => {
    mockedRecord.mockRejectedValue(new Error('boom'));
    const { result } = await renderHook(() => useGifticonUsage(gifticon, 'owner'));

    let succeeded = true;
    await act(async () => {
      succeeded = await result.current.recordUsage(record);
    });

    expect(succeeded).toBe(false);
    expect(Alert.alert).toHaveBeenCalledWith('오류', expect.any(String));
  });

  it('deletes a record by gifticon id', async () => {
    const { result } = await renderHook(() => useGifticonUsage(gifticon, 'owner'));

    await act(async () => {
      await result.current.deleteRecord(record);
    });

    expect(mockedDelete).toHaveBeenCalledWith('g1', record);
  });

  it('alerts when deleting a record fails', async () => {
    mockedDelete.mockRejectedValue(new Error('boom'));
    const { result } = await renderHook(() => useGifticonUsage(gifticon, 'owner'));

    await act(async () => {
      await result.current.deleteRecord(record);
    });

    expect(Alert.alert).toHaveBeenCalledWith('오류', expect.any(String));
  });

  it('clears the busy flag once recordUsage settles', async () => {
    const { result } = await renderHook(() => useGifticonUsage(gifticon, 'owner'));

    await act(async () => {
      await result.current.recordUsage(record);
    });

    expect(result.current.busy).toBe(false);
  });
});
