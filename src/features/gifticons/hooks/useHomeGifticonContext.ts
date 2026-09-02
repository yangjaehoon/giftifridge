import { useState } from 'react';
import { useGifticons } from './useGifticons';
import { useSpaceGifticons } from './useSpaceGifticons';
import { useMySpaces } from '../../spaces/hooks/useMySpaces';
import type { HomeContext } from '../../spaces/components/SpaceSwitcher';

/**
 * Resolves which gifticon list the home screen shows — the user's personal
 * list or a space's — and hands back that list plus the space switcher inputs.
 *
 * The active context is *derived*, not just the raw selection: a space the user
 * just left (or an owner deleted) drops out of `spaces`, and this falls back to
 * personal in that case. Without that, the selection would stay pointed at the
 * gone space and useSpaceGifticons would retry a permission-denied subscription
 * on a backoff loop forever.
 */
export function useHomeGifticonContext(uid: string | undefined) {
  const [selected, setSelected] = useState<HomeContext>({ type: 'personal' });
  const { spaces, loading: spacesLoading } = useMySpaces(uid);

  const context: HomeContext =
    selected.type === 'space' && !spacesLoading && !spaces.some((s) => s.id === selected.spaceId)
      ? { type: 'personal' }
      : selected;

  const personal = useGifticons(context.type === 'personal' ? uid : undefined);
  const spaceGifticons = useSpaceGifticons(context.type === 'space' ? context.spaceId : undefined);
  const list = context.type === 'personal' ? personal : spaceGifticons;

  return { context, setContext: setSelected, spaces, list };
}
