import { DocumentReference } from 'fhir/r4b';
import { PickerRequest, PickerResponse } from 'src/features/easy-chart/executor/types';
import { NarrativeLine, RejectedAction } from 'utils/lib/easy-chart/api';
import { storedNarrativeOf, transcriptTextOf } from 'utils/lib/easy-chart/narrative';
import { getApiError } from 'utils/lib/helpers/oystehrApi';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { draftFromNarrative, narrativeText } from './narrativeLines';
import {
  NarrativeSegment,
  NoteMode,
  OrderSuggestion,
  RecommendationApplyStatus,
  ScribeAnalysis,
  ScribeRecommendation,
} from './types';

export const SCRIBE_PANEL_MIN_WIDTH = 340;
export const SCRIBE_PANEL_DEFAULT_WIDTH = 440;
/** Width of the collapsed strip that stays on the right edge so the panel can be reopened. */
export const SCRIBE_RAIL_WIDTH = 48;

/** The panel may take up to 60% of the viewport so the note next to it stays usable. */
export const clampScribePanelWidth = (width: number, viewportWidth: number = window.innerWidth): number => {
  const max = Math.max(SCRIBE_PANEL_MIN_WIDTH, Math.floor(viewportWidth * 0.6));
  return Math.min(max, Math.max(SCRIBE_PANEL_MIN_WIDTH, Math.round(width)));
};

export type ScribePhase = 'input' | 'analyzing' | 'ready';

/**
 * Reads the visit and answers with recommendations: the plan and review endpoints, behind one function.
 * The transcript is what the planner is sent, when there is one; the narrative text and the generated lines
 * it was edited from go along only as the provider's corrections, and only when the two differ. Without a
 * transcript the narrative text is the dictation itself.
 */
export type ScribeAnalyzer = (
  narrative: string,
  generated: NarrativeLine[],
  transcript: string
) => Promise<ScribeAnalysis>;

/**
 * Writes the narrative from a transcript: the narrative endpoint, behind one function. `documentId` names the
 * transcript document the text came from, so the server can store the narrative on it.
 */
export type NarrativeGenerator = (transcript: string, documentId?: string) => Promise<NarrativeLine[]>;

/**
 * Where the transcript came from: a transcript document already on the visit (an ambient recording, the
 * intake chat), or nothing yet. A transcript is read-only data the visit already holds — there is no way to
 * type one here; the narrative is what the provider writes and edits, and the only thing the planner receives.
 */
export type TranscriptSource = 'document' | 'none';

export type NarrativeStatus = 'idle' | 'generating' | 'ready' | 'error';

/** The key a row opened from the narrative popover holds the editor under — see `editingId`. */
export const narrativeEditingKey = (id: string): string => `narrative-${id}`;

export interface RecommendationItemState {
  selected: boolean;
  /**
   * A note row's tick, with a third position: after the field's text, over it, or not at all. Set only on
   * `hpi` rows. `selected` stays the one thing the rest of the panel reads — it is `noteMode !== 'skip'`
   * here — so the two are always written together.
   */
  noteMode?: NoteMode;
  status: RecommendationApplyStatus;
  /** Why the write failed, for a row in `error`. */
  error?: string;
  /** Why nothing was written, for a row in `skipped` ("already on the chart", "no matching allergy"). */
  reason?: string;
  /**
   * What the executor wants read alongside an `applied` row: a demoted primary, an auto-pick among near
   * matches, a finding filed as free text because no checkbox fit.
   */
  note?: string;
  /** The executor picked or inferred this rather than matching it outright; the row says so. */
  lowConfidence?: boolean;
  /** The provider has changed it, so the AI's own wording of it is no longer to be trusted. */
  edited?: boolean;
  /** When it landed in the chart, so the note can flash what has just arrived. */
  appliedAt?: number;
}

/** A question the executor is waiting on: which of several near-equal catalogue matches was meant. */
export type PendingPick = PickerRequest & { resolve: (response: PickerResponse) => void };

interface ScribeRecommendationsState {
  isOpen: boolean;
  width: number;

  /** Encounter the transcript and recommendations belong to; switching visits resets them. */
  encounterId?: string;
  /** The selected document's decoded text. Read-only evidence; sent to the planner as such. */
  transcript: string;
  transcriptSource: TranscriptSource;
  sourceDocumentId?: string;
  /**
   * The narrative as the generator wrote it — from the server, or stored on the transcript document — kept
   * so its sentences can be found again in the draft and traced to their transcript snippets.
   */
  narrativeGenerated: NarrativeLine[];
  /** The narrative as the provider edits it: one paragraph, the only thing the planner is sent. */
  narrativeDraft: string;
  narrativeStatus: NarrativeStatus;
  narrativeError?: string;
  phase: ScribePhase;
  analysisError?: string;
  /** The narrative told back on the results screen, cut into runs around each recommendation's quote. */
  narrativeRuns: NarrativeSegment[];
  recommendations: ScribeRecommendation[];
  itemState: Record<string, RecommendationItemState>;
  orderSuggestions: OrderSuggestion[];
  ordersDone: Record<string, boolean>;
  /** Actions the server refused, with the reason each. */
  rejected: RejectedAction[];
  /** What the assistant said rather than charted — from the analysis, and from handlers as they run. */
  notes: string[];
  isApplying: boolean;
  /** Recommendations the chart already holds, derived from live chart data. */
  chartedIds: string[];
  /** Item under the pointer, in the narrative or in its row, so the two can light up together. */
  hoveredItemId?: string;
  /**
   * The one row whose editor is open. Held here rather than on the row so opening a second one
   * closes — and so saves — the first. A recommendation can be on screen twice (in the list and
   * in the narrative popover), so this is the row that is open, not the item it edits.
   */
  editingId?: string;
  pendingPick: PendingPick | null;

  open: () => void;
  close: () => void;
  setWidth: (width: number) => void;

  startSession: (encounterId: string | undefined) => void;
  /**
   * Takes a transcript document as the source: its narrative, if the pipeline already stored one on it,
   * or a freshly generated one. Selecting the document already selected is a no-op, so edits survive.
   */
  selectTranscriptDocument: (doc: DocumentReference, generate: NarrativeGenerator) => Promise<void>;
  generateNarrative: (generate: NarrativeGenerator) => Promise<void>;
  setNarrativeDraft: (text: string) => void;
  analyze: (analyzer: ScribeAnalyzer) => Promise<void>;

  setSelected: (id: string, selected: boolean) => void;
  setManySelected: (ids: string[], selected: boolean) => void;
  /** A note row's way of being ticked: `skip` unticks it, the other two tick it and say how it lands. */
  setNoteMode: (id: string, mode: NoteMode) => void;
  updateRecommendation: (id: string, patch: Partial<ScribeRecommendation>) => void;
  /** `message` is the error for `error`, the reason for `skipped`, the executor's note for `applied`. */
  setItemStatus: (
    id: string,
    status: RecommendationApplyStatus,
    message?: string,
    flags?: { lowConfidence?: boolean }
  ) => void;
  setIsApplying: (isApplying: boolean) => void;
  setOrderDone: (id: string, done: boolean) => void;
  setChartedIds: (ids: string[]) => void;
  setHoveredItemId: (id: string | undefined) => void;
  setEditingId: (id: string | undefined) => void;
  addNote: (text: string) => void;
  /** The executor asks; the panel shows the picker; the answer resolves the promise. */
  askPick: (request: PickerRequest) => Promise<PickerResponse>;
  answerPick: (response: PickerResponse) => void;
}

/** The results of an analysis, cleared on a new visit. Planning again replaces them rather than clearing them. */
const RESULTS_CLEARED = {
  phase: 'input' as ScribePhase,
  analysisError: undefined,
  narrativeRuns: [] as NarrativeSegment[],
  recommendations: [] as ScribeRecommendation[],
  itemState: {} as Record<string, RecommendationItemState>,
  orderSuggestions: [] as OrderSuggestion[],
  ordersDone: {} as Record<string, boolean>,
  rejected: [] as RejectedAction[],
  notes: [] as string[],
  isApplying: false,
  hoveredItemId: undefined,
  editingId: undefined,
  pendingPick: null,
};

/** Nothing yet: no narrative, generated or drafted, and nothing to trace one to. */
const NARRATIVE_CLEARED = {
  narrativeGenerated: [] as NarrativeLine[],
  narrativeDraft: '',
  narrativeStatus: 'idle' as NarrativeStatus,
};

const SESSION_INITIAL = {
  ...RESULTS_CLEARED,
  transcript: '',
  transcriptSource: 'none' as TranscriptSource,
  sourceDocumentId: undefined,
  ...NARRATIVE_CLEARED,
  narrativeError: undefined,
  chartedIds: [] as string[],
};

export const useScribeRecommendationsStore = create<ScribeRecommendationsState>()(
  persist(
    (set, get) => ({
      isOpen: false,
      width: SCRIBE_PANEL_DEFAULT_WIDTH,
      encounterId: undefined,
      ...SESSION_INITIAL,

      open: () => set({ isOpen: true }),
      close: () => set({ isOpen: false }),
      setWidth: (width) => set({ width: clampScribePanelWidth(width) }),

      startSession: (encounterId) => {
        if (get().encounterId === encounterId) return;
        set({ encounterId, ...SESSION_INITIAL });
      },

      selectTranscriptDocument: async (doc, generate) => {
        const transcript = transcriptTextOf(doc);
        if (transcript === undefined || get().sourceDocumentId === doc.id) return;
        set({
          transcript,
          transcriptSource: 'document',
          sourceDocumentId: doc.id,
          analysisError: undefined,
          narrativeError: undefined,
        });
        // The recording pipeline writes the narrative onto the document as it transcribes, so most of the
        // time there is nothing to wait for.
        const stored = storedNarrativeOf(doc);
        if (stored) {
          set({ narrativeGenerated: stored, narrativeDraft: draftFromNarrative(stored), narrativeStatus: 'ready' });
          return;
        }
        await get().generateNarrative(generate);
      },

      generateNarrative: async (generate) => {
        const { transcript, encounterId, sourceDocumentId } = get();
        set({ narrativeStatus: 'generating', narrativeError: undefined });
        try {
          const lines = await generate(transcript, sourceDocumentId);
          // The visit or the transcript may have changed while the model was writing.
          if (get().encounterId !== encounterId || get().transcript !== transcript) return;
          // Regenerating replaces the draft: whatever the provider had typed over the old one goes with it.
          set({ narrativeGenerated: lines, narrativeDraft: draftFromNarrative(lines), narrativeStatus: 'ready' });
        } catch (error) {
          console.error('Narrative generation failed', error);
          if (get().encounterId !== encounterId || get().transcript !== transcript) return;
          set({
            narrativeStatus: 'error',
            // Zambda calls reject with a plain APIError object rather than an Error instance; keep the server's wording.
            narrativeError: getApiError({ error, defaultError: 'Could not write the narrative.' }),
          });
        }
      },
      setNarrativeDraft: (narrativeDraft) => set({ narrativeDraft }),

      analyze: async (analyzer) => {
        const { narrativeDraft, narrativeGenerated, transcript, encounterId } = get();
        set({ phase: 'analyzing', analysisError: undefined });
        try {
          const analysis = await analyzer(narrativeText(narrativeDraft), narrativeGenerated, transcript);
          // The visit may have changed while the model was thinking.
          if (get().encounterId !== encounterId) return;
          const itemState: Record<string, RecommendationItemState> = {};
          // Every recommendation starts checked and the provider unchecks what they don't want. A note row
          // starts as an addition — after whatever its field already says — never as a rewrite of it.
          analysis.recommendations.forEach(
            (rec) =>
              (itemState[rec.id] =
                rec.kind === 'hpi'
                  ? { selected: true, noteMode: 'append', status: 'idle' }
                  : { selected: true, status: 'idle' })
          );
          set({
            phase: 'ready',
            narrativeRuns: analysis.narrativeRuns,
            recommendations: analysis.recommendations,
            itemState,
            orderSuggestions: analysis.orderSuggestions,
            // Order suggestions are a to-do list, so they start unchecked.
            ordersDone: {},
            rejected: analysis.rejected,
            notes: analysis.notes,
          });
        } catch (error) {
          console.error('Scribe analysis failed', error);
          set({
            phase: 'input',
            // Zambda calls reject with a plain APIError object rather than an Error instance; keep the server's wording.
            analysisError: getApiError({ error, defaultError: 'Could not analyze the narrative.' }),
          });
        }
      },

      setSelected: (id, selected) =>
        set((state) => ({
          itemState: { ...state.itemState, [id]: withSelected(state, id, selected) },
        })),
      setManySelected: (ids, selected) =>
        set((state) => {
          const itemState = { ...state.itemState };
          ids.forEach((id) => {
            // Applied items are history, not a choice; leave them alone.
            if (itemState[id]?.status === 'applied') return;
            itemState[id] = withSelected(state, id, selected);
          });
          return { itemState };
        }),
      setNoteMode: (id, noteMode) =>
        set((state) => ({
          itemState: {
            ...state.itemState,
            [id]: { ...(state.itemState[id] ?? { status: 'idle' }), noteMode, selected: noteMode !== 'skip' },
          },
        })),
      updateRecommendation: (id, patch) =>
        set((state) => ({
          recommendations: state.recommendations.map((rec) =>
            rec.id === id ? ({ ...rec, ...patch } as ScribeRecommendation) : rec
          ),
          itemState: {
            ...state.itemState,
            [id]: {
              ...(state.itemState[id] ?? { selected: true, status: 'idle' }),
              edited: true,
              // An edited recommendation that previously failed or was skipped gets a fresh start.
              ...(state.itemState[id]?.status === 'error' || state.itemState[id]?.status === 'skipped'
                ? { status: 'idle', error: undefined, reason: undefined }
                : {}),
            },
          },
        })),
      setItemStatus: (id, status, message, flags) =>
        set((state) => ({
          itemState: {
            ...state.itemState,
            [id]: {
              ...(state.itemState[id] ?? { selected: true }),
              status,
              error: status === 'error' ? message : undefined,
              reason: status === 'skipped' ? message : undefined,
              note: status === 'applied' ? message : undefined,
              lowConfidence: status === 'applied' ? flags?.lowConfidence || undefined : undefined,
              // A skipped row is not going in, and says why; ticking it again is how the provider asks
              // for another try, so it comes out of the batch on its own — a note row through its mode.
              ...(status === 'skipped'
                ? { selected: false, ...(state.itemState[id]?.noteMode ? { noteMode: 'skip' as const } : {}) }
                : {}),
              ...(status === 'applied' ? { appliedAt: Date.now() } : {}),
            },
          },
        })),
      setIsApplying: (isApplying) => set({ isApplying }),
      setOrderDone: (id, done) => set((state) => ({ ordersDone: { ...state.ordersDone, [id]: done } })),
      setChartedIds: (ids) =>
        set((state) => {
          // Chart data re-renders often; only a real change should reach subscribers.
          const unchanged =
            state.chartedIds.length === ids.length && state.chartedIds.every((id, index) => id === ids[index]);
          return unchanged ? {} : { chartedIds: ids };
        }),
      setHoveredItemId: (hoveredItemId) => set({ hoveredItemId }),
      setEditingId: (editingId) => set({ editingId }),
      addNote: (text) =>
        set((state) => (text.trim() && !state.notes.includes(text) ? { notes: [...state.notes, text] } : {})),
      askPick: (request) => new Promise((resolve) => set({ pendingPick: { ...request, resolve } })),
      answerPick: (response) => {
        const { pendingPick } = get();
        set({ pendingPick: null });
        pendingPick?.resolve(response);
      },
    }),
    {
      name: 'ambient-scribe-recommendations-panel',
      storage: createJSONStorage(() => localStorage),
      // Only the layout preference survives a reload; a transcript and its narrative belong to one sitting.
      partialize: (state) => ({ isOpen: state.isOpen, width: state.width }),
    }
  )
);

/**
 * The item ticked or unticked. A note row is ticked through its mode: unticking it is `skip`, ticking it
 * back is `append` — unless it was already in as a rewrite, which a "select all" has no reason to undo.
 */
const withSelected = (
  state: Pick<ScribeRecommendationsState, 'recommendations' | 'itemState'>,
  id: string,
  selected: boolean
): RecommendationItemState => {
  const item = state.itemState[id] ?? { status: 'idle' as const };
  if (state.recommendations.find((rec) => rec.id === id)?.kind !== 'hpi') return { ...item, selected };
  const noteMode: NoteMode = !selected ? 'skip' : item.noteMode === 'replace' ? 'replace' : 'append';
  return { ...item, selected, noteMode };
};

/**
 * Opens the editor named by `editingKey` — unless another line already holds one. That click is
 * the click that closes the open editor (its click-away commits on the same event), and closing
 * is all it should do: the provider hasn't asked for this line yet, and a second click will open
 * it. Read straight from the store rather than from a subscription, because this runs in the same
 * event as the click-away that is about to clear it.
 */
export const startEditingUnlessAnotherIsOpen = (editingKey: string): void => {
  const { editingId, setEditingId } = useScribeRecommendationsStore.getState();
  if (editingId !== undefined && editingId !== editingKey) return;
  setEditingId(editingKey);
};

/**
 * The recommendation the provider is attending to: the one whose editor is open if any (in the list, or
 * in the narrative popover under its own key), else the one under the pointer. The transcript evidence
 * highlights this one's snippets.
 */
export const activeRecommendationId = (state: ScribeRecommendationsState): string | undefined => {
  const { editingId } = state;
  if (editingId !== undefined) {
    const editing = state.recommendations.find(
      (rec) => rec.id === editingId || narrativeEditingKey(rec.id) === editingId
    );
    if (editing) return editing.id;
  }
  return state.hoveredItemId;
};

/** Horizontal space the scribe UI currently occupies on the right edge (rail or open panel). */
export const useScribePanelOffset = (): number =>
  useScribeRecommendationsStore((state) => (state.isOpen ? state.width : SCRIBE_RAIL_WIDTH));
