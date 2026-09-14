import { ReactNode } from 'react';
import { create } from 'zustand';
import { InsertTarget } from '../helpers/insertTextAtCaret';

export interface CommandPaletteItemAction {
  id: string;
  icon: ReactNode;
  label: string;
  onClick: () => void;
  /** Hover color for the icon (MUI palette path or hex); icons are grey at rest. Defaults to primary.main. */
  color?: string;
}

export interface CommandPaletteItem {
  id: string;
  label: string;
  category: string;
  onSelect: () => void;
  keywords?: string[];
  /** Optional one-line secondary text rendered under the label. */
  description?: string;
  /** Render `description` inline after the label, in parentheses, on the same line, instead of as a second line. */
  inlineDescription?: boolean;
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
  /** Optional leading icon rendered before the label. */
  icon?: ReactNode;
  /** Optional per-row buttons rendered at the end of the row; clicking one does not select the row. */
  actions?: CommandPaletteItemAction[];
}

/** A single icon button rendered on a group's header row (e.g. "+" on "Phrases"). */
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
  /** The text field that had focus when the palette was opened (insert target for phrases). */
  insertTarget: InsertTarget | null;
  sources: Record<string, CommandPaletteSource>;
  /** Header-row actions keyed by item category. */
  groupActions: Record<string, CommandPaletteGroupAction>;
  pendingQuickPick: PendingQuickPick | null;
  createTaskDialogOpen: boolean;
  phraseDialog: PhraseDialogState | null;
  open: () => void;
  /** Opens the palette from a focused text field, remembering it as the insert target. */
  openWithInsertTarget: (insertTarget: InsertTarget | null) => void;
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
  insertTarget: null,
  sources: {},
  groupActions: {},
  pendingQuickPick: null,
  createTaskDialogOpen: false,
  phraseDialog: null,
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
