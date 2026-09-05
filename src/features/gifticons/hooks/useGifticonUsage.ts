import { useState } from 'react';
import { Alert } from 'react-native';
import { deleteGifticonUsageRecord, recordGifticonUsage } from '../services/gifticonLifecycle';
import { getGifticonWriteErrorMessage } from '../errors';
import { haptics } from '../../../shared/utils/haptics';
import type { Gifticon, UsageRecord } from '../types';

/**
 * Orchestration for the detail screen's usage-history panel: logs a partial
 * spend or removes one, with a busy flag and the same error-toast pattern as
 * the rest of the screen. `gifticon`/`actingUid` are read fresh on each call
 * so a realtime update in between two actions is never acted on stale.
 */
export function useGifticonUsage(gifticon: Gifticon | null, actingUid: string | undefined) {
  const [busy, setBusy] = useState(false);

  const recordUsage = async (amount: number) => {
    if (!gifticon) return;
    setBusy(true);
    try {
      await recordGifticonUsage(gifticon, amount, actingUid);
      haptics.success();
    } catch (err) {
      Alert.alert('오류', getGifticonWriteErrorMessage(err, 'update'));
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
    } catch (err) {
      Alert.alert('오류', getGifticonWriteErrorMessage(err, 'update'));
    } finally {
      setBusy(false);
    }
  };

  return { busy, recordUsage, deleteRecord };
}
