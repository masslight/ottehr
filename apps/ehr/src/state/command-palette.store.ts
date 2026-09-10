import { create } from 'zustand';
import { InsertTarget } from '../helpers/insertTextAtCaret';

export interface CommandPaletteItem {
  id: string;
  label: string;
  category: string;
  onSelect: () => void;
  keywords?: string[];
  /** Optional one-line secondary text rendered under the label. */
  description?: string;
  /** When set, marks this item as a child of another item with the matching id.
   *  The renderer indents children below their parent within the same group
   *  to communicate hierarchy (e.g. "Tracking Board" parent with sub-tab
   *  children). Children remain independently selectable. */
  parentId?: string;
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
  /** The text field that had focus when the palette was opened (insert target for phrases). */
  insertTarget: InsertTarget | null;
  sources: Record<string, CommandPaletteSource>;
  pendingQuickPick: PendingQuickPick | null;
  createTaskDialogOpen: boolean;
  open: () => void;
  /** Opens the palette from a focused text field, remembering it as the insert target. */
  openWithInsertTarget: (insertTarget: InsertTarget | null) => void;
  close: () => void;
  toggle: () => void;
  registerSource: (sourceId: string, items: CommandPaletteItem[]) => void;
  unregisterSource: (sourceId: string) => void;
  setPendingQuickPick: (pending: PendingQuickPick | null) => void;
  setCreateTaskDialogOpen: (open: boolean) => void;
}

export const useCommandPaletteStore = create<CommandPaletteState>()((set) => ({
  isOpen: false,
  insertTarget: null,
  sources: {},
  pendingQuickPick: null,
  createTaskDialogOpen: false,
  open: () => set({ isOpen: true, insertTarget: null }),
  openWithInsertTarget: (insertTarget) => set({ isOpen: true, insertTarget }),
  close: () => set({ isOpen: false, insertTarget: null }),
  toggle: () => set((state) => ({ isOpen: !state.isOpen, insertTarget: null })),
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
  setCreateTaskDialogOpen: (createTaskDialogOpen) => set({ createTaskDialogOpen }),
}));
