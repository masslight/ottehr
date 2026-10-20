import { ReactNode } from 'react';
import { create } from 'zustand';
import { InsertContext } from '../helpers/insertTextAtCaret';

export interface CommandPaletteItemAction {
  id: string;
  icon: ReactNode;
  label: string;
  onClick: () => void;
  color?: string;
}

export interface CommandPaletteItem {
  id: string;
  label: string;
  category: string;
  onSelect: () => void;
  keywords?: string[];
  description?: string;
  inlineDescription?: boolean;
  /** When set, marks this item as a child of another item with the matching id.
   *  The renderer indents children below their parent within the same group
   *  to communicate hierarchy (e.g. "Tracking Board" parent with sub-tab
   *  children). Children remain independently selectable. */
  parentId?: string;
  icon?: ReactNode;
  actions?: CommandPaletteItemAction[];
  sortWeight?: number;
}

export type CommandPaletteGroupAction = Omit<CommandPaletteItemAction, 'id'>;

export type PhraseDialogState = { mode: 'new' } | { mode: 'edit'; index: number } | { mode: 'delete'; index: number };

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
  insertContext: InsertContext | null;
  sources: Record<string, CommandPaletteSource>;
  groupActions: Record<string, CommandPaletteGroupAction>;
  pendingQuickPick: PendingQuickPick | null;
  createTaskDialogOpen: boolean;
  phraseDialog: PhraseDialogState | null;
  open: () => void;
  openWithInsertContext: (insertContext: InsertContext | null) => void;
  close: () => void;
  toggle: () => void;
  registerSource: (sourceId: string, items: CommandPaletteItem[]) => void;
  unregisterSource: (sourceId: string) => void;
  registerGroupAction: (category: string, action: CommandPaletteGroupAction) => void;
  unregisterGroupAction: (category: string) => void;
  setPendingQuickPick: (pending: PendingQuickPick | null) => void;
  setCreateTaskDialogOpen: (open: boolean) => void;
  setPhraseDialog: (phraseDialog: PhraseDialogState | null) => void;
}

export const useCommandPaletteStore = create<CommandPaletteState>()((set) => ({
  isOpen: false,
  insertContext: null,
  sources: {},
  groupActions: {},
  pendingQuickPick: null,
  createTaskDialogOpen: false,
  phraseDialog: null,
  open: () => set({ isOpen: true, insertContext: null }),
  openWithInsertContext: (insertContext) => set({ isOpen: true, insertContext }),
  close: () => set({ isOpen: false, insertContext: null }),
  toggle: () => set((state) => ({ isOpen: !state.isOpen, insertContext: null })),
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
  registerGroupAction: (category, action) =>
    set((state) => ({ groupActions: { ...state.groupActions, [category]: action } })),
  unregisterGroupAction: (category) =>
    set((state) => {
      if (!(category in state.groupActions)) {
        return state;
      }

      const { [category]: _removedAction, ...remainingActions } = state.groupActions;
      return { groupActions: remainingActions };
    }),
  setPendingQuickPick: (pendingQuickPick) => set({ pendingQuickPick }),
  setCreateTaskDialogOpen: (createTaskDialogOpen) => set({ createTaskDialogOpen }),
  setPhraseDialog: (phraseDialog) => set({ phraseDialog }),
}));
