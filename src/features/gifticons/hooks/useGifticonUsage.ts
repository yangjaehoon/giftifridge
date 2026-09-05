import { useState } from 'react';
import { Alert } from 'react-native';
import { deleteGifticonUsageRecord, recordGifticonUsage } from '../services/gifticonLifecycle';
import { getGifticonWriteErrorMessage } from '../errors';
import { useToast } from '../../../shared/components/ToastProvider';
import { haptics } from '../../../shared/utils/haptics';
import type { Gifticon, UsageRecord } from '../types';

/**
 * Orchestration for the detail screen's usage-history panel: logs a partial
 * spend or removes one, with a busy flag, a toast on success, and the same
 * error-alert pattern as the rest of the screen. `recordUsage` reports back
 * whether it succeeded so the panel can decide whether to close its form or
 * leave it open (with the same pinned record) for the user to just retry.
 */
export function useGifticonUsage(gifticon: Gifticon | null, actingUid: string | undefined) {
  const showToast = useToast();
  const [busy, setBusy] = useState(false);

  const recordUsage = async (record: UsageRecord): Promise<boolean> => {
    if (!gifticon) return false;
    setBusy(true);
    try {
      await recordGifticonUsage(gifticon, record, actingUid);
      haptics.success();
      showToast('사용 내역을 등록했어요');
      return true;
    } catch (err) {
      Alert.alert('오류', getGifticonWriteErrorMessage(err, 'update'));
      return false;
    } finally {
      setBusy(false);
    }
  };

  const deleteRecord = async (record: UsageRecord) => {
    if (!gifticon) return;
    setBusy(true);
    try {
      await deleteGifticonUsageRecord(gifticon.id, record);
      haptics.selection();
      showToast('사용 내역을 삭제했어요');
    } catch (err) {
      Alert.alert('오류', getGifticonWriteErrorMessage(err, 'update'));
    } finally {
      setBusy(false);
    }
  };

  return { busy, recordUsage, deleteRecord };
}
