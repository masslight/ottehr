import { useEffect, useRef } from 'react';
import { useCommandPaletteStore } from '../state/command-palette.store';

export function usePendingQuickPick<T = unknown>(category: string, handler: (payload: T) => void, ready = true): void {
  const pendingQuickPick = useCommandPaletteStore((state) => state.pendingQuickPick);
  const setPendingQuickPick = useCommandPaletteStore((state) => state.setPendingQuickPick);
  const handlerRef = useRef(handler);

  handlerRef.current = handler;

  useEffect(() => {
    if (!pendingQuickPick || pendingQuickPick.category !== category || !ready) {
      return;
    }

    const timer = window.setTimeout(() => {
      handlerRef.current(pendingQuickPick.payload as T);
      setPendingQuickPick(null);
    }, 100);

    return () => window.clearTimeout(timer);
  }, [category, pendingQuickPick, ready, setPendingQuickPick]);
}
