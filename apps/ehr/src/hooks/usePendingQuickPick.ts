import { useEffect } from 'react';
import { useCommandPaletteStore } from '../state/command-palette.store';

/**
 * Consumes a pending quick pick for the given category.
 * When a quick pick is deferred via navigation (from the global command palette),
 * the target page calls this hook to pick it up and execute the action.
 *
 * @param category - The category to listen for (e.g., 'allergies', 'medications')
 * @param handler - Callback that receives the pending quick pick payload.
 *                  Called once after mount if a matching pending quick pick exists.
 */
export function usePendingQuickPick<T = unknown>(category: string, handler: (payload: T) => void): void {
  const pendingQuickPick = useCommandPaletteStore((s) => s.pendingQuickPick);
  const setPendingQuickPick = useCommandPaletteStore((s) => s.setPendingQuickPick);

  useEffect(() => {
    if (!pendingQuickPick || pendingQuickPick.category !== category) {
      return;
    }
    // Small delay to let the page finish rendering and initializing forms
    const timer = setTimeout(() => {
      handler(pendingQuickPick.payload as T);
      setPendingQuickPick(null);
    }, 100);
    return () => clearTimeout(timer);
  }, [pendingQuickPick, category, handler, setPendingQuickPick]);
}
