import { createGifticon, updateGifticon } from './gifticonService';
import { uploadGifticonImage } from './gifticonImage';
import { withTimeout, WRITE_TIMEOUT_MS } from '../../../shared/utils/withTimeout';
import type { NewGifticon } from '../types';

export interface SaveGifticonInput {
  /** Present → update that doc; absent → create at `draftId`. */
  editingId?: string;
  /** Stable client-side id so a retry after a timeout hits the same doc. */
  draftId: string;
  ownerId: string;
  imageUri: string;
  imageChanged: boolean;
  /** Everything except imageUrl, which this function resolves from the upload. */
  fields: Omit<NewGifticon, 'imageUrl'>;
}

/**
 * Persists a gifticon: uploads the image if it changed, then creates or updates
 * the doc, all under one write timeout. Returns the gifticon id. Mirrors
 * syncGifticonReminders so the screen's save handler is just orchestration.
 */
export async function saveGifticon(input: SaveGifticonInput): Promise<string> {
  const { editingId, draftId, ownerId, imageUri, imageChanged, fields } = input;
  const targetId = editingId ?? draftId;

  return withTimeout(
    (async () => {
      const imageUrl = imageChanged ? await uploadGifticonImage(targetId, imageUri) : imageUri;
      const data: NewGifticon = { ...fields, imageUrl };
      if (editingId) {
        await updateGifticon(editingId, data);
        return editingId;
      }
      return createGifticon(draftId, ownerId, data);
    })(),
    WRITE_TIMEOUT_MS,
  );
}
