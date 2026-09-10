import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { analyzeTranscript } from './fakeScribeAnalysis';
import { OrderSuggestion, RecommendationApplyStatus, ScribeRecommendation } from './types';

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

export interface RecommendationItemState {
  selected: boolean;
  status: RecommendationApplyStatus;
  error?: string;
}

interface ScribeRecommendationsState {
  isOpen: boolean;
  width: number;

  /** Encounter the transcript and recommendations belong to; switching visits resets them. */
  encounterId?: string;
  transcript: string;
  phase: ScribePhase;
  analysisError?: string;
  recommendations: ScribeRecommendation[];
  itemState: Record<string, RecommendationItemState>;
  orderSuggestions: OrderSuggestion[];
  ordersDone: Record<string, boolean>;
  isApplying: boolean;
  /** Recommendations the chart already holds, derived from live chart data. */
  chartedIds: string[];

  open: () => void;
  close: () => void;
  setWidth: (width: number) => void;

  startSession: (encounterId: string | undefined) => void;
  setTranscript: (transcript: string) => void;
  analyze: () => Promise<void>;
  /** Back to the transcript step, keeping the transcript text. */
  resetAnalysis: () => void;

  setSelected: (id: string, selected: boolean) => void;
  setManySelected: (ids: string[], selected: boolean) => void;
  updateRecommendation: (id: string, patch: Partial<ScribeRecommendation>) => void;
  setItemStatus: (id: string, status: RecommendationApplyStatus, error?: string) => void;
  setIsApplying: (isApplying: boolean) => void;
  setOrderDone: (id: string, done: boolean) => void;
  setChartedIds: (ids: string[]) => void;
}

const SESSION_INITIAL = {
  transcript: '',
  phase: 'input' as ScribePhase,
  analysisError: undefined,
  recommendations: [] as ScribeRecommendation[],
  itemState: {} as Record<string, RecommendationItemState>,
  orderSuggestions: [] as OrderSuggestion[],
  ordersDone: {} as Record<string, boolean>,
  isApplying: false,
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
      setTranscript: (transcript) => set({ transcript, analysisError: undefined }),

      analyze: async () => {
        const { transcript, encounterId } = get();
        set({ phase: 'analyzing', analysisError: undefined });
        try {
          const analysis = await analyzeTranscript(transcript);
          // The visit may have changed while the (fake) model was thinking.
          if (get().encounterId !== encounterId) return;
          const itemState: Record<string, RecommendationItemState> = {};
          // Every structured recommendation starts checked; the provider unchecks what they don't want.
          analysis.recommendations.forEach((rec) => (itemState[rec.id] = { selected: true, status: 'idle' }));
          set({
            phase: 'ready',
            recommendations: analysis.recommendations,
            itemState,
            orderSuggestions: analysis.orderSuggestions,
            // Order suggestions are a to-do list, so they start unchecked.
            ordersDone: {},
          });
        } catch (error) {
          set({
            phase: 'input',
            analysisError: error instanceof Error ? error.message : 'Could not analyze the transcript.',
          });
        }
      },

      resetAnalysis: () =>
        set({
          phase: 'input',
          analysisError: undefined,
          recommendations: [],
          itemState: {},
          orderSuggestions: [],
          ordersDone: {},
          isApplying: false,
        }),

      setSelected: (id, selected) =>
        set((state) => ({
          itemState: { ...state.itemState, [id]: { ...(state.itemState[id] ?? { status: 'idle' }), selected } },
        })),
      setManySelected: (ids, selected) =>
        set((state) => {
          const itemState = { ...state.itemState };
          ids.forEach((id) => {
            // Applied items are history, not a choice; leave them alone.
            if (itemState[id]?.status === 'applied') return;
            itemState[id] = { ...(itemState[id] ?? { status: 'idle' }), selected };
          });
          return { itemState };
        }),
      updateRecommendation: (id, patch) =>
        set((state) => ({
          recommendations: state.recommendations.map((rec) =>
            rec.id === id ? ({ ...rec, ...patch } as ScribeRecommendation) : rec
          ),
          // An edited recommendation that previously failed gets a fresh start.
          itemState:
            state.itemState[id]?.status === 'error'
              ? { ...state.itemState, [id]: { ...state.itemState[id], status: 'idle', error: undefined } }
              : state.itemState,
        })),
      setItemStatus: (id, status, error) =>
        set((state) => ({
          itemState: {
            ...state.itemState,
            [id]: { ...(state.itemState[id] ?? { selected: true }), status, error },
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
    }),
    {
      name: 'ambient-scribe-recommendations-panel',
      storage: createJSONStorage(() => localStorage),
      // Only the layout preference survives a reload; a transcript belongs to one sitting.
      partialize: (state) => ({ isOpen: state.isOpen, width: state.width }),
    }
  )
);

/** Horizontal space the scribe UI currently occupies on the right edge (rail or open panel). */
export const useScribePanelOffset = (): number =>
  useScribeRecommendationsStore((state) => (state.isOpen ? state.width : SCRIBE_RAIL_WIDTH));
