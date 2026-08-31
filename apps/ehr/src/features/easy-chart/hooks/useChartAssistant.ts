// The assistant's turn loop: message → plan → execute → settled plan card in the thread.
//
// Everything hard lives elsewhere on purpose. The endpoint returns typed actions and every guard has
// already run; `runPlan` settles each step; the provenance store records who wrote what. This hook is
// the state machine that connects them and keeps the widget responsive while it runs.
//
// Responsiveness is a requirement, not a nicety: the provider can keep typing, queued messages send
// when the assistant is free, and a status line with elapsed time makes long waits visible instead of
// silent. The elapsed counter appears only once a call runs long — a timer from t=0 makes every call
// feel slow.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useOystehrAPIClient } from 'src/features/visits/shared/hooks/useOystehrAPIClient';
import {
  collectResourceIds,
  diffCreatedResourceIds,
} from 'src/features/visits/shared/stores/appointment/chart-resource-ids';
import { ConversationTurn, ModelUsage, PlannedAction, ReviewSuggestion } from 'utils/lib/easy-chart/api';
import { GetChartDataResponse } from 'utils/lib/types/api/chart-data/get-chart-data.types';
import { buildChartSnapshot } from '../executor/chartSnapshot';
import { runPlan } from '../executor/runPlan';
import { mergeTemplateReconciliation, templateStepIndex } from '../executor/template-reconcile';
import {
  Catalogue,
  ChartSnapshot,
  ChartWriter,
  ExecutionMode,
  HandlerContext,
  PickerRequest,
  PickerResponse,
  PlanStep,
} from '../executor/types';

/** How long a call must run before the elapsed counter appears. */
const ELAPSED_VISIBLE_AFTER_MS = 4000;
/** The rolling window the endpoint is sent. Capped server-side too; this keeps the request small. */
const HISTORY_TURNS = 6;

export type ThreadEntry =
  | { id: number; role: 'provider'; text: string }
  | { id: number; role: 'assistant'; kind: 'reply' | 'provider-note' | 'unknown'; text: string }
  | { id: number; role: 'assistant'; kind: 'plan'; steps: PlanStep[] }
  | { id: number; role: 'assistant'; kind: 'review'; suggestions: ReviewSuggestion[] }
  | { id: number; role: 'assistant'; kind: 'error'; text: string };

/**
 * A thread entry before it is given an id.
 *
 * DISTRIBUTIVE on purpose. A bare `Omit<ThreadEntry, 'id'>` collapses the union into the properties its
 * members SHARE — which is `role` alone — so `kind` and `text` become unknown properties and every
 * `push` fails to typecheck. `T extends any ? Omit<T, 'id'> : never` omits from each member instead.
 */
export type NewThreadEntry = ThreadEntry extends infer T ? (T extends ThreadEntry ? Omit<T, 'id'> : never) : never;

export interface AssistantState {
  thread: ThreadEntry[];
  /** The plan currently running, so the current step can be kept in view. */
  liveSteps: PlanStep[];
  /** `reviewing` is the SECOND pass — the model reading the finished note back against the narrative. */
  status: 'idle' | 'planning' | 'executing' | 'reviewing';
  /** Seconds elapsed on the current call, once it has run long enough to be worth showing. */
  elapsedSeconds: number | null;
  /** Messages typed while the assistant was busy. They send when it frees up. */
  queued: string[];
  usage: ModelUsage[];
  pendingPick: (PickerRequest & { resolve: (response: PickerResponse) => void }) | null;
}

export interface UseChartAssistantOptions {
  encounterId: string;
  chartData: GetChartDataResponse | undefined;
  catalogue: Catalogue;
  writer: ChartWriter;
  /**
   * Refetch the chart after a turn writes, so the next turn's snapshot knows what landed.
   *
   * Returns the fresh chart, because the post-template reconciliation has to ACT on it within the same
   * turn — reading it back off a render that has not happened yet is a race.
   */
  refetchChart: () => Promise<GetChartDataResponse | undefined>;
  /**
   * Called with each step's created ids, so a surface that attributes rows to the assistant can do so.
   *
   * OPTIONAL: the docked widget renders the thread and nothing else, and the settled plan card in the
   * thread already says what landed. A surface that tints the rows it wrote — which the note itself will,
   * once it edits inline — passes this and keys its provenance off the ids.
   */
  onStepsSettled?: (steps: PlanStep[], narrative: string) => void;
  /** True for a signed visit: the composer is disabled and nothing may be sent. */
  readOnly?: boolean;
}

export interface ChartAssistant extends AssistantState {
  send: (message: string) => void;
  reset: () => void;
  resetUsage: () => void;
  answerPick: (response: PickerResponse) => void;
}

export function useChartAssistant(options: UseChartAssistantOptions): ChartAssistant {
  const apiClient = useOystehrAPIClient();
  const [thread, setThread] = useState<ThreadEntry[]>([]);
  const [liveSteps, setLiveSteps] = useState<PlanStep[]>([]);
  const [status, setStatus] = useState<AssistantState['status']>('idle');
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [now, setNow] = useState(() => 0);
  const [queued, setQueued] = useState<string[]>([]);
  const [usage, setUsage] = useState<ModelUsage[]>([]);
  const [pendingPick, setPendingPick] = useState<AssistantState['pendingPick']>(null);

  const nextId = useRef(1);
  const history = useRef<ConversationTurn[]>([]);
  // Read inside the async turn, so a chart that refetched mid-turn is not stale by the next step.
  const chartRef = useRef(options.chartData);
  chartRef.current = options.chartData;
  const busy = status !== 'idle';

  // Tick only while a call is running, and only after it has run long enough to be worth showing.
  useEffect(() => {
    if (startedAt == null) return;
    const timer = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(timer);
  }, [startedAt]);

  const elapsedSeconds = useMemo(() => {
    if (startedAt == null) return null;
    const elapsed = now - startedAt;
    return elapsed >= ELAPSED_VISIBLE_AFTER_MS ? Math.floor(elapsed / 1000) : null;
  }, [startedAt, now]);

  const push = useCallback((entry: NewThreadEntry): void => {
    setThread((current) => [...current, { ...entry, id: nextId.current++ } as ThreadEntry]);
  }, []);

  const addUsage = useCallback((incoming: ModelUsage[]): void => {
    setUsage((current) => {
      const merged = new Map(current.map((entry) => [`${entry.provider}:${entry.model}`, { ...entry }]));
      for (const entry of incoming) {
        const key = `${entry.provider}:${entry.model}`;
        const existing = merged.get(key);
        if (!existing) merged.set(key, { ...entry });
        else {
          existing.inputTokens += entry.inputTokens;
          existing.outputTokens += entry.outputTokens;
          existing.cacheReadTokens += entry.cacheReadTokens;
          existing.cacheWriteTokens += entry.cacheWriteTokens;
          existing.thinkingTokens += entry.thinkingTokens;
          existing.calls += entry.calls;
        }
      }
      return [...merged.values()];
    });
  }, []);

  const answerPick = useCallback((response: PickerResponse): void => {
    setPendingPick((pick) => {
      pick?.resolve(response);
      return null;
    });
  }, []);

  const runTurn = useCallback(
    async (message: string): Promise<void> => {
      if (!apiClient) {
        push({ role: 'assistant', kind: 'error', text: 'The API client is not ready yet — try again in a moment.' });
        return;
      }

      push({ role: 'provider', text: message });
      setStatus('planning');
      setStartedAt(Date.now());
      setNow(Date.now());

      try {
        const response = await apiClient.easyChartPlan({
          narrative: message,
          encounterId: options.encounterId,
          // The chart is NOT sent. The zambda reads it by encounterId — get-chart-data twice, the same pair
          // the visit-note PDF uses — because a client-assembled summary could only ever describe the
          // sections the client's own read layer happened to fetch, and ROS, vitals and placed orders were
          // silently missing from it.
          // Every turn after the first is incremental: the chart state is the truth about what exists,
          // and without this the model happily re-emits what it already charted.
          incremental: history.current.length > 0,
          history: history.current.slice(-HISTORY_TURNS),
        });

        addUsage(response.usage);

        // A rejected action is a step the provider must still see: it was voiced, and it did not land.
        // MUTABLE: the post-template reconciliation is a second planner call, and its rejections are
        // steps the provider must see for the same reason the first call's are — they were voiced and
        // they did not land.
        const rejectedSteps: PlanStep[] = response.rejected.map((rejection, index) => ({
          index: -1 - index,
          action: { kind: rejection.kind, display: rejection.display } as PlannedAction,
          label: rejection.display ? `${rejection.kind}: ${rejection.display}` : rejection.kind,
          outcome: { status: 'skipped', reason: rejection.reason },
        }));

        if (response.actions.length === 0 && rejectedSteps.length === 0) {
          push({
            role: 'assistant',
            kind: 'reply',
            text: "I couldn't find anything chartable in that. Try naming the item you want added or changed.",
          });
          return;
        }

        setStatus('executing');
        // One typed request is interactive — the provider is watching, so ambiguity asks. A pasted
        // narrative runs in bulk, where a picker per ambiguous item is unusable.
        const mode: ExecutionMode = response.actions.length > 3 ? 'bulk' : 'interactive';

        const contextFor = (chart: ChartSnapshot): HandlerContext => ({
          mode,
          encounterId: options.encounterId,
          catalogue: options.catalogue,
          writer: options.writer,
          chart,
          ask: (request) => new Promise((resolve) => setPendingPick({ ...request, resolve })),
          say: (text, kind) => push({ role: 'assistant', kind, text }),
        });
        const stepCallbacks = {
          onStepStart: (step: PlanStep) => setLiveSteps((current) => replaceStep(current, step)),
          onStepSettled: (step: PlanStep) => setLiveSteps((current) => replaceStep(current, step)),
        };

        // THE PLAN SPLITS AT apply-template, and only there.
        //
        // A template writes across many sections at once, and this plan was built without knowing what:
        // the planner is shown template TITLES, never contents. That leaves the rest of the plan wrong in
        // two ways at once — steps that now duplicate what the template charted, and the steps that should
        // answer it (remove the normal the provider contradicted, remove a default diagnosis this visit
        // does not support) which were never emitted because nothing knew there would be anything to
        // answer. Re-reading the chart fixes the first; only a second planner call can produce the second.
        //
        // So: run up to and including the template, re-read, reconcile, and run the merged remainder.
        const templateAt = templateStepIndex(response.actions);
        let steps: PlanStep[];

        if (templateAt < 0) {
          ({ steps } = await runPlan(
            response.actions,
            contextFor(buildChartSnapshot(chartRef.current)),
            stepCallbacks
          ));
        } else {
          // Snapshotted BEFORE the template runs, so the re-read below can say which rows it added — see
          // the attribution note where the diff is taken.
          const idsBeforeTemplate = collectResourceIds(chartRef.current);
          const head = await runPlan(
            response.actions.slice(0, templateAt + 1),
            contextFor(buildChartSnapshot(chartRef.current)),
            stepCallbacks
          );
          const pending = response.actions.slice(templateAt + 1);
          const templateApplied = head.steps[templateAt]?.outcome?.status === 'applied';

          if (!templateApplied) {
            // No template landed — it matched nothing, or the write failed. There is nothing to reconcile
            // against, and spending a model call to be told so would just make a failed step slower.
            const tail = await runPlan(pending, contextFor(head.chart), {
              ...stepCallbacks,
              indexOffset: templateAt + 1,
            });
            steps = [...head.steps, ...tail.steps];
          } else {
            // The re-read is not optional: apply-template reports how many resources it created and not
            // WHAT they are, so `advanceSnapshot` has nothing to record and every later step would resolve
            // against a chart missing everything the template wrote.
            const fresh = await options.refetchChart();
            const freshChart = buildChartSnapshot(fresh);

            // ATTRIBUTE THE TEMPLATE'S ROWS TO THE TEMPLATE.
            //
            // A template charts a diagnosis, an E&M level and a screenful of exam findings without the
            // provider having said a word, and it is the most common way a diagnosis reaches the chart at
            // all. Unattributed, those rows are indistinguishable from ones the provider entered
            // themselves, so the one affordance that would catch a wrong default — "this was inferred,
            // check it" — is exactly the one they bypass.
            //
            // The ids can only be known here: apply-template reports its warnings and nothing else, so the
            // before/after diff over the re-read chart is the only thing that says what it wrote. Reported
            // as INFERRED, not sourced, because a template's contents come from its title, never from the
            // narrative.
            const templateIds = diffCreatedResourceIds(idsBeforeTemplate, collectResourceIds(fresh));
            const templateStep = head.steps[templateAt];
            if (templateStep?.outcome?.status === 'applied' && templateIds.length > 0) {
              templateStep.outcome = {
                ...templateStep.outcome,
                createdResourceIds: templateIds,
                inferredResourceIds: templateIds,
              };
            }

            let reconciliation: PlannedAction[] = [];
            try {
              const reconcile = await apiClient.easyChartPlan({
                narrative: message,
                encounterId: options.encounterId,
                incremental: true,
                // Withholds the practice's template list AND force-includes the reconciliation
                // instruction — see ChartPlanRequest.reconcileTemplate for why both are needed.
                reconcileTemplate: true,
                history: history.current.slice(-HISTORY_TURNS),
              });
              addUsage(reconcile.usage);
              reconciliation = reconcile.actions;
              for (const rejection of reconcile.rejected) {
                rejectedSteps.push({
                  index: -1 - rejectedSteps.length,
                  action: { kind: rejection.kind, display: rejection.display } as PlannedAction,
                  label: rejection.display ? `${rejection.kind}: ${rejection.display}` : rejection.kind,
                  outcome: { status: 'skipped', reason: rejection.reason },
                });
              }
            } catch (error) {
              // Deliberate degrade, and a LOUD one. The rest of the plan still runs against the re-read
              // chart, so nothing duplicates — but the reconciliation is what would have taken back the
              // template's wrong defaults, and a provider who is not told that stays unaware the note may
              // assert a normal they contradicted.
              console.error('[easy-chart] post-template reconciliation failed', error);
              push({
                role: 'assistant',
                kind: 'provider-note',
                text:
                  'The template was applied, but the pass that checks its defaults against your dictation ' +
                  'could not run. Check the exam findings and the diagnosis before signing.',
              });
            }

            const remainder = mergeTemplateReconciliation({ pending, reconciliation, chart: freshChart });
            const tail = await runPlan(remainder, contextFor(freshChart), {
              ...stepCallbacks,
              indexOffset: templateAt + 1,
            });
            steps = [...head.steps, ...tail.steps];
          }
        }

        const allSteps = [...steps, ...rejectedSteps];
        push({ role: 'assistant', kind: 'plan', steps: allSteps });
        options.onStepsSettled?.(steps, message);

        // Summarise the assistant's turn, quote the provider's. What they SAID is evidence; what the
        // assistant DID is already in the chart state, so one line per action is enough.
        const turns: ConversationTurn[] = [
          { role: 'provider', text: message },
          {
            role: 'assistant',
            charted: allSteps.filter((s) => s.outcome?.status === 'applied').map((s) => s.label),
            skipped: allSteps.filter((s) => s.outcome?.status !== 'applied').map((s) => s.label),
          },
        ];
        history.current = [...history.current, ...turns].slice(-HISTORY_TURNS * 2);

        await options.refetchChart();

        // THE SECOND LOOK, and only after a BULK run. A pasted narrative is where the first pass has most
        // to miss; a one-line correction is not worth a second model call. Its findings are pushed as
        // QUESTIONS with their reasoning — never applied — because the review pass reasons about a note it
        // did not write, and the provider decides.
        if (mode === 'bulk') {
          setStatus('reviewing');
          try {
            const review = await apiClient.easyChartReview({
              narrative: message,
              encounterId: options.encounterId,
            });
            addUsage(review.usage);
            if (review.suggestions.length > 0) {
              push({ role: 'assistant', kind: 'review', suggestions: review.suggestions });
            }
          } catch (error) {
            // A failed review must not read as a failed CHARTING turn — the note was written. Say what
            // did not happen, and no more.
            console.error('[easy-chart] review pass failed', error);
            push({
              role: 'assistant',
              kind: 'provider-note',
              text: 'The note was charted, but the second-look review could not run. Review it yourself before signing.',
            });
          }
        }
      } catch (error) {
        console.error('[easy-chart] turn failed', error);
        push({
          role: 'assistant',
          kind: 'error',
          text: error instanceof Error ? error.message : 'That request failed. Please try again.',
        });
      } finally {
        setLiveSteps([]);
        setStatus('idle');
        setStartedAt(null);
      }
    },
    [apiClient, options, push, addUsage]
  );

  // Queued messages send when the assistant frees up.
  useEffect(() => {
    if (busy || queued.length === 0) return;
    const [next, ...rest] = queued;
    setQueued(rest);
    void runTurn(next);
  }, [busy, queued, runTurn]);

  const send = useCallback(
    (message: string): void => {
      const trimmed = message.trim();
      if (!trimmed || options.readOnly) return;
      if (busy) setQueued((current) => [...current, trimmed]);
      else void runTurn(trimmed);
    },
    [busy, options.readOnly, runTurn]
  );

  const reset = useCallback((): void => {
    setThread([]);
    history.current = [];
  }, []);

  return {
    thread,
    liveSteps,
    status,
    elapsedSeconds,
    queued,
    usage,
    pendingPick,
    send,
    reset,
    resetUsage: () => setUsage([]),
    answerPick,
  };
}

function replaceStep(steps: PlanStep[], step: PlanStep): PlanStep[] {
  const existing = steps.findIndex((candidate) => candidate.index === step.index);
  if (existing === -1) return [...steps, step];
  const next = [...steps];
  next[existing] = step;
  return next;
}
