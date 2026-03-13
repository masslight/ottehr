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

export interface PendingQuickPick {
  category: string;
  itemId: string;
  payload: unknown;
}

interface CommandPaletteState {
  isOpen: boolean;
  sources: Record<string, CommandPaletteSource>;
  pendingQuickPick: PendingQuickPick | null;
  open: () => void;
  close: () => void;
  toggle: () => void;
  registerSource: (sourceId: string, items: CommandPaletteItem[]) => void;
  unregisterSource: (sourceId: string) => void;
  setPendingQuickPick: (pending: PendingQuickPick | null) => void;
}

export const useCommandPaletteStore = create<CommandPaletteState>()((set) => ({
  isOpen: false,
  sources: {},
  pendingQuickPick: null,
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
  setPendingQuickPick: (pending) => set({ pendingQuickPick: pending }),
}));
