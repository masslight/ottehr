import { create } from 'zustand';

export interface CommandPaletteItem {
  id: string;
  label: string;
  category: string;
  onSelect: () => void;
  keywords?: string[];
  /** When set, marks this item as a child of another item with the matching id.
   *  The renderer indents children below their parent within the same group
   *  to communicate hierarchy (e.g. "Tracking Board" parent with sub-tab
   *  children). Children remain independently selectable. */
  parentId?: string;
  /** When set, heavier items float above lighter ones (default 0) while the
   *  query is empty — lets a source pin a category (e.g. Recent Notes) above
   *  the alphabetical ones and carry its own internal ordering. Once the user
   *  types, match relevance dominates and sortWeight only breaks ties. */
  sortWeight?: number;
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
    set((state) => {
      const existingSource = state.sources[sourceId];
      if (existingSource?.items === items) {
        return state;
      }

      return {
        sources: {
          ...state.sources,
          [sourceId]: { items },
        },
      };
    }),
  unregisterSource: (sourceId) =>
    set((state) => {
      if (!(sourceId in state.sources)) {
        return state;
      }

      const { [sourceId]: _removedSource, ...remainingSources } = state.sources;
      return { sources: remainingSources };
    }),
  setPendingQuickPick: (pendingQuickPick) => set({ pendingQuickPick }),
}));
