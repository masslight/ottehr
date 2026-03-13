import { useEffect, useRef } from 'react';
import { useCommandPaletteStore } from '../state/command-palette.store';

/**
 * Consumes a pending quick pick for the given category.
 * When a quick pick is deferred via navigation (from the global command palette),
 * the target page calls this hook to pick it up and execute the action.
 *
 * The hook accepts an optional `ready` flag (default: true). When the target page
 * depends on async data (e.g., select options loaded via a query), pass `ready`
 * so the pending pick is deferred until the data is available. This avoids the
 * issue where the handler runs before its dependencies are loaded on first visit.
 *
 * @param category - The category to listen for (e.g., 'allergies', 'medications')
 * @param handler - Callback that receives the pending quick pick payload.
 * @param ready - Whether the handler's dependencies are loaded (default: true).
 */
export function usePendingQuickPick<T = unknown>(category: string, handler: (payload: T) => void, ready = true): void {
  const pendingQuickPick = useCommandPaletteStore((s) => s.pendingQuickPick);
  const setPendingQuickPick = useCommandPaletteStore((s) => s.setPendingQuickPick);
  const handlerRef = useRef(handler);
  handlerRef.current = handler;

  useEffect(() => {
    if (!pendingQuickPick || pendingQuickPick.category !== category || !ready) {
      return;
    }
    // Small delay to let the page finish rendering and initializing forms
    const timer = setTimeout(() => {
      handlerRef.current(pendingQuickPick.payload as T);
      setPendingQuickPick(null);
    }, 100);
    return () => clearTimeout(timer);
  }, [pendingQuickPick, category, ready, setPendingQuickPick]);
}
