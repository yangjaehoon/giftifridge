import {
  deleteGifticonUsageRecord,
  recordGifticonUsage,
} from '../domain/services/gifticonLifecycle';
import { getGifticonWriteErrorMessage } from '../domain/errors';
import { useToast } from '../../../shared/components/ToastProvider';
import { useAsyncAction } from '../../../shared/hooks/useAsyncAction';
import { haptics } from '../../../shared/utils/haptics';
import type { Gifticon, UsageRecord } from '../domain/types';

/**
 * Orchestration for the detail screen's usage-history panel: logs a partial
 * spend or removes one, with a busy flag, a toast on success, and the shared
 * error-alert shell (useAsyncAction). `recordUsage` reports back whether it
 * succeeded so the panel can decide whether to close its form or leave it open
 * (with the same pinned record) for the user to just retry.
 */
export function useGifticonUsage(gifticon: Gifticon | null, actingUid: string | undefined) {
  const showToast = useToast();
  const { busy, run } = useAsyncAction(getGifticonWriteErrorMessage);

  const recordUsage = async (record: UsageRecord): Promise<boolean> => {
    if (!gifticon) return false;
    return run(() => recordGifticonUsage(gifticon, record, actingUid), {
      fallback: 'update',
      onSuccess: () => {
        haptics.success();
        showToast('사용 내역을 등록했어요');
      },
    });
  };

  const deleteRecord = async (record: UsageRecord) => {
    if (!gifticon) return;
    await run(() => deleteGifticonUsageRecord(gifticon.id, record), {
      fallback: 'update',
      onSuccess: () => {
        haptics.selection();
        showToast('사용 내역을 삭제했어요');
      },
    });
  };

  return { busy, recordUsage, deleteRecord };
}
