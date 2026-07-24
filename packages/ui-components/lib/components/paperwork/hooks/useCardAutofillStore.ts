import { create } from 'zustand';

/**
 * UI state the card auto-fill engine (useCardAutofill) publishes for the paperwork form to
 * render: per-card-slot progress ("Reading your card…" / couldn't-read notes), the ✨AI badge
 * set for auto-filled fields, and the unmatched-carrier hints. Keyed by questionnaire linkIds
 * (slot linkIds for card captures, target linkIds for filled fields). Session/page scoped —
 * the engine resets it when the paperwork page changes.
 *
 * All setters no-op when the value is already current: the engine re-publishes on every form
 * change, and an unconditional set would re-render every badge/note on each keystroke.
 */
interface CardAutofillState {
  /** slot linkId → the OCR poll for the just-uploaded image is still in flight. */
  reading: Record<string, boolean>;
  /** slot linkId → terminal not-a-card / unreadable verdict for the uploaded image. */
  failed: Record<string, boolean>;
  /** slot linkId → target linkIds the engine filled from that card (insertion order). */
  filledBySlot: Record<string, string[]>;
  /** target linkId → ✨AI badge visible (cleared when the patient edits the field). */
  aiFilled: Record<string, boolean>;
  /** carrier field linkId → OCR'd carrier name that matched no payer option. */
  carrierHint: Record<string, string>;

  setReading: (slotLinkId: string, reading: boolean) => void;
  setFailed: (slotLinkId: string, failed: boolean) => void;
  markFilled: (slotLinkId: string, targetLinkId: string) => void;
  clearFilled: (targetLinkId: string) => void;
  setCarrierHint: (linkId: string, carrierName: string) => void;
  clearCarrierHint: (linkId: string) => void;
  resetAll: () => void;
}

const EMPTY_STATE = {
  reading: {},
  failed: {},
  filledBySlot: {},
  aiFilled: {},
  carrierHint: {},
};

export const useCardAutofillStore = create<CardAutofillState>()((set, get) => ({
  ...EMPTY_STATE,

  setReading: (slotLinkId, reading) => {
    if (Boolean(get().reading[slotLinkId]) === reading) return;
    set((state) => ({ reading: { ...state.reading, [slotLinkId]: reading } }));
  },
  setFailed: (slotLinkId, failed) => {
    if (Boolean(get().failed[slotLinkId]) === failed) return;
    set((state) => ({ failed: { ...state.failed, [slotLinkId]: failed } }));
  },
  markFilled: (slotLinkId, targetLinkId) => {
    const { filledBySlot, aiFilled } = get();
    const slotFills = filledBySlot[slotLinkId] ?? [];
    if (aiFilled[targetLinkId] && slotFills.includes(targetLinkId)) return;
    set((state) => ({
      aiFilled: { ...state.aiFilled, [targetLinkId]: true },
      filledBySlot: {
        ...state.filledBySlot,
        [slotLinkId]: slotFills.includes(targetLinkId) ? slotFills : [...slotFills, targetLinkId],
      },
    }));
  },
  clearFilled: (targetLinkId) => {
    if (!get().aiFilled[targetLinkId]) return;
    set((state) => ({ aiFilled: { ...state.aiFilled, [targetLinkId]: false } }));
  },
  setCarrierHint: (linkId, carrierName) => {
    if (get().carrierHint[linkId] === carrierName) return;
    set((state) => ({ carrierHint: { ...state.carrierHint, [linkId]: carrierName } }));
  },
  clearCarrierHint: (linkId) => {
    if (get().carrierHint[linkId] === undefined) return;
    set((state) => {
      const { [linkId]: _cleared, ...rest } = state.carrierHint;
      return { carrierHint: rest };
    });
  },
  resetAll: () => {
    set({ ...EMPTY_STATE });
  },
}));
