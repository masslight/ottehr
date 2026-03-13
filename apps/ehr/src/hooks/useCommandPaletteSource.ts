import { useEffect } from 'react';
import { CommandPaletteItem, useCommandPaletteStore } from '../state/command-palette.store';

export function useCommandPaletteSource(sourceId: string, items: CommandPaletteItem[]): void {
  const registerSource = useCommandPaletteStore((state) => state.registerSource);
  const unregisterSource = useCommandPaletteStore((state) => state.unregisterSource);

  useEffect(() => {
    if (items.length > 0) {
      registerSource(sourceId, items);
    } else {
      unregisterSource(sourceId);
    }

    return () => {
      unregisterSource(sourceId);
    };
  }, [sourceId, items, registerSource, unregisterSource]);
}
