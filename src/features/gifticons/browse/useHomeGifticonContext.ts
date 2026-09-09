import { useState } from 'react';
import { useGifticons } from '../hooks/useGifticons';
import { useSpaceGifticons } from '../hooks/useSpaceGifticons';
import type { HomeContext } from '../../../shared/types/homeContext';

/**
 * Resolves which gifticon list the home screen shows — the user's personal
 * list or a space's — and hands back that list plus the current context.
 *
 * The active context is *derived*, not just the raw selection: a space the user
 * just left (or an owner deleted) drops out of `spaceIds`, and this falls back
 * to personal in that case. Without that, the selection would stay pointed at
 * the gone space and useSpaceGifticons would retry a permission-denied
 * subscription on a backoff loop forever.
 *
 * The caller owns the space list (it also feeds the switcher UI) and passes the
 * ids in, so this hook stays inside the gifticons feature.
 */
export function useHomeGifticonContext(
  uid: string | undefined,
  spaceIds: readonly string[],
  spacesLoading: boolean,
) {
  const [selected, setSelected] = useState<HomeContext>({ type: 'personal' });

  const context: HomeContext =
    selected.type === 'space' && !spacesLoading && !spaceIds.includes(selected.spaceId)
      ? { type: 'personal' }
      : selected;

  const personal = useGifticons(context.type === 'personal' ? uid : undefined);
  const spaceGifticons = useSpaceGifticons(context.type === 'space' ? context.spaceId : undefined);
  const list = context.type === 'personal' ? personal : spaceGifticons;

  return { context, setContext: setSelected, list };
}
