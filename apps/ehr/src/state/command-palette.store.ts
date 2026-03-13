import { create } from 'zustand';

export interface CommandPaletteItem {
  id: string;
  label: string;
  category: string;
  onSelect: () => void;
}

interface CommandPaletteSource {
  items: CommandPaletteItem[];
}

interface CommandPaletteState {
  isOpen: boolean;
  sources: Record<string, CommandPaletteSource>;
  open: () => void;
  close: () => void;
  toggle: () => void;
  registerSource: (sourceId: string, items: CommandPaletteItem[]) => void;
  unregisterSource: (sourceId: string) => void;
}

export const useCommandPaletteStore = create<CommandPaletteState>()((set) => ({
  isOpen: false,
  sources: {},
  open: () => set({ isOpen: true }),
  close: () => set({ isOpen: false }),
  toggle: () => set((state) => ({ isOpen: !state.isOpen })),
  registerSource: (sourceId, items) =>
    set((state) => ({
      sources: { ...state.sources, [sourceId]: { items } },
    })),
  unregisterSource: (sourceId) =>
    set((state) => {
      const { [sourceId]: _, ...rest } = state.sources;
      return { sources: rest };
    }),
}));
