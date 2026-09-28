import { DocumentReference } from 'fhir/r4b';
import { PickerRequest, PickerResponse } from 'src/features/easy-chart/executor/types';
import { ChartPlanResponse, NarrativeLine, RejectedAction } from 'utils/lib/easy-chart/api';
import { storedNarrativeOf, transcriptTextOf } from 'utils/lib/easy-chart/narrative';
import { getApiError } from 'utils/lib/helpers/oystehrApi';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { draftFromNarrative, narrativeText } from './narrativeLines';
import { NoteMode, RecommendationApplyStatus, ScribeAnalysis, ScribeRecommendation } from './types';

const SCRIBE_PANEL_MIN_WIDTH = 340;
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
 * Calls the plan endpoint and maps its answer to recommendations. Split in two because the plan is read ahead
 * when a transcript is picked (see `planAhead`) and mapped only on the click.
 */
export interface ScribeAnalyzer {
  plan: (narrative: string, generated: NarrativeLine[], transcript: string) => Promise<ChartPlanResponse>;
  /** Pure, so a plan read ahead maps to the same analysis as a live one. */
  analysisOf: (
    plan: ChartPlanResponse,
    narrative: string,
    generated: NarrativeLine[],
    transcript: string
  ) => ScribeAnalysis;
}

/**
 * A plan read ahead of the "Plan note" click for one transcript document. The click reuses it only while the
 * narrative is still the text it was read for; nothing is shown before the click.
 */
export interface SpeculativePlan {
  /** The narrative text the plan was read for; an edited draft invalidates the entry. */
  narrative: string;
  plan?: ChartPlanResponse;
  /** Set while in flight; a rejection drops the entry and the click plans live. */
  promise?: Promise<ChartPlanResponse>;
}

/**
 * Calls the narrative endpoint. `documentId` names the transcript document the text came from, so the server
 * can store the narrative on it.
 */
export type NarrativeGenerator = (transcript: string, documentId?: string) => Promise<NarrativeLine[]>;

/**
 * A transcript document already on the visit (an ambient recording, the intake chat), or none yet.
 * Transcripts are read-only here; the provider edits the narrative.
 */
export type TranscriptSource = 'document' | 'none';

export type NarrativeStatus = 'idle' | 'generating' | 'ready' | 'error';

export interface RecommendationItemState {
  selected: boolean;
  /**
   * Set only on `hpi` rows: append to the field, replace it, or skip. `selected` mirrors
   * `noteMode !== 'skip'`, so the two are always written together.
   */
  noteMode?: NoteMode;
  status: RecommendationApplyStatus;
  /** Why the write failed, for a row in `error`. */
  error?: string;
  /** Why nothing was written, for a row in `skipped` ("already on the chart", "no matching allergy"). */
  reason?: string;
  /** Executor remark on an `applied` row, e.g. a demoted primary or an auto-pick among near matches. */
  note?: string;
  /** The executor picked or inferred this rather than matching it outright; the row says so. */
  lowConfidence?: boolean;
  /** The provider has changed it, so the AI's wording no longer applies. */
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
  /** The narrative as generated, kept so its sentences can be traced to their transcript snippets. */
  narrativeGenerated: NarrativeLine[];
  /** The narrative as the provider edits it, as one paragraph. */
  narrativeDraft: string;
  narrativeStatus: NarrativeStatus;
  narrativeError?: string;
  /** Plans read ahead of the click, keyed by transcript document id. In memory only. */
  speculativePlans: Record<string, SpeculativePlan>;
  phase: ScribePhase;
  analysisError?: string;
  recommendations: ScribeRecommendation[];
  itemState: Record<string, RecommendationItemState>;
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
   * The one open row editor, held here so opening another closes (and saves) the first. Keyed by row, not
   * item, because an item can show both in the list and in the narrative popover.
   */
  editingId?: string;
  pendingPick: PendingPick | null;

  open: () => void;
  close: () => void;
  setWidth: (width: number) => void;

  startSession: (encounterId: string | undefined) => void;
  /**
   * Uses the document's stored narrative or generates one, then reads the plan ahead. Reselecting the current
   * document is a no-op, so edits survive.
   */
  selectTranscriptDocument: (
    doc: DocumentReference,
    generate: NarrativeGenerator,
    analyzer: ScribeAnalyzer
  ) => Promise<void>;
  /** Clears the transcript and its narrative; suggestions already on screen stay. */
  clearTranscriptSelection: () => void;
  /** Reselects a document after its transcript was reprocessed; its new narrative replaces the draft. */
  reloadTranscriptDocument: (
    doc: DocumentReference,
    generate: NarrativeGenerator,
    analyzer: ScribeAnalyzer
  ) => Promise<void>;
  /** Regenerates the narrative, replacing the plan read ahead for the old text. */
  generateNarrative: (generate: NarrativeGenerator, analyzer: ScribeAnalyzer) => Promise<void>;
  setNarrativeDraft: (text: string) => void;
  /**
   * Fetches the plan for the current narrative in the background, unless one for that exact text is held or
   * in flight. `analyze` picks it up on the click.
   */
  planAhead: (analyzer: ScribeAnalyzer) => void;
  analyze: (analyzer: ScribeAnalyzer) => Promise<void>;

  setSelected: (id: string, selected: boolean) => void;
  setManySelected: (ids: string[], selected: boolean) => void;
  /** `skip` unticks a note row; `append` and `replace` tick it. */
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
  setChartedIds: (ids: string[]) => void;
  setHoveredItemId: (id: string | undefined) => void;
  setEditingId: (id: string | undefined) => void;
  addNote: (text: string) => void;
  /** The executor asks; the panel shows the picker; the answer resolves the promise. */
  askPick: (request: PickerRequest) => Promise<PickerResponse>;
  answerPick: (response: PickerResponse) => void;
}

/** Analysis results, reset on a new visit. Planning again replaces them rather than clearing them. */
const RESULTS_CLEARED = {
  phase: 'input' as ScribePhase,
  analysisError: undefined,
  recommendations: [] as ScribeRecommendation[],
  itemState: {} as Record<string, RecommendationItemState>,
  rejected: [] as RejectedAction[],
  notes: [] as string[],
  isApplying: false,
  hoveredItemId: undefined,
  editingId: undefined,
  pendingPick: null,
};

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
  speculativePlans: {} as Record<string, SpeculativePlan>,
  chartedIds: [] as string[],
};

const withoutSpeculativePlan = (
  plans: Record<string, SpeculativePlan>,
  documentId: string
): Record<string, SpeculativePlan> => {
  const { [documentId]: _dropped, ...rest } = plans;
  return rest;
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

      selectTranscriptDocument: async (doc, generate, analyzer) => {
        const transcript = transcriptTextOf(doc);
        if (transcript === undefined || get().sourceDocumentId === doc.id) return;
        set({
          transcript,
          transcriptSource: 'document',
          sourceDocumentId: doc.id,
          analysisError: undefined,
          narrativeError: undefined,
        });
        // The recording pipeline usually stores the narrative on the document already.
        const stored = storedNarrativeOf(doc);
        if (stored) {
          set({ narrativeGenerated: stored, narrativeDraft: draftFromNarrative(stored), narrativeStatus: 'ready' });
          get().planAhead(analyzer);
          return;
        }
        await get().generateNarrative(generate, analyzer);
      },

      clearTranscriptSelection: () =>
        set({
          transcript: '',
          transcriptSource: 'none',
          sourceDocumentId: undefined,
          ...NARRATIVE_CLEARED,
          narrativeError: undefined,
          analysisError: undefined,
        }),

      reloadTranscriptDocument: async (doc, generate, analyzer) => {
        set((state) => ({
          sourceDocumentId: undefined,
          speculativePlans: doc.id ? withoutSpeculativePlan(state.speculativePlans, doc.id) : state.speculativePlans,
        }));
        await get().selectTranscriptDocument(doc, generate, analyzer);
      },

      generateNarrative: async (generate, analyzer) => {
        const { transcript, encounterId, sourceDocumentId } = get();
        set({ narrativeStatus: 'generating', narrativeError: undefined });
        try {
          const lines = await generate(transcript, sourceDocumentId);
          // The visit or the transcript may have changed while the model was writing.
          if (get().encounterId !== encounterId || get().transcript !== transcript) return;
          // Regenerating discards the provider's edits and the plan read ahead for the old text.
          set((state) => ({
            narrativeGenerated: lines,
            narrativeDraft: draftFromNarrative(lines),
            narrativeStatus: 'ready',
            ...(sourceDocumentId
              ? { speculativePlans: withoutSpeculativePlan(state.speculativePlans, sourceDocumentId) }
              : {}),
          }));
          get().planAhead(analyzer);
        } catch (error) {
          console.error('Narrative generation failed', error);
          if (get().encounterId !== encounterId || get().transcript !== transcript) return;
          set({
            narrativeStatus: 'error',
            // Zambda calls reject with a plain APIError object, not an Error; keep the server's wording.
            narrativeError: getApiError({ error, defaultError: 'Could not write the narrative.' }),
          });
        }
      },
      setNarrativeDraft: (narrativeDraft) =>
        set((state) => {
          if (narrativeDraft === state.narrativeDraft) return {};
          // A real edit invalidates the plan read ahead; opening the editor without changes keeps it.
          const { sourceDocumentId } = state;
          return sourceDocumentId && state.speculativePlans[sourceDocumentId]
            ? { narrativeDraft, speculativePlans: withoutSpeculativePlan(state.speculativePlans, sourceDocumentId) }
            : { narrativeDraft };
        }),

      planAhead: (analyzer) => {
        const { sourceDocumentId, narrativeStatus, narrativeDraft, narrativeGenerated, transcript, encounterId } =
          get();
        if (!sourceDocumentId || narrativeStatus !== 'ready') return;
        const narrative = narrativeText(narrativeDraft);
        if (!narrative) return;
        // Already held or in flight for this exact text.
        if (get().speculativePlans[sourceDocumentId]?.narrative === narrative) return;
        // The draft is still the generated text here, so the analyzer sends no corrections.
        const promise = analyzer.plan(narrative, narrativeGenerated, transcript);
        const entry: SpeculativePlan = { narrative, promise };
        set((state) => ({ speculativePlans: { ...state.speculativePlans, [sourceDocumentId]: entry } }));
        // Ignore the answer if an edit or a visit switch has discarded this entry since.
        const stillCurrent = (): boolean =>
          get().encounterId === encounterId && get().speculativePlans[sourceDocumentId] === entry;
        promise.then(
          (plan) => {
            if (!stillCurrent()) return;
            set((state) => ({
              speculativePlans: { ...state.speculativePlans, [sourceDocumentId]: { narrative, plan } },
            }));
          },
          (error) => {
            // Not surfaced; the click plans live instead. PHI: log only the error message.
            console.error('Read-ahead plan failed:', getApiError({ error, defaultError: 'unknown error' }));
            if (!stillCurrent()) return;
            set((state) => ({ speculativePlans: withoutSpeculativePlan(state.speculativePlans, sourceDocumentId) }));
          }
        );
      },

      analyze: async (analyzer) => {
        const { narrativeDraft, narrativeGenerated, transcript, encounterId, sourceDocumentId } = get();
        const narrative = narrativeText(narrativeDraft);
        set({ phase: 'analyzing', analysisError: undefined });
        try {
          // Reuse the plan read ahead for this exact text; plan live if there is none or it failed.
          const ahead = sourceDocumentId ? get().speculativePlans[sourceDocumentId] : undefined;
          const reusable = ahead?.narrative === narrative ? ahead : undefined;
          const plan =
            reusable?.plan ??
            (await reusable?.promise?.catch(() => undefined)) ??
            (await analyzer.plan(narrative, narrativeGenerated, transcript));
          // The visit may have changed while the model was thinking.
          if (get().encounterId !== encounterId) return;
          const analysis = analyzer.analysisOf(plan, narrative, narrativeGenerated, transcript);
          const itemState: Record<string, RecommendationItemState> = {};
          // Everything starts checked; note rows start in append mode, never replace.
          analysis.recommendations.forEach(
            (rec) =>
              (itemState[rec.id] =
                rec.kind === 'hpi'
                  ? { selected: true, noteMode: 'append', status: 'idle' }
                  : { selected: true, status: 'idle' })
          );
          set({
            phase: 'ready',
            recommendations: analysis.recommendations,
            itemState,
            rejected: analysis.rejected,
            notes: analysis.notes,
          });
        } catch (error) {
          console.error('Scribe analysis failed', error);
          set({
            phase: 'input',
            // Zambda calls reject with a plain APIError object, not an Error; keep the server's wording.
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
              // A skipped row leaves the batch; ticking it again retries it.
              ...(status === 'skipped'
                ? { selected: false, ...(state.itemState[id]?.noteMode ? { noteMode: 'skip' as const } : {}) }
                : {}),
              ...(status === 'applied' ? { appliedAt: Date.now() } : {}),
            },
          },
        })),
      setIsApplying: (isApplying) => set({ isApplying }),
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

/** Note rows are ticked through their mode; ticking one back keeps an existing `replace`. */
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
 * A click while another editor is open only closes that one (its click-away commits on the same event).
 * Reads the store directly because it runs in the same event as that click-away.
 */
export const startEditingUnlessAnotherIsOpen = (editingKey: string): void => {
  const { editingId, setEditingId } = useScribeRecommendationsStore.getState();
  if (editingId !== undefined && editingId !== editingKey) return;
  setEditingId(editingKey);
};

/** Horizontal space the scribe UI currently occupies on the right edge (rail or open panel). */
export const useScribePanelOffset = (): number =>
  useScribeRecommendationsStore((state) => (state.isOpen ? state.width : SCRIBE_RAIL_WIDTH));
