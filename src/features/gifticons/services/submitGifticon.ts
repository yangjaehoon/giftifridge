import { confirmAsync } from '../../../shared/utils/confirmAsync';
import { saveGifticon } from './saveGifticon';
import { syncGifticonReminders } from './gifticonReminders';
import type { Gifticon, NewGifticon } from '../types';

export interface SubmitGifticonInput {
  /** The gifticon being edited, or null on the create path. */
  existing: Gifticon | null;
  /** Stable client-side id for the create path, so a retry hits the same doc. */
  draftId: string;
  ownerId: string;
  /** Space this gifticon belongs to, if any. */
  spaceId?: string;
  imageUri: string;
  imageChanged: boolean;
  /** Assembled form fields, minus imageUrl (saveGifticon resolves it) and spaceId. */
  fields: Omit<NewGifticon, 'imageUrl'>;
  /** The list (personal or space) to check for a clashing barcode. */
  siblings: Gifticon[];
}

export type SubmitGifticonResult = { status: 'saved'; id: string } | { status: 'cancelled' };

/**
 * Create-or-update orchestration behind the add/edit screen's save button:
 *   1. if the barcode already exists on a sibling, ask the user to confirm
 *      (declining returns 'cancelled' — not an error)
 *   2. persist via saveGifticon
 *   3. schedule reminders as a best-effort follow-up (never throws)
 * Any real persistence failure propagates to the caller.
 */
export async function submitGifticon(input: SubmitGifticonInput): Promise<SubmitGifticonResult> {
  const { existing, draftId, ownerId, spaceId, imageUri, imageChanged, fields, siblings } = input;
  const editingId = existing?.id;

  const barcode = fields.barcode?.trim();
  if (barcode) {
    const duplicate = siblings.find((g) => g.id !== editingId && g.barcode === barcode);
    if (duplicate) {
      const proceed = await confirmAsync(
        '이미 등록된 번호예요',
        `"${duplicate.brand} ${duplicate.name}"와(과) 바코드 번호가 같아요. 그래도 등록할까요?`,
      );
      if (!proceed) return { status: 'cancelled' };
    }
  }

  const id = await saveGifticon({
    editingId,
    draftId,
    ownerId,
    imageUri,
    imageChanged,
    fields: { ...fields, spaceId },
  });

  await syncGifticonReminders({
    gifticon: { id, name: fields.name, brand: fields.brand, expiresAt: fields.expiresAt },
    isOwner: !existing || existing.ownerId === ownerId,
    isEditing: Boolean(existing),
    previousNotificationIds: existing?.notificationIds,
  });

  return { status: 'saved', id };
}
