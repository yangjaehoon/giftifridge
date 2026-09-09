import { Alert } from 'react-native';
import { useToast } from '../../../shared/components/ToastProvider';
import { useAsyncAction } from '../../../shared/hooks/useAsyncAction';
import { markGifticonsUsed, removeGifticons } from '../domain/services/gifticonLifecycle';
import { getGifticonWriteErrorMessage } from '../domain/errors';
import type { Gifticon } from '../domain/types';

interface Options {
  selectedItems: Gifticon[];
  uid: string | undefined;
  /** Clears the selection after a batch completes. */
  onDone: () => void;
}

/**
 * The "mark used" / "delete" actions for a multi-select on the home list: the
 * shared busy flag, the partial-failure toast wording, and the delete
 * confirmation. The screen keeps only the selection state and the bar layout.
 */
export function useGifticonBatchActions({ selectedItems, uid, onDone }: Options) {
  const showToast = useToast();
  const { busy, run } = useAsyncAction(getGifticonWriteErrorMessage);

  const markUsed = () =>
    run(() => markGifticonsUsed(selectedItems, uid), {
      fallback: 'update',
      onSuccess: ({ succeeded, failed }) => {
        onDone();
        showToast(
          failed > 0
            ? `${succeeded}개 완료, ${failed}개는 실패했어요`
            : `${succeeded}개를 사용완료로 표시했어요`,
        );
      },
    });

  const remove = () => {
    Alert.alert('삭제', `선택한 ${selectedItems.length}개를 삭제할까요?`, [
      { text: '취소', style: 'cancel' },
      {
        text: '삭제',
        style: 'destructive',
        onPress: () =>
          run(() => removeGifticons(selectedItems), {
            fallback: 'delete',
            onSuccess: ({ succeeded, failed }) => {
              onDone();
              showToast(
                failed > 0
                  ? `${succeeded}개 삭제, ${failed}개는 실패했어요`
                  : `${succeeded}개를 삭제했어요`,
              );
            },
          }),
      },
    ]);
  };

  return { busy, markUsed, remove };
}
