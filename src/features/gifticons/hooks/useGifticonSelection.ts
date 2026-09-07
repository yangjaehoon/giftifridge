import { useCallback, useState } from 'react';

/**
 * Multi-select state for the home list. A long-press calls `begin` to enter
 * selection mode with that row picked; `toggle` adds/removes rows; emptying the
 * set (or calling `clear`) leaves the mode. Kept as a hook so HomeScreen stays
 * layout-only and the behaviour is testable without a screen.
 */
export function useGifticonSelection() {
  const [selecting, setSelecting] = useState(false);
  const [selectedIds, setSelectedIds] = useState<ReadonlySet<string>>(new Set());

  const begin = useCallback((id: string) => {
    setSelecting(true);
    setSelectedIds(new Set([id]));
  }, []);

  const toggle = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      // Deselecting the last row exits the mode — there's nothing to act on.
      if (next.size === 0) setSelecting(false);
      return next;
    });
  }, []);

  const clear = useCallback(() => {
    setSelecting(false);
    setSelectedIds(new Set());
  }, []);

  return { selecting, selectedIds, count: selectedIds.size, begin, toggle, clear };
}
