import { captureException } from '@sentry/react';
import type { Encounter } from 'fhir/r4b';
import { enqueueSnackbar } from 'notistack';
import { useEffect, useRef, useState } from 'react';
import { useApiClients } from 'src/hooks/useAppClients';
import {
  CPTCodeDTO,
  CreateLabPaymentMethod,
  DataEntryTestItem,
  DiagnosisDTO,
  DispositionDTO,
  DispositionType,
  EasyChartAgentIntent,
  EasyChartPlannerStep,
  EasyChartTokenUsage,
  type ExamObservationDTO,
  fahrenheitToCelsius,
  GetChartDataResponse,
  LabPaymentMethod,
  LBS_IN_KG,
  mapDispositionTypeToLabel,
  ModifiedOrderingLocation,
  OrderableItemSearchResult,
  ProcedureDTO,
  ProcedureQuickPickData,
  rosField,
  RosFindingState,
  roundTemperatureForSave,
  SaveChartDataRequest,
  VitalFieldNames,
  VitalsObservationDTO,
} from 'utils';
import {
  applyTemplate,
  createExternalLabOrder,
  createInHouseLabOrder,
  createNursingOrder,
  createRadiologyOrder,
  easyChartAgent,
  easyChartPlanner,
  easyChartReview,
  listTemplates,
} from '../../api/api';
import { useOystehrAPIClient } from '../visits/shared/hooks/useOystehrAPIClient';
import {
  AddExamFindingIntent,
  AddProcedureIntent,
  AddRosFindingIntent,
  AddSearchIntent,
  AiChartedMeta,
  AiField,
  ApplyTemplateIntent,
  ChartNoteKey,
  ConvStep,
  EasyChartLabOrder,
  ExamRemoveItem,
  PROCEDURE_VERIFY_FIELDS,
  ProcedureProvenance,
  RemoveExamFindingIntent,
  RemoveIntent,
  RemoveMatch,
  SearchResult,
  TemplateMatch,
  UpdateProcedureIntent,
} from './chart-types';
import {
  EXAM_LEAVES,
  ExamLeaf,
  FIELD_TO_SECTION_LABEL,
  ROS_LEAVES,
  RosLeaf,
  SECTION_TO_COMMENT_FIELD,
} from './exam-ros-catalog';
import {
  ambiguousCluster,
  applyProcedureUpdates,
  AUTO_CHART_KINDS,
  buildExamRemoveItems,
  buildIntentPayload,
  carrySwapPrimary,
  chartedItemDisplay,
  collectResourceIds,
  fetchEasyChartData,
  findExamLeafMatchesScored,
  findExamRemoveMatchesScored,
  findLabCatalogMatchesScored,
  findProcedureMatches,
  findProceduresToUpdate,
  findRemoveMatches,
  findRosLeafMatchesScored,
  findRosRemoveMatchesScored,
  findTemplateMatches,
  inferExamSectionLabel,
  isRemoveIntent,
  KIND_TO_FIELD,
  matchRadiologyStudy,
  pickPrimaryPromotion,
  preferredExamLeaf,
  procedureDtoFromQuickPick,
  rosObsLabel,
  runIntentSearch,
  strengthCompatible,
  synthAddIntent,
} from './intent-logic';

// The assistant layer of the easy-chart page: the conversation state machine (conv + thread), the
// per-intent dispatcher and all its pickers, plan execution (step advance + post-template
// re-plan), the post-completion review pass, and the refine-bar send path. It sits on top of the
// chart-data and AI-provenance layers, which are passed in — nothing here fetches or mutates the
// chart except through those functions. The one page-side dependency flowing IN is the procedure
// quick-pick/value-set config (page-owned state, shared with the render).
// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export function useChartAssistant({
  encounterId,
  chartData,
  chartDataRef,
  setChartData,
  saveAndMerge,
  mergeSaveResponse,
  deleteChartedResource,
  flashAndRemoveItem,
  setFreshlyAdded,
  fetchLabOrders,
  labOrders,
  setAiCharted,
  setProcedureProv,
  setNoteFieldMeta,
  withPendingProv,
  flagAiObsIds,
  clearAiChartedId,
  pendingProvenanceRef,
  medDoseMismatchRef,
  detectNoteFieldDrift,
  procedureQuickPicks,
  procedureTypeNameByCode,
  procedureFieldAllowedValues,
  saveProcedureFromQuickPickRef,
}: {
  encounterId: string | undefined;
  chartData: GetChartDataResponse | null;
  chartDataRef: React.MutableRefObject<GetChartDataResponse | null>;
  setChartData: React.Dispatch<React.SetStateAction<GetChartDataResponse | null>>;
  saveAndMerge: (payload: SaveChartDataRequest) => Promise<string[]>;
  mergeSaveResponse: (response: { chartData: GetChartDataResponse }) => string[];
  deleteChartedResource: (field: AiField, dto: { resourceId?: string }) => Promise<void>;
  flashAndRemoveItem: (resourceId: string, commitRemove: () => void) => void;
  setFreshlyAdded: React.Dispatch<React.SetStateAction<Set<string>>>;
  fetchLabOrders: () => Promise<void>;
  labOrders: EasyChartLabOrder[];
  setAiCharted: React.Dispatch<React.SetStateAction<Map<string, AiChartedMeta>>>;
  setProcedureProv: React.Dispatch<React.SetStateAction<Map<string, ProcedureProvenance>>>;
  setNoteFieldMeta: React.Dispatch<
    React.SetStateAction<Map<ChartNoteKey, { sourceText?: string; needsReview?: boolean; reason?: string }>>
  >;
  withPendingProv: (meta: AiChartedMeta) => AiChartedMeta;
  flagAiObsIds: (ids: string[], field: 'examObservations' | 'rosObservations', display: string) => void;
  clearAiChartedId: (resourceId?: string) => void;
  pendingProvenanceRef: React.MutableRefObject<{
    sourceText?: string;
    inferred?: boolean;
    reviewNote?: string;
  } | null>;
  medDoseMismatchRef: React.MutableRefObject<{ drug: string; dictated: string; order: string }[]>;
  detectNoteFieldDrift: () => void;
  procedureQuickPicks: ProcedureQuickPickData[];
  procedureTypeNameByCode: Map<string, string>;
  procedureFieldAllowedValues: Map<keyof ProcedureDTO, Map<string, string>>;
  saveProcedureFromQuickPickRef: React.MutableRefObject<
    (qp: ProcedureQuickPickData) => Promise<{ resourceId?: string; inferredFields: Set<string> } | undefined>
  >;
}) {
  const { oystehr, oystehrZambda } = useApiClients();
  const apiClient = useOystehrAPIClient();

  // Per-field promise chain so rapid inline edits (and a concurrent planner edit) to the same
  // note field serialize instead of racing each other through saveChartData/mergeSaveResponse.
  const noteSaveChainRef = useRef<Record<string, Promise<void>>>({});
  const [refineText, setRefineText] = useState('');
  // Narrative-plan execution state. `currentIdx` points at the step currently being run
  // (or paused awaiting a picker click). `results` records per-step outcomes for the summary.
  const [plan, setPlan] = useState<{
    narrative: string;
    steps: EasyChartPlannerStep[];
    currentIdx: number;
    results: { status: 'done' | 'skipped' | 'error'; label: string; message?: string }[];
  } | null>(null);
  // Track the last currentIdx we kicked off so we don't double-dispatch on conv changes that
  // re-render the component, and the conv kinds we treat as "step finished" vs "waiting".
  const planDispatchedIdxRef = useRef<number>(-1);
  const planAdvancedIdxRef = useRef<number>(-1);
  // Reference to the conv object whose terminal state we already consumed for an advance.
  // The advance effect's dep on `plan.currentIdx` would otherwise re-fire it after each advance
  // (currentIdx changed → effect fires → conv is STALE from the previous step but still terminal
  // → bug-advance to the next step). Storing the actual conv reference and requiring it to
  // differ guarantees we only advance once per real conv transition.
  const planLastAdvanceConvRef = useRef<ConvStep | null>(null);
  // Live ref to the current plan so async handlers (e.g. handleApplyTemplate's post-template
  // refresh) can read the latest state without a stale closure.
  const planRef = useRef<typeof plan>(null);
  useEffect(() => {
    planRef.current = plan;
  }, [plan]);
  const replaceTargetRef = useRef<{ field: AiField; dto: { resourceId?: string } } | null>(null);
  const [conv, setConv] = useState<ConvStep | null>(null);

  // Unified chat thread (session-only history, clears on reload). Each committed entry is a user
  // message or a settled assistant summary; the IN-PROGRESS turn renders live from `conv`/`plan` at
  // the bottom of the thread and is committed here once it settles (see the commit effect below).
  type ThreadEntry = { id: number; role: 'user' | 'assistant'; text: string };
  const [thread, setThread] = useState<ThreadEntry[]>([]);
  // The conv object already folded into history, so the live region stops re-rendering it.
  const [committedConv, setCommittedConv] = useState<ConvStep | null>(null);
  const threadSeqRef = useRef(0);
  const pushUserMessage = (text: string): void =>
    setThread((t) => [...t, { id: (threadSeqRef.current += 1), role: 'user', text }]);
  const pushAssistantMessage = (text: string): void =>
    setThread((t) => [...t, { id: (threadSeqRef.current += 1), role: 'assistant', text }]);

  // TEMPORARY (debug): running per-session LLM token tally, fed by each zambda response's `usage`.
  const [tokenTally, setTokenTally] = useState({
    calls: 0,
    claudeIn: 0,
    claudeOut: 0,
    claudeCacheRead: 0,
    claudeCacheWrite: 0,
    geminiIn: 0,
    geminiOut: 0,
    geminiThinking: 0,
  });
  const recordUsage = (u?: EasyChartTokenUsage): void => {
    if (!u) return;
    setTokenTally((t) => {
      const n = { ...t, calls: t.calls + 1 };
      if (u.provider === 'claude') {
        n.claudeIn += u.inputTokens;
        n.claudeOut += u.outputTokens;
        n.claudeCacheRead += u.cacheReadTokens ?? 0;
        n.claudeCacheWrite += u.cacheWriteTokens ?? 0;
      } else {
        n.geminiIn += u.inputTokens;
        n.geminiOut += u.outputTokens;
        n.geminiThinking += u.thinkingTokens ?? 0;
      }
      return n;
    });
  };

  // Post-completion review: the suggestions ("did you mean…/swap dx/add negatives/bump E&M") are now
  // applied straight into the note as needs-review items (with the reasoning in their hover) instead
  // of being surfaced as accept/dismiss cards, so only the loading/error indicator lives here.
  const [reviewLoading, setReviewLoading] = useState(false);
  const [reviewError, setReviewError] = useState(false);
  // Review-proposed REWRITES of already-written note fields (MDM etc.). These never auto-apply —
  // overwriting correct provider prose is worse than a missed suggestion (the med-reconcile pass
  // once "fixed" a correct colchicine loading-dose MDM). The provider confirms or dismisses each.
  const [pendingNoteEdits, setPendingNoteEdits] = useState<
    Array<{ id: number; field: string; newText: string; note: string }>
  >([]);
  const pendingNoteEditSeq = useRef(0);
  // Thread id the suggestion block is anchored AFTER, so it sits inline in the chat at the point it
  // was produced (right below the plan summary) instead of pinned to the very bottom. Anything the
  // provider types next gets a higher id and therefore renders BELOW the suggestions, the way a chat
  // app behaves. null → no anchor yet (loading / pre-suggestion); falls back to trailing render.
  const [reviewAnchorId, setReviewAnchorId] = useState<number | null>(null);
  // Narrative of the last applied plan, so the manual "Review note" button has something to review;
  // pendingReviewRef carries it from the plan-completion updater to the auto-trigger effect.
  const lastNarrativeRef = useRef<string>('');
  const pendingReviewRef = useRef<string | null>(null);

  // Place an in-house lab order for a specific catalog test, then refresh the section. Shared by the
  // auto-pick dispatch and the disambiguation picker so the create call lives in one place.
  const createInHouseLabFromTest = async (test: DataEntryTestItem, message: string): Promise<void> => {
    if (!oystehrZambda || !encounterId) return;
    setConv({ kind: 'saving', user: message, chosenName: test.name });
    try {
      await createInHouseLabOrder(oystehrZambda, {
        encounterId,
        testItems: [test],
        diagnosesAll: chartDataRef.current?.diagnosis ?? [],
        diagnosesNew: [],
      });
      void fetchLabOrders();
      setConv({ kind: 'done', user: message, chosenName: test.name });
    } catch (e) {
      console.error('In-house lab order failed:', e);
      setConv({ kind: 'error', user: message, reply: `Could not order “${test.name}”. Please try again.` });
    }
  };

  // Place a send-out lab order for a specific orderable item using the order context resolved at
  // dispatch (encounter/office/dx/payment). Shared by the auto-pick dispatch and the picker.
  const createExternalLabFromItem = async (
    item: OrderableItemSearchResult,
    ctx: {
      encounter: Encounter;
      office: ModifiedOrderingLocation;
      dx: DiagnosisDTO[];
      payment: CreateLabPaymentMethod;
    },
    message: string
  ): Promise<void> => {
    if (!oystehrZambda) return;
    const name = item.item.itemName;
    setConv({ kind: 'saving', user: message, chosenName: name });
    try {
      await createExternalLabOrder(oystehrZambda, {
        dx: ctx.dx,
        encounter: ctx.encounter,
        orderableItems: [item],
        psc: false,
        orderingLocation: ctx.office,
        selectedPaymentMethod: ctx.payment,
      });
      void fetchLabOrders();
      setConv({ kind: 'done', user: message, chosenName: name });
    } catch (e) {
      console.error('External lab order failed:', e);
      setConv({ kind: 'error', user: message, reply: `Could not order “${name}”. Please try again.` });
    }
  };

  // The provider picked a specific test from the lab disambiguation picker — place that order.
  const handleLabPick = (
    convStep: Extract<ConvStep, { kind: 'choose-lab' }>,
    candidate: { inHouseTest?: DataEntryTestItem; externalItem?: OrderableItemSearchResult }
  ): void => {
    if (convStep.labKind === 'in-house' && candidate.inHouseTest) {
      void createInHouseLabFromTest(candidate.inHouseTest, convStep.user);
    } else if (convStep.labKind === 'external' && candidate.externalItem && convStep.externalContext) {
      void createExternalLabFromItem(candidate.externalItem, convStep.externalContext, convStep.user);
    }
  };

  // "Discuss": hand the item to the right-hand panel as a full picker (all alternatives + Skip /
  // Refine). Picking there REPLACES the item (replaceTargetRef is consumed in handlePick). The row
  // leaves the needs-review set because it's now under active review in the panel.
  const aiDiscuss = (field: AiField, dto: { resourceId?: string }, meta: AiChartedMeta): void => {
    // CODE-based and OBSERVATION fields have no right-panel picker; Discuss is hidden for them.
    if (
      field === 'cptCodes' ||
      field === 'emCode' ||
      field === 'examObservations' ||
      field === 'rosObservations' ||
      field === 'vitalsObservations'
    )
      return;
    void (async () => {
      try {
        const isPrimary = field === 'diagnosis' ? !!(dto as { isPrimary?: boolean }).isPrimary : undefined;
        const intent = synthAddIntent(field, meta.display, meta.searchTerms, isPrimary);
        replaceTargetRef.current = { field, dto };
        const results = await runIntentSearch(intent, oystehr, oystehrZambda);
        if (dto.resourceId) {
          setAiCharted((prev) => {
            if (!prev.has(dto.resourceId!)) return prev;
            const n = new Map(prev);
            n.delete(dto.resourceId!);
            return n;
          });
        }
        setConv({ kind: 'choose', user: `Review: ${meta.display}`, intent, results });
      } catch (e) {
        console.error('AI discuss failed:', e);
        captureException(e);
        enqueueSnackbar(`Could not load alternatives for "${meta.display}".`, { variant: 'error' });
      }
    })();
  };

  // User-facing strings must show the Disposition card's display label, never the raw
  // DispositionType key; unknown keys coerce to 'another', matching the save path below.
  const dispositionTypeLabel = (type: string): string =>
    mapDispositionTypeToLabel[type as DispositionType] ?? mapDispositionTypeToLabel.another;

  // Human label for a step shown in the conversation header during plan execution.
  const describePlanStep = (intent: EasyChartAgentIntent): string => {
    switch (intent.kind) {
      case 'add-allergy':
      case 'add-condition':
      case 'add-medication':
      case 'add-surgical-history':
      case 'add-hospitalization':
        return `${intent.kind.replace(/-/g, ' ')}: ${intent.display}`;
      case 'add-diagnosis':
        return `add diagnosis${intent.isPrimary ? ' (primary)' : ''}: ${intent.display}`;
      case 'remove-allergy':
      case 'remove-condition':
      case 'remove-medication':
      case 'remove-surgical-history':
      case 'remove-hospitalization':
      case 'remove-diagnosis':
      case 'remove-exam-finding':
      case 'remove-ros-finding':
        return `${intent.kind.replace(/-/g, ' ')}: ${intent.display}`;
      case 'set-em-code':
        return `set E&M code ${intent.code}`;
      case 'add-cpt':
        return `add CPT ${intent.code}`;
      case 'remove-em-code':
        return 'remove E&M code';
      case 'remove-cpt':
        return `remove CPT ${intent.code}`;
      case 'apply-template':
        return `apply template: ${intent.display}`;
      case 'add-procedure':
        return `add procedure: ${intent.display}`;
      case 'update-procedure':
        return `update procedure${intent.procedureMatch ? ` (${intent.procedureMatch})` : ''}: ${intent.updates
          .map((u) => `${u.field}=${u.value}`)
          .join(', ')}`;
      case 'edit-note-text':
        return `edit ${intent.field}`;
      case 'add-exam-finding':
        return `add exam finding: ${intent.display}`;
      case 'add-ros-finding':
        return `add ROS: ${intent.display}`;
      case 'set-vital':
        return `set vital: ${intent.display}`;
      case 'add-in-house-lab':
        return `order in-house lab: ${intent.display}`;
      case 'add-external-lab':
        return `order send-out lab: ${intent.display}`;
      case 'add-patient-instruction':
        return `patient instruction: ${intent.text.length > 50 ? `${intent.text.slice(0, 47)}…` : intent.text}`;
      case 'set-disposition':
        return `set disposition: ${dispositionTypeLabel(intent.dispositionType)}${
          intent.followUpInDays ? ` (follow up in ${intent.followUpInDays}d)` : ''
        }`;
      case 'add-nursing-order':
        return `nursing order: ${intent.text.length > 50 ? `${intent.text.slice(0, 47)}…` : intent.text}`;
      case 'add-radiology':
        return `order imaging: ${intent.display}`;
      case 'provider-note':
        return `note to provider: ${intent.text.length > 50 ? `${intent.text.slice(0, 47)}…` : intent.text}`;
      case 'unknown':
        return 'unknown action';
    }
  };

  // Plan execution: dispatch the current step when the cursor moves to it.
  useEffect(() => {
    if (!plan) {
      planDispatchedIdxRef.current = -1;
      planAdvancedIdxRef.current = -1;
      planLastAdvanceConvRef.current = null;
      return;
    }
    if (planDispatchedIdxRef.current === plan.currentIdx) return; // already kicked off
    planDispatchedIdxRef.current = plan.currentIdx;
    const step = plan.steps[plan.currentIdx];
    const label = `Step ${plan.currentIdx + 1}/${plan.steps.length} — ${describePlanStep(step)}`;
    // Stamp this step's provenance so the charting handlers can mark each item sourced-vs-inferred.
    const src = step.sourceText?.trim();
    pendingProvenanceRef.current = { sourceText: src || undefined, inferred: !src };
    void dispatchIntent(step, label);
    // Intentionally no other deps — we only want to fire when the cursor moves.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [plan?.currentIdx, plan?.steps.length]);

  // Plan progression: when conv reaches a settled (terminal) state for the current step,
  // record the result and advance the cursor. Picker / in-progress conv kinds pause the plan.
  useEffect(() => {
    if (!plan) return;
    if (!conv) return;
    // Guard against the stale-conv double-advance: if this exact conv object already triggered
    // an advance, ignore it. Each real step transition produces a new conv object via setConv.
    if (planLastAdvanceConvRef.current === conv) return;
    const terminal: ConvStep['kind'][] = [
      'done',
      'removed',
      'applied-template',
      'updated-procedure',
      'edited-note-text',
      'unknown',
      'error',
      'skipped',
      'no-match',
      'no-match-remove',
      'no-match-template',
      'no-match-procedure',
      'no-procedure-to-update',
      'no-match-exam',
      'no-match-exam-remove',
    ];
    if (!terminal.includes(conv.kind)) return;
    planLastAdvanceConvRef.current = conv;
    planAdvancedIdxRef.current = plan.currentIdx;
    setPlan((prev) => {
      if (!prev) return null;
      const status: 'done' | 'skipped' | 'error' =
        conv.kind === 'error'
          ? 'error'
          : conv.kind === 'skipped' || conv.kind.startsWith('no-') || conv.kind === 'unknown'
          ? 'skipped'
          : 'done';
      const stepLabel = describePlanStep(prev.steps[prev.currentIdx]);
      const message = conv.kind === 'error' || conv.kind === 'unknown' ? (conv as { reply?: string }).reply : undefined;
      const nextResults = [...prev.results, { status, label: stepLabel, message }];
      const nextIdx = prev.currentIdx + 1;
      if (nextIdx >= prev.steps.length) {
        // Plan complete — leave a summary in the conversation, clear plan state.
        const doneCount = nextResults.filter((r) => r.status === 'done').length;
        const skipCount = nextResults.filter((r) => r.status === 'skipped').length;
        const errCount = nextResults.filter((r) => r.status === 'error').length;
        const summary =
          `Plan complete: ${doneCount} applied` +
          (skipCount > 0 ? `, ${skipCount} skipped` : '') +
          (errCount > 0 ? `, ${errCount} error${errCount === 1 ? '' : 's'}` : '') +
          '.';
        setConv({ kind: 'unknown', user: prev.narrative, reply: summary });
        // Hand the narrative to the auto-review effect (fires when `plan` becomes null). Stashing
        // in a ref keeps the side effect out of this updater (StrictMode-safe / idempotent).
        pendingReviewRef.current = prev.narrative;
        lastNarrativeRef.current = prev.narrative;
        return null;
      }
      return { ...prev, currentIdx: nextIdx, results: nextResults };
    });
    // Depend on the conv OBJECT (each setConv makes a new one), NOT conv.kind: two consecutive steps
    // can settle with the same kind (e.g. remove "Soft" then remove "Nontender", both
    // no-match-exam-remove) and with currentIdx already advanced, so keying on conv.kind leaves the
    // deps unchanged and the plan stalls. The planLastAdvanceConvRef guard prevents double-advancing.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conv, plan?.currentIdx]);

  // Auto-review: when a plan finishes (plan → null) and the completion updater stashed its
  // narrative, run the review pass to surface suggestion cards. Clearing the ref before the call
  // keeps this from re-firing on later plan-null transitions.
  useEffect(() => {
    if (plan === null && pendingReviewRef.current) {
      const narrative = pendingReviewRef.current;
      pendingReviewRef.current = null;
      detectNoteFieldDrift();
      void runReview(narrative);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [plan]);

  // A settled (terminal) assistant summary for a conv, or null if the conv is still in progress
  // (thinking / saving / a picker awaiting a choice). Used both to decide WHEN a turn is done and
  // WHAT one-line summary to fold into the thread history.
  const summarizeConv = (c: ConvStep): string | null => {
    const target = (i: unknown): string => (i as { display?: string })?.display ?? 'that';
    switch (c.kind) {
      case 'done':
        return `Added ${c.chosenName} to the chart.`;
      case 'removed':
        return `Removed ${c.chosenName} from the chart.`;
      case 'applied-template':
        return `Applied the ${c.chosenName} template.`;
      case 'updated-procedure':
        return c.summary || `Updated ${c.chosenName}.`;
      case 'edited-note-text':
        return `Updated the ${c.fieldLabel}.`;
      case 'unknown':
        return (
          c.reply?.trim() || "I couldn't act on that. Try a specific charting request, e.g. “add diagnosis sinusitis”."
        );
      case 'error':
        return c.reply?.trim() || 'Something went wrong. Please try again.';
      case 'skipped':
        return c.reason || 'Skipped.';
      case 'no-match':
      case 'no-match-exam':
      case 'no-match-procedure':
        return `I couldn't find a match for “${target(c.intent)}”.`;
      case 'no-match-remove':
      case 'no-match-exam-remove':
        return `Skipped removing “${target(c.intent)}” — it isn't on the chart.`;
      case 'no-match-template':
        return `No template matched “${target(c.intent)}”.`;
      case 'no-procedure-to-update':
        return `There's no procedure on the chart to update.`;
      default:
        return null; // in-progress / picker — stays live, not yet committed
    }
  };

  // Commit a settled turn into the thread history. A turn settles when conv reaches a terminal kind
  // AND no plan is running (a single-shot action that finished, or a plan that just completed →
  // plan null + summary conv). Mid-plan step transitions keep plan non-null, and pickers/in-progress
  // kinds summarize to null, so neither commits here. Dedup on the conv object (each setConv is new).
  useEffect(() => {
    if (plan || !conv || committedConv === conv) return;
    const summary = summarizeConv(conv);
    if (summary == null) return;
    pushAssistantMessage(summary);
    setCommittedConv(conv);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conv, plan]);

  // Build the noteContext we send to the LLM. The in-person CC↔HPI swap is applied here so
  // the LLM sees text under the labels the provider reads (chiefComplaint = CC label's text).
  const buildNoteContext = (): NonNullable<Parameters<typeof easyChartAgent>[1]['noteContext']> | undefined => {
    const ctx = chartDataRef.current;
    if (!ctx) return undefined;
    return {
      chiefComplaint: ctx.historyOfPresentIllness?.text ?? undefined,
      historyOfPresentIllness: ctx.chiefComplaint?.text ?? undefined,
      mechanismOfInjury: ctx.mechanismOfInjury?.text ?? undefined,
      ros: ctx.ros?.text ?? undefined,
      medicalDecision: ctx.medicalDecision?.text ?? undefined,
    };
  };

  // Run the post-completion review pass and load its suggestion cards. `narrativeArg` is the
  // plan's narrative on auto-trigger; the manual button falls back to the last plan's narrative or
  // a synthesis of the note text so there's always something to review against the chart.
  const runReview = async (narrativeArg?: string): Promise<void> => {
    if (!oystehrZambda || !encounterId) return;
    const noteContext = buildNoteContext();
    const synthesized = [noteContext?.historyOfPresentIllness, noteContext?.medicalDecision].filter(Boolean).join('\n');
    const narrative = (narrativeArg || lastNarrativeRef.current || synthesized || '').trim();
    if (!narrative) return;
    if (narrativeArg) lastNarrativeRef.current = narrativeArg;
    setReviewLoading(true);
    setReviewError(false);
    // Anchor the inline "Reviewing…" indicator after the current last thread message.
    setReviewAnchorId(threadSeqRef.current);
    try {
      const chartState = buildChartStateSummary(chartDataRef.current);
      const reviewRes = await easyChartReview(oystehrZambda, { narrative, chartState, noteContext, encounterId });
      recordUsage(reviewRes.usage);
      const { suggestions } = reviewRes;
      // Apply each suggestion's action(s) straight into the note instead of surfacing cards. Items the
      // suggestion adds get the normal needs-review highlight, and the suggestion's reasoning rides
      // along as `reviewNote` so it shows in the item's hover — the provider reviews it in place.
      let applied = 0;
      const failed: string[] = [];
      for (const s of suggestions) {
        const note = [s.question, s.rationale, s.partialNote].filter(Boolean).join(' — ');
        let any = false;
        let anyFailed = false;
        // Diagnosis-swap primary carry-over: a "diagnosis" suggestion pairs remove-diagnosis +
        // add-diagnosis, and the model reliably omits isPrimary on the add — which charts as
        // secondary, so swapping the PRIMARY dx left the note with no primary. Stamp the removed
        // dx's isPrimary onto the add from the structured chart, BEFORE the remove executes.
        // (The planner path's never-usurp rule is untouched — this runs only on review replays.)
        const actions = carrySwapPrimary(s.actions, chartDataRef.current);
        for (const action of actions) {
          // A rewrite of a note field that already has content requires explicit confirmation —
          // queue it as a proposal card instead of silently replacing the provider's prose.
          if (action.kind === 'edit-note-text' && typeof action.newText === 'string') {
            const currentText = (noteContext as Record<string, string | undefined> | undefined)?.[action.field];
            if (currentText && currentText.trim()) {
              setPendingNoteEdits((prev) => [
                ...prev,
                { id: ++pendingNoteEditSeq.current, field: action.field, newText: action.newText, note },
              ]);
              any = true;
              continue;
            }
          }
          pendingProvenanceRef.current = { reviewNote: note };
          try {
            await dispatchIntent(action, `Note review: ${s.question}`);
            any = true;
          } catch (e) {
            console.error('Applying review suggestion failed:', e);
            captureException(e);
            anyFailed = true;
          }
        }
        // Safety net: a signable note needs exactly one primary dx, and a swap can still lose it
        // (no resolvable remove match for the carry-over, or a failed add). Yield one tick so the
        // last dispatch's setChartData commits to chartDataRef (the ref syncs via effect), then —
        // if diagnoses exist but none is primary — promote the dx the swap just added (else the
        // first charted one). No-op whenever a primary is present.
        await new Promise((resolve) => setTimeout(resolve, 0));
        const promote = pickPrimaryPromotion(actions, chartDataRef.current?.diagnosis);
        if (promote?.resourceId) {
          try {
            await saveAndMerge({ encounterId, diagnosis: [{ ...promote, isPrimary: true }] });
          } catch (e) {
            console.error('Restoring the primary diagnosis after a review swap failed:', e);
            captureException(e);
          }
        }
        if (any) applied += 1;
        if (anyFailed) failed.push(s.question);
      }
      pendingProvenanceRef.current = null;
      // A suggestion that failed to save must never disappear silently — the review caught a real
      // gap and the provider would sign the note without it. Say so in the thread.
      const heldEdits = pendingNoteEditSeq.current;
      const appliedMsg =
        applied > 0
          ? `Note review added ${applied} suggestion${
              applied === 1 ? '' : 's'
            } to the note (highlighted for your review — hover for the reasoning).${
              heldEdits > 0 ? ' A proposed note edit awaits your confirmation below.' : ''
            }`
          : 'Note review found nothing to add.';
      pushAssistantMessage(
        failed.length > 0
          ? `${appliedMsg} ⚠ ${failed.length} suggestion${
              failed.length === 1 ? '' : 's'
            } could NOT be applied — please address manually: ${failed.join(' · ')}`
          : appliedMsg
      );
    } catch (e) {
      console.error('Easy-chart review failed:', e);
      captureException(e);
      setReviewError(true);
    } finally {
      setReviewLoading(false);
    }
  };

  // Take a classified intent and run the appropriate per-intent path. Used by both the
  // single-shot agent flow and the plan executor — they only differ in how `intent` is
  // produced. `message` is the user-facing label rendered in the conversation header.
  // `interactive` is true only for one-off follow-up commands the provider types after the plan
  // (handleSend), NOT for plan steps or replayed suggestions. When true, a genuinely ambiguous
  // structured-finding match (several near-equal candidates) opens a picker instead of auto-picking;
  // an obvious best match still applies instantly.
  // Append a finding to an exam SECTION'S free-text comment area (the exam tab is checkboxes
  // plus one text field per section) and flag it for review. Used whenever a dictated finding
  // has no confident checkbox: better charted-as-prose-in-the-right-section than dropped.
  const writeExamComment = async (sectionLabel: string, text: string, message: string): Promise<void> => {
    const commentField = SECTION_TO_COMMENT_FIELD[sectionLabel] ?? SECTION_TO_COMMENT_FIELD['General Appearance'];
    const section = SECTION_TO_COMMENT_FIELD[sectionLabel] ? sectionLabel : 'General Appearance';
    const existing = chartDataRef.current?.examObservations?.find((o) => o.field === commentField);
    // Dedupe: the plan and the post-chart review can both route the same finding here — appending
    // twice reads as "Positive Homan's sign; Positive Homan's sign".
    const norm = (t: string): string =>
      t
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, ' ')
        .trim();
    if (existing?.note && norm(existing.note).includes(norm(text))) {
      setConv({ kind: 'skipped', user: message, reason: `Already in the ${section} exam note: “${text}”.` });
      return;
    }
    const nextNote = existing?.note?.trim() ? `${existing.note.trim()}; ${text}` : text;
    const ids = await saveAndMerge({
      encounterId: encounterId!,
      examObservations: [{ ...(existing ?? { field: commentField }), note: nextNote }],
    });
    const flagIds = ids.length > 0 ? ids : existing?.resourceId ? [existing.resourceId] : [];
    flagAiObsIds(flagIds, 'examObservations', text);
    setConv({ kind: 'done', user: message, chosenName: `${section} exam note: ${text}` });
  };

  const dispatchIntent = async (intent: EasyChartAgentIntent, message: string, interactive = false): Promise<void> => {
    if (!oystehrZambda || !encounterId) return;
    if (intent.kind === 'unknown') {
      // Always reply clearly when we can't act, and say what WILL work — never leave the turn silent.
      setConv({
        kind: 'unknown',
        user: message,
        reply:
          intent.message?.trim() ||
          'I can only chart specific items — I can\'t answer open-ended requests. Try something like "add diagnosis sinusitis", "add medication amoxicillin 500 mg", or paste a dictation and I\'ll chart the whole visit.',
      });
      return;
    }
    try {
      if (intent.kind === 'provider-note') {
        // A message for the provider, not the chart — surface it as a chat bubble immediately
        // (so it survives in the thread) and settle the step without writing anything.
        pushAssistantMessage(`ℹ️ ${intent.text}`);
        setConv({ kind: 'skipped', user: message, reason: intent.text });
        return;
      }
      if (isRemoveIntent(intent)) {
        const matches = findRemoveMatches(intent, chartData);
        if (matches.length === 0) {
          setConv({ kind: 'no-match-remove', user: message, intent });
        } else if (matches.length > 1 && interactive) {
          // Removal is destructive — with several plausible matches ("remove the amoxicillin" when
          // both Amoxicillin and Amoxicillin-Clavulanate are charted), ASK instead of silently
          // deleting the first loose substring match (same rule as exam/ROS removals). A single
          // match still removes instantly.
          setConv({ kind: 'choose-remove', user: message, intent, matches });
        } else {
          await handleRemovePick(matches[0], message);
        }
        return;
      }
      // Code-based: the LLM gave us the code directly — save without searching
      if (intent.kind === 'set-em-code' || intent.kind === 'add-cpt') {
        const label = `${intent.code}${intent.display && intent.display !== intent.code ? ` — ${intent.display}` : ''}`;
        setConv({ kind: 'saving', user: message, chosenName: label });
        try {
          const payload: SaveChartDataRequest =
            intent.kind === 'set-em-code'
              ? { encounterId, emCode: { code: intent.code, display: intent.display } }
              : { encounterId, cptCodes: [{ code: intent.code, display: intent.display }] };
          const newIds = await saveAndMerge(payload);
          // Flag the auto-charted billing code as needing review (clickable-to-correct).
          if (newIds.length > 0) {
            const field: AiField = intent.kind === 'set-em-code' ? 'emCode' : 'cptCodes';
            setAiCharted((prev) => {
              const next = new Map(prev);
              for (const id of newIds)
                next.set(
                  id,
                  withPendingProv({
                    field,
                    display: intent.display ?? intent.code,
                    searchTerms: [],
                    lowConfidence: false,
                  })
                );
              return next;
            });
          }
          setConv({ kind: 'done', user: message, chosenName: label });
        } catch (e) {
          console.error('Save failed:', e);
          setConv({ kind: 'error', user: message, reply: `Could not save "${label}". Please try again.` });
        }
        return;
      }
      // Value-based vital: build the typed DTO (converting to the stored unit — temp→°C, weight→kg,
      // height→cm) and save through the same chart-data path the Vitals screen uses. No search needed.
      if (intent.kind === 'set-vital') {
        setConv({ kind: 'saving', user: message, chosenName: intent.display });
        try {
          const unit = (intent.unit ?? '').trim().toLowerCase();
          let dto: VitalsObservationDTO | null = null;
          if (intent.field === 'vital-blood-pressure') {
            if (intent.systolic != null && intent.diastolic != null) {
              dto = {
                field: VitalFieldNames.VitalBloodPressure,
                systolicPressure: intent.systolic,
                diastolicPressure: intent.diastolic,
              };
            }
          } else if (intent.value != null) {
            if (intent.field === 'vital-temperature') {
              const celsius = unit.startsWith('f') ? fahrenheitToCelsius(intent.value) : intent.value;
              dto = { field: VitalFieldNames.VitalTemperature, value: roundTemperatureForSave(celsius) };
            } else if (intent.field === 'vital-weight') {
              dto = {
                field: VitalFieldNames.VitalWeight,
                value: /^(?:l|p)/.test(unit) ? intent.value / LBS_IN_KG : intent.value,
              };
            } else if (intent.field === 'vital-height') {
              dto = {
                field: VitalFieldNames.VitalHeight,
                value: /^(?:i|")/.test(unit) ? intent.value * 2.54 : intent.value,
              };
            } else {
              // heartbeat | respiration-rate | oxygen-sat — unitless
              dto = { field: intent.field as VitalFieldNames, value: intent.value } as VitalsObservationDTO;
            }
          }
          if (!dto) {
            setConv({ kind: 'error', user: message, reply: `Could not chart "${intent.display}" — missing a value.` });
            return;
          }
          const vitalIds = await saveAndMerge({ encounterId, vitalsObservations: [dto] });
          // Flag the charted vital for review with provenance, like every other AI-charted item — so
          // it carries the needs-review highlight + sourced/inferred hover instead of sitting unmarked.
          if (vitalIds[0]) {
            const id = vitalIds[0];
            setAiCharted((prev) =>
              new Map(prev).set(
                id,
                withPendingProv({
                  field: 'vitalsObservations',
                  display: intent.display,
                  searchTerms: [],
                  lowConfidence: false,
                })
              )
            );
          }
          setConv({ kind: 'done', user: message, chosenName: intent.display });
        } catch (e) {
          console.error('Save vital failed:', e);
          setConv({ kind: 'error', user: message, reply: `Could not chart "${intent.display}". Please try again.` });
        }
        return;
      }
      // In-house (in-office) lab: match the dictated test against this practice's in-house
      // catalog (ActivityDefinitions) and order it through the same create-in-house-lab-order
      // path the In-House Labs page uses. The charted diagnoses anchor the order; the planner
      // emits add-diagnosis steps separately, so none are "new" here.
      if (intent.kind === 'add-in-house-lab') {
        if (!apiClient) return;
        setConv({ kind: 'saving', user: message, chosenName: intent.display });
        try {
          const resources = await apiClient.getCreateInHouseLabOrderResources({ encounterId });
          const availableTests: DataEntryTestItem[] = resources?.labs ?? [];
          const scored = findLabCatalogMatchesScored(intent.display, intent.searchTerms, availableTests, (t) => t.name);
          if (scored.length === 0) {
            setConv({
              kind: 'skipped',
              user: message,
              reason: `I couldn't find an in-house lab matching “${intent.display}” in this practice's catalog.`,
            });
            return;
          }
          // Interactive + several near-equal tests (e.g. "flu test" → Flu A / Flu B / Rapid Influenza)
          // → let the provider pick. A clear single best match still orders instantly.
          const cluster = interactive ? ambiguousCluster(scored) : null;
          if (cluster && cluster.length > 1) {
            setConv({
              kind: 'choose-lab',
              user: message,
              display: intent.display,
              labKind: 'in-house',
              candidates: cluster.map((t) => ({ label: t.name, inHouseTest: t })),
            });
            return;
          }
          await createInHouseLabFromTest(scored[0].leaf, message);
        } catch (e) {
          console.error('In-house lab order failed:', e);
          setConv({ kind: 'error', user: message, reply: `Could not order “${intent.display}”. Please try again.` });
        }
        return;
      }
      // Send-out (reference) lab: match the dictated test against the connected lab partners'
      // catalog and order it through the same create-lab-order path the External Labs page uses.
      // Ordering office is the encounter's lab-enabled location; the order is anchored on the
      // charted diagnoses; payment auto-defaults workers'-comp → insurance (if covered) → self-pay
      // and the provider can change it on the order later.
      if (intent.kind === 'add-external-lab') {
        if (!apiClient || !oystehr) return;
        setConv({ kind: 'saving', user: message, chosenName: intent.display });
        try {
          const dx = chartDataRef.current?.diagnosis ?? [];
          if (dx.length === 0) {
            setConv({
              kind: 'skipped',
              user: message,
              reason: `Send-out lab “${intent.display}” needs at least one diagnosis — add the assessment first, then re-order.`,
            });
            return;
          }
          // The order zambda needs the full Encounter; we also read its location to pick the
          // ordering office and its subject to fetch coverage/lab resources.
          const encounterResource = (await oystehr.fhir.get({
            resourceType: 'Encounter',
            id: encounterId,
          })) as Encounter;
          const patientId = encounterResource.subject?.reference?.replace('Patient/', '');
          const encounterLocationId = encounterResource.location
            ?.find((l) => l.location?.reference?.startsWith('Location/'))
            ?.location?.reference?.replace('Location/', '');

          const resources = await apiClient.getCreateExternalLabResources({ patientId, encounterId });
          const labEnabled = (resources.orderingLocations ?? []).filter((l) => l.enabledLabs.length > 0);
          // Prefer the encounter's own location; fall back to the only lab-enabled office.
          const office =
            labEnabled.find((l) => l.id === encounterLocationId) ??
            (labEnabled.length === 1 ? labEnabled[0] : undefined);
          if (!office) {
            setConv({
              kind: 'skipped',
              user: message,
              reason: `No lab-enabled ordering office for this visit — place “${intent.display}” from the Labs tab.`,
            });
            return;
          }
          const labOrgIdsString = office.enabledLabs.map((e) => e.labOrgRef.replace('Organization/', '')).join(',');

          const search = await apiClient.getCreateExternalLabResources({ search: intent.display, labOrgIdsString });
          const scored = findLabCatalogMatchesScored(
            intent.display,
            intent.searchTerms,
            search.labs ?? [],
            (r) => r.item.itemName
          );
          if (scored.length === 0) {
            setConv({
              kind: 'skipped',
              user: message,
              reason: `I couldn't find a send-out lab matching “${intent.display}” in the connected lab catalog.`,
            });
            return;
          }
          const selectedPaymentMethod: CreateLabPaymentMethod = resources.appointmentIsWorkersComp
            ? LabPaymentMethod.WorkersComp
            : (resources.coverages?.length ?? 0) > 0
            ? LabPaymentMethod.Insurance
            : LabPaymentMethod.SelfPay;
          const ctx = { encounter: encounterResource, office, dx, payment: selectedPaymentMethod };
          // Interactive + several near-equal tests → let the provider pick; otherwise order the best.
          const cluster = interactive ? ambiguousCluster(scored) : null;
          if (cluster && cluster.length > 1) {
            setConv({
              kind: 'choose-lab',
              user: message,
              display: intent.display,
              labKind: 'external',
              candidates: cluster.map((it) => ({ label: it.item.itemName, externalItem: it })),
              externalContext: ctx,
            });
            return;
          }
          await createExternalLabFromItem(scored[0].leaf, ctx, message);
        } catch (e) {
          console.error('External lab order failed:', e);
          setConv({ kind: 'error', user: message, reply: `Could not order “${intent.display}”. Please try again.` });
        }
        return;
      }
      // Code-based remove
      if (intent.kind === 'remove-em-code') {
        if (!apiClient) return;
        const current = chartData?.emCode;
        // Missing target = skipped, not error — an error is reserved for a failed save/delete.
        if (!current?.resourceId) {
          setConv({ kind: 'skipped', user: message, reason: 'There is no E&M code on this encounter to remove.' });
          return;
        }
        if (intent.code && current.code !== intent.code) {
          setConv({
            kind: 'skipped',
            user: message,
            reason: `Skipped removing E&M code ${intent.code} — the charted code is ${current.code}.`,
          });
          return;
        }
        const label = `${current.code}${current.display ? ` — ${current.display}` : ''}`;
        setConv({ kind: 'removing', user: message, chosenName: label });
        try {
          await apiClient.deleteChartData({ encounterId, emCode: current } as Parameters<
            typeof apiClient.deleteChartData
          >[0]);
          flashAndRemoveItem(current.resourceId, () => {
            setChartData((prev) => (prev ? { ...prev, emCode: undefined } : prev));
          });
          setConv({ kind: 'removed', user: message, chosenName: label });
        } catch (e) {
          console.error('Remove em-code failed:', e);
          setConv({ kind: 'error', user: message, reply: `Could not remove ${label}.` });
        }
        return;
      }
      if (intent.kind === 'remove-cpt') {
        if (!apiClient) return;
        const match = (chartData?.cptCodes ?? []).find((c) => c.resourceId && c.code === intent.code);
        if (!match || !match.resourceId) {
          setConv({
            kind: 'skipped',
            user: message,
            reason: `Skipped removing CPT ${intent.code} — it isn't on this encounter.`,
          });
          return;
        }
        const label = `${match.code}${match.display ? ` — ${match.display}` : ''}`;
        setConv({ kind: 'removing', user: message, chosenName: label });
        try {
          await apiClient.deleteChartData({ encounterId, cptCodes: [match] } as Parameters<
            typeof apiClient.deleteChartData
          >[0]);
          flashAndRemoveItem(match.resourceId, () => {
            setChartData((prev) =>
              prev
                ? { ...prev, cptCodes: (prev.cptCodes ?? []).filter((c) => c.resourceId !== match.resourceId) }
                : prev
            );
          });
          setConv({ kind: 'removed', user: message, chosenName: label });
        } catch (e) {
          console.error('Remove cpt failed:', e);
          setConv({ kind: 'error', user: message, reply: `Could not remove ${label}.` });
        }
        return;
      }
      if (intent.kind === 'apply-template') {
        const all = await listTemplates(oystehrZambda, { includeVersionData: false });
        const matches = findTemplateMatches(intent, all.templates);
        if (matches.length === 0) {
          setConv({ kind: 'no-match-template', user: message, intent });
        } else {
          // No stopping: auto-apply the best-matching template.
          await handleApplyTemplate(matches[0], message);
        }
        return;
      }
      if (intent.kind === 'add-procedure') {
        const matches = findProcedureMatches(intent, procedureQuickPicks);
        if (matches.length === 0) {
          setConv({ kind: 'no-match-procedure', user: message, intent });
        } else {
          // No stopping: auto-pick the best-matching procedure quick-pick.
          await handleProcedurePick(matches[0], message);
        }
        return;
      }
      if (intent.kind === 'update-procedure') {
        const allProcedures = chartDataRef.current?.procedures ?? [];
        if (allProcedures.length === 0) {
          setConv({ kind: 'no-procedure-to-update', user: message, intent });
        } else {
          const candidates = findProceduresToUpdate(intent, allProcedures);
          if (candidates.length === 0) {
            setConv({ kind: 'no-procedure-to-update', user: message, intent });
          } else {
            // No stopping: auto-pick the top candidate procedure to update.
            await handleProcedureUpdate(candidates[0], intent, message);
          }
        }
        return;
      }
      if (intent.kind === 'edit-note-text') {
        await handleEditNoteText(intent, message);
        return;
      }
      if (intent.kind === 'add-patient-instruction') {
        // Patient-facing care-plan instruction → Communication (the Plan tab's Patient Instructions),
        // NOT folded into MDM. Direct save, no search needed.
        const label = intent.text.length > 60 ? `${intent.text.slice(0, 57)}…` : intent.text;
        setConv({ kind: 'saving', user: message, chosenName: label });
        try {
          await saveAndMerge({ encounterId, instructions: [{ text: intent.text }] });
          setConv({ kind: 'done', user: message, chosenName: label });
        } catch (e) {
          console.error('Save failed:', e);
          setConv({ kind: 'error', user: message, reply: 'Could not save the patient instruction. Please try again.' });
        }
        return;
      }
      if (intent.kind === 'set-disposition') {
        // Structured Disposition (Plan tab) — where the patient goes next. Direct save. The label
        // map doubles as the valid-key set, so an unknown LLM key coerces to 'another'.
        const type: DispositionType =
          intent.dispositionType in mapDispositionTypeToLabel ? (intent.dispositionType as DispositionType) : 'another';
        const labelParts = [mapDispositionTypeToLabel[type]];
        if (intent.text?.trim()) labelParts.push(intent.text.trim());
        if (intent.followUpInDays != null) {
          labelParts.push(`follow up in ${intent.followUpInDays} day${intent.followUpInDays === 1 ? '' : 's'}`);
        }
        const label = `disposition: ${labelParts.join(' — ')}`;
        setConv({ kind: 'saving', user: message, chosenName: label });
        try {
          const disposition: DispositionDTO = {
            type,
            note: intent.text ?? '',
            ...(intent.followUpInDays != null ? { followUpIn: intent.followUpInDays } : {}),
          };
          await saveAndMerge({ encounterId, disposition });
          setConv({ kind: 'done', user: message, chosenName: label });
        } catch (e) {
          console.error('Save failed:', e);
          setConv({ kind: 'error', user: message, reply: 'Could not save the disposition. Please try again.' });
        }
        return;
      }
      if (intent.kind === 'add-nursing-order') {
        // Free-text nursing task → ServiceRequest via the nursing-order zambda (an order, not chart data).
        const label = intent.text.length > 50 ? `${intent.text.slice(0, 47)}…` : intent.text;
        setConv({ kind: 'saving', user: message, chosenName: label });
        try {
          if (!oystehrZambda) throw new Error('No zambda client');
          await createNursingOrder(oystehrZambda, { encounterId, notes: intent.text });
          setConv({ kind: 'done', user: message, chosenName: label });
        } catch (e) {
          console.error('Nursing order failed:', e);
          setConv({ kind: 'error', user: message, reply: 'Could not place the nursing order. Please try again.' });
        }
        return;
      }
      if (intent.kind === 'add-radiology') {
        // Imaging order: resolve the study to a catalog CPT, link the primary diagnosis, place the order.
        const label = intent.display;
        setConv({ kind: 'saving', user: message, chosenName: label });
        try {
          const study = matchRadiologyStudy(intent.display, intent.searchTerms);
          if (!study || !study.code) {
            setConv({
              kind: 'unknown',
              user: message,
              reply: `I couldn't match “${intent.display}” to an orderable imaging study — the in-clinic catalog covers X-rays only. Please place this order through the Radiology tab.`,
            });
            return;
          }
          const dx = chartDataRef.current?.diagnosis?.find((d) => d.isPrimary) ?? chartDataRef.current?.diagnosis?.[0];
          if (!dx?.code) {
            setConv({
              kind: 'error',
              user: message,
              reply: 'Add a diagnosis first — an imaging order needs a linked diagnosis.',
            });
            return;
          }
          if (!oystehrZambda) throw new Error('No zambda client');
          await createRadiologyOrder(oystehrZambda, {
            encounterId,
            diagnosisCode: dx.code,
            cptCode: study.code,
            lateralityModifier: undefined,
            stat: false,
            clinicalHistory: `${intent.display} — ${dx.display ?? dx.code}`.slice(0, 255),
            studyName: intent.display,
            consentObtained: true,
          });
          setConv({ kind: 'done', user: message, chosenName: `${label} (CPT ${study.code})` });
        } catch (e) {
          console.error('Radiology order failed:', e);
          setConv({ kind: 'error', user: message, reply: `Could not place the imaging order for “${label}”.` });
        }
        return;
      }
      if (intent.kind === 'add-exam-finding') {
        const scoredMatches = findExamLeafMatchesScored(intent, EXAM_LEAVES);
        // Clinical-safety guard: exam findings are POSITIVE/abnormal checkboxes (or explicit "Normal X"
        // leaves). A negated dictation finding ("no tragus tenderness") has no normal leaf to land on,
        // so charting it would CHECK the abnormal "Tragus tender" box and assert the OPPOSITE of what was
        // said. When the query is negated and EVERY match is abnormal, drop it rather than invert it.
        // (Negations that match a normal leaf — "no acute distress", "nontender" — still chart normally,
        // because not every match is abnormal.)
        const isNegatedFinding = /\b(no|not|non|without|denies?|denied|negative|absent|neg)\b/i.test(intent.display);
        if (
          isNegatedFinding &&
          scoredMatches.length > 0 &&
          scoredMatches.every((s) => s.leaf.normalAbnormal === 'abnormal')
        ) {
          // No normal checkbox exists for this negative — put the provider's own words in the
          // section's free-text area (charting "no purulent drainage" as prose is right; checking
          // the abnormal box would assert the opposite).
          await writeExamComment(
            inferExamSectionLabel(`${intent.display} ${(intent.searchTerms ?? []).join(' ')}`) ??
              scoredMatches[0].leaf.section,
            intent.display,
            message
          );
          return;
        }
        const allMatches = scoredMatches.map((s) => s.leaf);
        // Filter out leaves already on the chart — e.g. the AOM Right template already checked
        // "TM bulging, erythematous" on the right side, so re-adding it creates a duplicate.
        // For plain checkbox leaves: skip if any observation with field=leaf.field has value=true.
        // For modal-option leaves: skip if the parent observation already has this option's
        // component code checked.
        const existingObs = chartDataRef.current?.examObservations ?? [];
        const isAlreadyChecked = (leaf: ExamLeaf): boolean => {
          if (leaf.modalOption) {
            const parent = existingObs.find((o) => o.field === leaf.field && o.value === true);
            if (!parent) return false;
            return (parent.components ?? []).some((c) => c.code === leaf.modalOption!.optionCode && c.value === true);
          }
          return existingObs.some((o) => o.field === leaf.field && o.value === true);
        };
        const remainingScored = scoredMatches.filter((s) => !isAlreadyChecked(s.leaf));
        const remaining = remainingScored.map((s) => s.leaf);
        if (allMatches.length === 0) {
          // No checkbox leaf exists for this finding ("Positive Homan's sign") — write it into
          // the inferred section's free-text area instead of refusing.
          const section =
            inferExamSectionLabel(`${intent.display} ${(intent.searchTerms ?? []).join(' ')}`) ?? 'General Appearance';
          await writeExamComment(section, intent.display, message);
        } else if (remaining.length === 0) {
          // Every match is already on the chart — most commonly because a template added it.
          setConv({ kind: 'skipped', user: message, reason: `“${intent.display}” is already on the exam.` });
        } else if (allMatches[0] && isAlreadyChecked(allMatches[0])) {
          // The TOP-scored match is already on the chart. Usually that means the provider's
          // finding is already satisfied → skip (e.g. they asked for "Right TM erythematous and
          // bulging" and the AOM template already checked it; falling back to weaker variants would
          // surface unrelated options). BUT when the charted top match is a NORMAL finding and a
          // comparable, not-yet-charted ABNORMAL match exists, the provider is describing an
          // abnormality that lexically collided with a template-charted normal — e.g. "oropharynx
          // mildly injected" matching the template's "oropharynx clear … exudate" on the shared
          // anatomy/negation words. In that case chart the abnormal instead of dropping it.
          const top = scoredMatches[0];
          const abnormalAlt = remainingScored.find(
            (s) => s.leaf.normalAbnormal === 'abnormal' && s.score >= top.score * 0.5
          );
          if (top.leaf.normalAbnormal === 'normal' && abnormalAlt) {
            const ids = await handleExamPick(abnormalAlt.leaf, message);
            flagAiObsIds(ids, 'examObservations', abnormalAlt.leaf.label);
          } else {
            setConv({
              kind: 'skipped',
              user: message,
              reason: `“${intent.display}” matched the exam option “${top.leaf.label}”, which is already charted.`,
            });
          }
        } else {
          // Interactive follow-up + genuinely ambiguous (several near-equal matches) → let the
          // provider pick. Otherwise auto-pick — preferring a comparable abnormal over a normal top
          // match so an abnormal finding isn't lost to a same-anatomy normal (and the template's
          // normal isn't re-added when a preceding step already removed it).
          const cluster = interactive ? ambiguousCluster(remainingScored) : null;
          if (cluster && cluster.length > 1) {
            setExamPickSelected(new Set()); // fresh multi-select state for this picker
            setConv({ kind: 'choose-exam', user: message, intent, matches: cluster });
          } else if (!interactive && remainingScored[0].score < 3) {
            // Confidence floor for the no-stopping auto-pick: a sub-3 top score means the match
            // hangs on weak/generic overlap (how "shin erythema" once charted a shoulder leaf).
            // Don't guess a checkbox — write the finding into the SECTION'S FREE-TEXT area (the
            // exam tab is checkboxes plus a comment field per section), flagged for review like
            // any other AI-charted item. Falls back to a plain skip when no section is known.
            await writeExamComment(
              inferExamSectionLabel(`${intent.display} ${(intent.searchTerms ?? []).join(' ')}`) ??
                remainingScored[0].leaf.section,
              intent.display,
              message
            );
          } else {
            const pick = preferredExamLeaf(remainingScored, {
              queryNegated: isNegatedFinding,
              queryNormal:
                /\b(?:normal|intact|unremarkable|brisk|strong|supple|patent|clear|symmetric|regular|calm|comfortable|playful|interactive|consolable)\b|\bwell[- ](?:appearing|hydrated)\b|\b[0-9]\s*(?:\+|plus)\b|\b5 out of 5\b|\b5\s*\/\s*5\b|\b20\/20\b/i.test(
                  intent.display
                ),
            });
            const ids = await handleExamPick(pick, message);
            flagAiObsIds(ids, 'examObservations', pick.label);
          }
        }
        return;
      }
      if (intent.kind === 'remove-exam-finding') {
        const items = buildExamRemoveItems(chartDataRef.current?.examObservations);
        const scored = findExamRemoveMatchesScored(intent, items);
        if (scored.length === 0) {
          setConv({ kind: 'no-match-exam-remove', user: message, intent });
          return;
        }
        // Removal is destructive — when several findings match near-equally, ASK instead of
        // guessing (which previously deleted the wrong line). A clear single best match still
        // removes instantly.
        const cluster = interactive ? ambiguousCluster(scored) : null;
        if (cluster && cluster.length > 1) {
          setConv({ kind: 'choose-exam-remove', user: message, intent, matches: cluster });
        } else {
          await handleExamRemove(scored[0].leaf, message);
        }
        return;
      }
      if (intent.kind === 'remove-ros-finding') {
        const scored = findRosRemoveMatchesScored(
          intent.display,
          intent.searchTerms,
          chartDataRef.current?.rosObservations
        );
        if (scored.length === 0) {
          setConv({
            kind: 'skipped',
            user: message,
            reason: `Skipped removing “${intent.display}” — it isn't on the Review of Systems.`,
          });
          return;
        }
        const cluster = interactive ? ambiguousCluster(scored) : null;
        if (cluster && cluster.length > 1) {
          setConv({
            kind: 'choose-ros-remove',
            user: message,
            display: intent.display,
            matches: cluster.map((o) => ({ label: rosObsLabel(o), obs: o })),
          });
        } else {
          await handleRosRemove(scored[0].leaf, message);
        }
        return;
      }
      if (intent.kind === 'add-ros-finding') {
        // State comes from the leading "Denies"/"Reports" word in display (reliably emitted),
        // falling back to the optional `finding` enum. Strip the verb before matching the symptom.
        const verb = /^(denies|reports)\b[:\s-]*/i.exec(intent.display);
        const finding: 'reports' | 'denies' = verb
          ? verb[1].toLowerCase() === 'denies'
            ? 'denies'
            : 'reports'
          : intent.finding === 'denies'
          ? 'denies'
          : 'reports';
        const symptom = intent.display.replace(/^(denies|reports)\b[:\s-]*/i, '').trim();
        const matchIntent: AddRosFindingIntent = { ...intent, display: symptom || intent.display };
        const scoredMatches = findRosLeafMatchesScored(matchIntent, ROS_LEAVES);
        // Skip if this exact finding (same item + same denies/reports state) is already charted.
        const obs = chartDataRef.current?.rosObservations ?? [];
        const isCharted = (leaf: RosLeaf): boolean => {
          const fk = rosField(leaf.baseKey, finding === 'denies' ? RosFindingState.Denies : RosFindingState.Reports);
          return obs.some((o) => o.field === fk && o.value === true);
        };
        const remainingScored = scoredMatches.filter((s) => !isCharted(s.leaf));
        const symptomLabel = symptom || intent.display;
        if (scoredMatches.length === 0) {
          setConv({
            kind: 'skipped',
            user: message,
            reason: `I couldn't find a Review of Systems option that matches “${symptomLabel}”.`,
          });
        } else if (remainingScored.length === 0) {
          setConv({
            kind: 'skipped',
            user: message,
            reason: `“${symptomLabel}” is already on the Review of Systems.`,
          });
        } else {
          // Interactive follow-up + genuinely ambiguous (several near-equal matches) → let the
          // provider pick. Otherwise auto-pick the top match and flag it for review.
          const cluster = interactive ? ambiguousCluster(remainingScored) : null;
          if (cluster && cluster.length > 1) {
            setConv({ kind: 'choose-ros', user: message, intent: matchIntent, finding, matches: cluster });
          } else {
            const ids = await handleRosPick(remainingScored[0].leaf, finding, message);
            flagAiObsIds(ids, 'rosObservations', remainingScored[0].leaf.label);
          }
        }
        return;
      }
      // Add flow — no stopping: always auto-pick the top match.
      const results = await runIntentSearch(intent, oystehr, oystehrZambda);
      if (intent.kind === 'add-medication' && results.length > 0) {
        // Dose safety: the dictated strength is the one thing we must never silently change.
        // runIntentSearch already strength-ranks, but ranking alone still auto-picks SOMETHING
        // even when the dictated dose isn't in the catalog results — that's how "5 mg" became a
        // charted "7.5 MG". So when a strength was dictated, only auto-pick a product whose
        // strength actually matches it; if none of the results match, do NOT substitute a
        // different dose — open the picker so the provider explicitly chooses (or corrects).
        // Match on the combination-aware key so a dictated "325 mg / 5 mg" recognizes the catalog's
        // "5-325 MG" as the same strength (order/separator differ) instead of falsely opening a picker.
        const wantStrength = intent.strength?.trim() ?? '';
        const strengthMatches = wantStrength
          ? results.filter((r) => r.strength && strengthCompatible(wantStrength, r.strength))
          : results;
        if (wantStrength && strengthMatches.length === 0) {
          setConv({ kind: 'choose', user: message, intent, results });
          return;
        }
        const pick = strengthMatches[0] ?? results[0];
        const candidates = wantStrength ? strengthMatches : results;
        await handlePick(intent, pick, message, {
          field: KIND_TO_FIELD[intent.kind],
          display: intent.display || pick.name,
          searchTerms: intent.searchTerms,
          lowConfidence: candidates.length > 1,
        });
        return;
      }
      if (results.length === 0) {
        setConv({ kind: 'no-match', user: message, intent });
      } else if (AUTO_CHART_KINDS.has(intent.kind)) {
        // Search-based add types get the needs-review highlight + click-to-correct, with
        // low-confidence flagged when the search was ambiguous (>1 plausible match).
        const provenance: AiChartedMeta = {
          field: KIND_TO_FIELD[intent.kind],
          display: 'display' in intent && intent.display ? intent.display : results[0].name,
          searchTerms: 'searchTerms' in intent && Array.isArray(intent.searchTerms) ? intent.searchTerms : [],
          lowConfidence: results.length > 1,
        };
        await handlePick(intent, results[0], message, provenance);
      } else {
        // Anything else (no field mapping) auto-picks the top match without the correct affordance.
        await handlePick(intent, results[0], message);
      }
    } catch (e) {
      console.error('Dispatch failed:', e);
      setConv({ kind: 'error', user: message, reply: 'Something went wrong. Please try again.' });
    }
  };

  // Heuristic: if the provider's message is long-ish or visibly contains multiple sentences,
  // route through the planner (narrative → ordered intents). Otherwise treat it as a single
  // request and use the single-shot agent.
  const looksLikeNarrative = (msg: string): boolean => {
    if (msg.length >= 140) return true;
    // Count sentence-end punctuation followed by whitespace/EOL — a couple of sentences in a
    // shorter message is a narrative; a single declarative isn't.
    const sentenceEnds = msg.match(/[.!?](?:\s|$)/g);
    return (sentenceEnds?.length ?? 0) >= 2;
  };

  // Per-picker refinement input. Keyed by the picker's user message so each picker session
  // gets its own field; cleared on picker close.
  const [pickerRefineText, setPickerRefineText] = useState('');

  // Multi-select state for the exam-finding picker: the provider can check several matching
  // leaves (e.g. "warm" AND "swollen") and add them all at once. Holds leafKey()s. Reset
  // whenever a new choose-exam picker opens (see dispatchIntent's add-exam-finding branch).
  const [examPickSelected, setExamPickSelected] = useState<Set<string>>(new Set());

  // Skip the active picker — sets conv to terminal 'skipped'. In plan mode this advances the
  // cursor with status="skipped" so the running step list shows ⏭ for this step.
  const handleSkipPicker = (): void => {
    if (!conv) return;
    setConv({ kind: 'skipped', user: conv.user });
    setPickerRefineText('');
  };

  // Refine the active picker — append the provider's free-text refinement to the intent's
  // display + searchTerms and re-dispatch. Works for any picker whose intent kind we can
  // re-dispatch through dispatchIntent (all add-*, remove-*, exam-*, template, procedure).
  const handleRefinePicker = (
    intent:
      | EasyChartAgentIntent
      | RemoveIntent
      | ApplyTemplateIntent
      | AddProcedureIntent
      | UpdateProcedureIntent
      | AddExamFindingIntent
      | RemoveExamFindingIntent,
    refinement: string
  ): void => {
    const text = refinement.trim();
    if (!text || !conv) return;
    const userMsg = conv.user;
    // Most intent kinds carry display + searchTerms. update-procedure / set-em-code / etc.
    // don't have a display the matcher uses, so refine isn't meaningful for them — skip the
    // re-dispatch and just clear the input.
    if (!('display' in intent)) return;
    // Re-search: each refine REPLACES the query with exactly what the provider typed, rather
    // than appending to the running query. Appending made refines cumulative and irreversible
    // — e.g. the procedure matcher ORs query tokens, so once "lac repair" was added "go back to
    // just splint" couldn't drop it and the list only ever grew. Replacing means the picker
    // always reflects the current text, so you can narrow, switch, or revert freely.
    const augmented = {
      ...intent,
      display: text,
      searchTerms: [text],
    } as EasyChartAgentIntent;
    setPickerRefineText('');
    pendingProvenanceRef.current = null; // provider-driven refine → no inferred mark
    // Refining happens inside an already-interactive picker, so keep interactive mode: a still-
    // ambiguous refined query re-prompts rather than silently auto-picking.
    void dispatchIntent(augmented, userMsg, true);
  };

  const handleSend = async (): Promise<void> => {
    const message = refineText.trim();
    if (!message || !oystehrZambda || !encounterId) return;
    pushUserMessage(message);
    setConv({ kind: 'thinking', user: message });
    setRefineText('');
    try {
      const noteContext = buildNoteContext();
      if (looksLikeNarrative(message)) {
        // Pass what's already charted so the planner never duplicates existing items — but only
        // mark the call INCREMENTAL when the note has actually been charted (a plan already ran
        // this session, or the chart carries an E&M from an earlier write-up). A FIRST dictation
        // for a patient with intake-harvested history (paperwork allergies/meds/conditions) has a
        // non-empty chartState but is NOT incremental: it must still get the full template/exam/
        // E&M pass. encounterId lets the planner anchor demographics on the real Patient.
        const chartState = buildChartStateSummary(chartDataRef.current);
        const incremental = !!lastNarrativeRef.current || !!chartDataRef.current?.emCode;
        const planRes = await easyChartPlanner(oystehrZambda, {
          narrative: message,
          noteContext,
          chartState,
          encounterId,
          incremental,
        });
        recordUsage(planRes.usage);
        // Planner-path primary carry-over (same class as the review swap bug): a dictated
        // correction can remove the charted PRIMARY dx and add its replacement in ONE plan — and
        // on an incremental message the planner server's never-usurp rule has already demoted the
        // adds to explicit isPrimary:false, so nothing would restore a primary. Resolve the remove
        // against the chart BEFORE execution and reclaim the primary onto the replacement.
        // Add-only plans (no remove-diagnosis) pass through untouched — never-usurp stays intact.
        const steps = carrySwapPrimary(planRes.steps, chartDataRef.current, { reclaimPrimary: true });
        if (steps.length === 0) {
          setConv({
            kind: 'unknown',
            user: message,
            reply: "I couldn't find any chart actions in that narrative.",
          });
          return;
        }
        // Auto-chart: start executing immediately as a single evolving plan card — no separate
        // approve step. Each AI-charted item still gets the needs-review highlight + click-to-correct,
        // and Remove still works, so nothing here is unrecoverable.
        medDoseMismatchRef.current = []; // fresh dose-substitution tally for this plan
        setPlan({ narrative: message, steps, currentIdx: 0, results: [] });
        return;
      }
      const agentRes = await easyChartAgent(oystehrZambda, { message, noteContext });
      recordUsage(agentRes.usage);
      const { intent } = agentRes;
      pendingProvenanceRef.current = null; // provider-typed command → no inferred mark
      await dispatchIntent(intent, message, true);
    } catch (e) {
      console.error('Send failed:', e);
      captureException(e);
      setConv({ kind: 'error', user: message, reply: 'Something went wrong. Please try again.' });
    }
  };

  const handleRemovePick = async (match: RemoveMatch, user: string): Promise<void> => {
    if (!apiClient || !encounterId) return;
    setConv({ kind: 'removing', user, chosenName: match.displayName });
    try {
      // Removing an item also clears its needs-review flag — otherwise the banner keeps counting a
      // dangling entry keyed to a deleted resource (same rule as removeInline).
      clearAiChartedId(match.resourceId);
      await apiClient.deleteChartData({ encounterId, [match.field]: [match.dto] } as Parameters<
        typeof apiClient.deleteChartData
      >[0]);
      flashAndRemoveItem(match.resourceId, () => {
        setChartData((prev) => {
          if (!prev) return prev;
          const next: GetChartDataResponse = { ...prev };
          const list = (next[match.field] as Array<{ resourceId?: string }> | undefined) ?? [];
          (next[match.field] as unknown[]) = list.filter((x) => x.resourceId !== match.resourceId);
          return next;
        });
      });
      setConv({ kind: 'removed', user, chosenName: match.displayName });
    } catch (e) {
      console.error('Remove failed:', e);
      setConv({ kind: 'error', user, reply: `Could not remove "${match.displayName}". Please try again.` });
    }
  };

  // Build a free-text summary of what's currently on the chart, for the planner refresh
  // after apply-template. Only includes the categories the planner can emit add-* steps for.
  const buildChartStateSummary = (data: GetChartDataResponse | null | undefined): string => {
    if (!data) return '';
    const lines: string[] = [];
    if (data.diagnosis?.length) {
      lines.push(
        `Diagnoses: ${data.diagnosis
          .map((d) => `${d.code} — ${d.display}${d.isPrimary ? ' (primary)' : ''}`)
          .join('; ')}`
      );
    }
    if (data.conditions?.length) {
      lines.push(`Past medical conditions: ${data.conditions.map((c) => `${c.code} — ${c.display}`).join('; ')}`);
    }
    if (data.medications?.length) {
      lines.push(`Medications: ${data.medications.map((m) => m.name).join('; ')}`);
    }
    if (data.allergies?.length) {
      lines.push(`Allergies: ${data.allergies.map((a) => a.name).join('; ')}`);
    }
    if (data.surgicalHistory?.length) {
      lines.push(`Surgical history: ${data.surgicalHistory.map((s) => s.display).join('; ')}`);
    }
    if (data.episodeOfCare?.length) {
      lines.push(`Hospitalizations: ${data.episodeOfCare.map((h) => h.display).join('; ')}`);
    }
    if (data.procedures?.length) {
      lines.push(
        `Procedures on encounter: ${data.procedures
          .map((p) => p.procedureType ?? p.cptCodes?.[0]?.display ?? 'procedure')
          .join('; ')}`
      );
    }
    const checkedExam = (data.examObservations ?? []).filter((o) => o.value === true);
    if (checkedExam.length > 0) {
      // Group by section label for readability.
      const bySection: Record<string, string[]> = {};
      for (const o of checkedExam) {
        const section = FIELD_TO_SECTION_LABEL[o.field] ?? 'Other';
        const checked = (o.components ?? []).filter((c) => c.value);
        const label =
          checked.length > 0 ? `${o.label ?? o.field} (${checked.map((c) => c.label).join(', ')})` : o.label ?? o.field;
        (bySection[section] ??= []).push(label);
      }
      lines.push(
        'Exam findings already checked:\n' +
          Object.entries(bySection)
            .map(([sec, items]) => `  ${sec}: ${items.join('; ')}`)
            .join('\n')
      );
    }
    // ROS findings already charted (the pertinent positives/negatives). Without this, the review
    // pass can't see charted ROS and re-suggests "add the pertinent negatives you noted" for
    // negatives the planner already captured.
    const checkedRos = (data.rosObservations ?? []).filter((o) => o.value === true);
    if (checkedRos.length > 0) {
      lines.push('ROS findings already charted: ' + checkedRos.map((o) => rosObsLabel(o)).join('; '));
    }
    if (data.medicalDecision?.text?.trim()) {
      lines.push(`MDM already present (length ${data.medicalDecision.text.trim().length} chars).`);
    }
    if (data.emCode?.code) {
      lines.push(
        `E&M code already charted: ${data.emCode.code}${data.emCode.display ? ` — ${data.emCode.display}` : ''}.`
      );
    }
    // CPT + disposition lines: the review's "cpt" and "disposition" checks skip anything already
    // charted, and they can only see it through this summary.
    if (data.cptCodes?.length) {
      lines.push(
        `CPT codes already charted: ${data.cptCodes
          .map((c) => `${c.code}${c.display ? ` — ${c.display}` : ''}`)
          .join('; ')}`
      );
    }
    if (data.disposition?.type) {
      lines.push(
        `Disposition already set: ${data.disposition.type}${data.disposition.note ? ` — ${data.disposition.note}` : ''}`
      );
    }
    // Lab orders live outside chartData; include them so a re-plan doesn't re-order the same test.
    if (labOrders.length) {
      lines.push(
        `Labs already ordered: ${labOrders
          .map((o) => `${o.testName} (${o.kind === 'in-house' ? 'in-house' : o.labName ?? 'send-out'})`)
          .join('; ')}`
      );
    }
    return lines.join('\n');
  };

  const handleApplyTemplate = async (template: TemplateMatch, user: string): Promise<void> => {
    if (!apiClient || !oystehrZambda || !encounterId) return;
    setConv({ kind: 'applying-template', user, chosenName: template.title });
    try {
      // Snapshot resourceIds present BEFORE applying so we can flash anything new afterward.
      const before = collectResourceIds(chartDataRef.current);
      await applyTemplate(oystehrZambda, { encounterId, templateName: template.title });
      const fresh = await fetchEasyChartData(apiClient, encounterId);
      setChartData(fresh);
      const newIds = [...collectResourceIds(fresh)].filter((id) => !before.has(id));
      // Flag template-applied structured items as AI-charted (needs review) so they get the
      // highlight + click-to-correct — the most common way a diagnosis reaches the chart is via a
      // template, which otherwise bypasses the review affordance.
      const newIdSet = new Set(newIds);
      const templateAiCharted = new Map<string, AiChartedMeta>();
      const flagNew = (
        field: AiField,
        items: Array<{ resourceId?: string; name?: string; display?: string; code?: string }> | undefined
      ): void => {
        for (const item of items ?? []) {
          if (!item.resourceId || !newIdSet.has(item.resourceId)) continue;
          const display = chartedItemDisplay(field, item);
          templateAiCharted.set(item.resourceId, {
            field,
            display,
            searchTerms: [display].filter(Boolean),
            lowConfidence: false,
            templateName: template.title,
          });
        }
      };
      flagNew('diagnosis', fresh.diagnosis);
      flagNew('allergies', fresh.allergies);
      flagNew('conditions', fresh.conditions);
      flagNew('medications', fresh.medications);
      flagNew('surgicalHistory', fresh.surgicalHistory);
      flagNew('episodeOfCare', fresh.episodeOfCare);
      flagNew('cptCodes', fresh.cptCodes);
      // E&M is a scalar, not an array — flag it directly if the template added it.
      if (fresh.emCode?.resourceId && newIdSet.has(fresh.emCode.resourceId)) {
        templateAiCharted.set(fresh.emCode.resourceId, {
          field: 'emCode',
          display: chartedItemDisplay('emCode', fresh.emCode),
          searchTerms: [],
          lowConfidence: false,
          templateName: template.title,
        });
      }
      if (templateAiCharted.size > 0) {
        setAiCharted((prev) => {
          const next = new Map(prev);
          for (const [id, meta] of templateAiCharted) next.set(id, meta);
          return next;
        });
      }
      if (newIds.length > 0) {
        setFreshlyAdded((prev) => {
          const next = new Set(prev);
          newIds.forEach((id) => next.add(id));
          return next;
        });
        const tryScroll = (attempt: number): void => {
          const el = document.querySelector<HTMLElement>(`[data-easy-chart-id="${newIds[0]}"]`);
          if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
          else if (attempt < 10) setTimeout(() => tryScroll(attempt + 1), 50);
        };
        requestAnimationFrame(() => requestAnimationFrame(() => tryScroll(0)));
        setTimeout(() => {
          setFreshlyAdded((prev) => {
            const next = new Set(prev);
            newIds.forEach((id) => next.delete(id));
            return next;
          });
        }, 3000);
      }
      // Plan refresh: if a plan is active, re-call the planner with what's now on the chart so
      // remaining steps reflect what the template did. The template typically pre-fills exam
      // findings, a diagnosis, MDM, and patient instructions — without a refresh the planner's
      // original "add-diagnosis", "add-exam-finding", "edit medicalDecision" steps would
      // produce duplicates or overwrite the template's content. Best-effort: if the refresh
      // fails for any reason, fall back to the original plan with the in-flight dedup checks.
      const planSnapshot = planRef.current;
      if (planSnapshot && oystehrZambda) {
        try {
          // Lead with the applied template name — chartState alone (lists of findings/codes)
          // didn't make it obvious enough and the LLM kept re-emitting apply-template.
          const chartStateSummary = `Template "${
            template.title
          }" has ALREADY been applied to this chart — do NOT emit apply-template again.\n\n${buildChartStateSummary(
            fresh
          )}`;
          const noteContext = buildNoteContext();
          const replanRes = await easyChartPlanner(oystehrZambda, {
            narrative: planSnapshot.narrative,
            noteContext,
            chartState: chartStateSummary,
            encounterId,
            incremental: true,
          });
          recordUsage(replanRes.usage);
          const { steps: refreshed } = replanRes;
          // Defense-in-depth: drop any apply-template from the refresh output. The template
          // is already on the chart; a second apply-template would either duplicate (if it
          // matches) or replace the wrong fields (if a different template name comes back).
          const refreshedFiltered = refreshed.filter((s) => s.kind !== 'apply-template');
          // The re-plan (flash-lite) intermittently DROPS exam-finding steps — including the
          // reconciliation pair that removes a template normal and adds the dictated abnormal
          // (e.g. remove "Oropharynx clear", add "Oropharynx mildly injected"). Those are reliably
          // present in the user-approved first-pass plan, and the add-exam-finding dispatch already
          // dedups anything the template charted, so preserve the first-pass exam steps the re-plan
          // omitted rather than letting the reconciliation silently vanish.
          const isExamStep = (s: EasyChartAgentIntent): boolean =>
            s.kind === 'add-exam-finding' || s.kind === 'remove-exam-finding';
          const examKey = (s: EasyChartAgentIntent): string =>
            `${s.kind}|${('display' in s ? s.display : '')
              .toLowerCase()
              .replace(/[^a-z]/g, '')
              .slice(0, 24)}`;
          const refreshExamKeys = new Set(refreshedFiltered.filter(isExamStep).map(examKey));
          const pendingOriginal = planSnapshot.steps.slice(planSnapshot.currentIdx + 1);
          const missingExam = pendingOriginal.filter((s) => isExamStep(s) && !refreshExamKeys.has(examKey(s)));
          // Note-text edits (CC / HPI / mechanism / MDM) are faithful transcriptions of the dictation
          // captured in the FIRST pass. The post-template re-plan mishandles them two ways: it DROPS
          // them (the chief complaint never gets written → blank field) or RE-SUMMARIZES them into a
          // generic stub (a detailed HPI becomes "Patient presents with <dx>"). The template doesn't
          // meaningfully author these free-text fields, so ALWAYS use the first-pass note edits and
          // discard the re-plan's — edit-note-text overwrites, so this is idempotent and keeps the
          // note faithful to what was dictated.
          const isNoteEdit = (s: EasyChartAgentIntent): boolean => s.kind === 'edit-note-text';
          const firstPassNoteEdits = pendingOriginal.filter(isNoteEdit);
          // The re-plan re-emits diagnoses and billing codes that the first pass (or the template
          // itself) already charted. Unlike exam findings — whose dispatch dedups against what's on
          // the chart — add-diagnosis / set-em-code / add-cpt are NOT idempotent: each re-emission
          // writes a fresh resource, producing duplicates (two J02.0 Conditions, two 99214 E&M
          // Procedures). Drop any re-plan step whose code is already in the post-template chart
          // state. E&M is singular, so re-emit it only when none is charted yet.
          const chartedDxCodes = new Set(
            (fresh.diagnosis ?? []).map((d) => d.code?.toUpperCase()).filter((c): c is string => !!c)
          );
          const chartedCptCodes = new Set(
            (fresh.cptCodes ?? []).map((c) => c.code?.toUpperCase()).filter((c): c is string => !!c)
          );
          const hasEmCode = !!fresh.emCode?.code;
          const isAlreadyCharted = (s: EasyChartAgentIntent): boolean => {
            if ((s.kind === 'add-diagnosis' || s.kind === 'add-condition') && 'code' in s && s.code)
              return chartedDxCodes.has(s.code.toUpperCase());
            if (s.kind === 'set-em-code') return hasEmCode;
            if (s.kind === 'add-cpt' && 'code' in s && s.code) return chartedCptCodes.has(s.code.toUpperCase());
            return false;
          };
          // Same planner-path primary carry-over as the initial plan, resolved against the
          // POST-template chart: if the pending steps swap out the current primary dx, the
          // replacement add reclaims primary instead of leaving the note with none.
          const mergedSteps = carrySwapPrimary(
            [
              ...refreshedFiltered.filter((s) => !isNoteEdit(s) && !isAlreadyCharted(s)),
              ...missingExam,
              ...firstPassNoteEdits,
            ],
            fresh,
            { reclaimPrimary: true }
          );
          // Splice: keep completed steps + their results; replace pending steps with the merge.
          // The apply-template step itself hasn't terminally settled yet (we're still inside
          // handleApplyTemplate), so it's still at currentIdx. Move forward into the merged steps.
          setPlan((prev) => {
            if (!prev) return null;
            const doneSteps = prev.steps.slice(0, prev.currentIdx + 1); // include apply-template
            return {
              ...prev,
              steps: [...doneSteps, ...mergedSteps],
            };
          });
        } catch (e) {
          // Intentional degrade (the original plan's in-flight dedup still guards duplicates) but
          // captured — a silently failing refresh means every templated plan risks duplicates.
          console.warn('Plan refresh after template failed; proceeding with original plan:', e);
          captureException(e);
        }
      }
      setConv({ kind: 'applied-template', user, chosenName: template.title });
    } catch (e) {
      console.error('Apply template failed:', e);
      setConv({ kind: 'error', user, reply: `Could not apply template "${template.title}". Please try again.` });
    }
  };

  // Core two-step procedure save, shared by the chat-agent picker (handleProcedurePick) and the
  // command-palette "Add Procedure" items. Mirrors the regular Procedures page: CPT codes +
  // diagnoses must exist as FHIR Procedure / Condition resources before the procedure
  // ServiceRequest can reference them — so save those first, capture their resourceIds from the
  // response, then save the procedure pointing at them. Throws on failure (callers report).
  const saveProcedureFromQuickPick = async (
    qp: ProcedureQuickPickData
  ): Promise<{ resourceId?: string; inferredFields: Set<string> } | undefined> => {
    if (!apiClient || !encounterId) return;
    // DEDUP: a procedure quick-pick carries its own linked diagnoses + CPT codes. Re-saving ones the
    // note already has (e.g. the planner already charted "UTI" / "Fever" from the dictation) is what
    // produced duplicate diagnoses. So save ONLY codes not already on the chart, and link the
    // procedure to the EXISTING resource for codes that are.
    const existingDx = chartDataRef.current?.diagnosis ?? [];
    const existingCpt = chartDataRef.current?.cptCodes ?? [];
    const existingDxByCode = new Map(existingDx.filter((d) => d.code).map((d) => [d.code, d] as const));
    const existingCptByCode = new Map(existingCpt.filter((c) => c.code).map((c) => [c.code, c] as const));
    const newDx = (qp.diagnoses ?? []).filter((d) => d.code && !existingDxByCode.has(d.code));
    const newCpt = (qp.cptCodes ?? []).filter((c) => c.code && !existingCptByCode.has(c.code));
    const step1 = await apiClient.saveChartData({
      encounterId,
      ...(newCpt.length ? { cptCodes: newCpt } : {}),
      // DiagnosisDTO.isPrimary became required upstream; a procedure's linked diagnoses are
      // supporting dx, not the encounter's primary, so default them to false.
      ...(newDx.length ? { diagnosis: newDx.map((d) => ({ ...d, isPrimary: false })) } : {}),
    });
    mergeSaveResponse(step1);
    const savedNewDx = step1.chartData?.diagnosis ?? [];
    const savedNewCpt = step1.chartData?.cptCodes ?? [];
    // Resolve every linked code to a charted resource: reuse the existing one, else the just-saved new
    // one — so the procedure links the right Conditions/Procedures without creating duplicates.
    const linkedDx = (qp.diagnoses ?? [])
      .map((d) => existingDxByCode.get(d.code) ?? savedNewDx.find((s) => s.code === d.code))
      .filter((d): d is DiagnosisDTO => !!d?.resourceId);
    const linkedCpt = (qp.cptCodes ?? [])
      .map((c) => existingCptByCode.get(c.code) ?? savedNewCpt.find((s) => s.code === c.code))
      .filter((c): c is CPTCodeDTO => !!c?.resourceId);
    // The genuinely-new procedure-linked dx/CPT are template-derived (not dictated) → flag them for
    // review as inferred, so a spurious linked code (e.g. "Retention of urine" on a catheterization
    // template) is surfaced rather than silently authoritative.
    const flagged = new Map<string, AiChartedMeta>();
    for (const d of savedNewDx)
      if (d.resourceId && newDx.some((n) => n.code === d.code))
        flagged.set(d.resourceId, {
          field: 'diagnosis',
          display: d.display ?? d.code,
          searchTerms: [],
          lowConfidence: false,
          inferred: true,
        });
    for (const c of savedNewCpt)
      if (c.resourceId && newCpt.some((n) => n.code === c.code))
        flagged.set(c.resourceId, {
          field: 'cptCodes',
          display: c.display ?? c.code,
          searchTerms: [],
          lowConfidence: false,
          inferred: true,
        });
    if (flagged.size > 0) setAiCharted((prev) => new Map([...prev, ...flagged]));
    const procDto: ProcedureDTO = {
      ...procedureDtoFromQuickPick(qp, procedureTypeNameByCode),
      cptCodes: linkedCpt.length > 0 ? linkedCpt : undefined,
      diagnoses: linkedDx.length > 0 ? linkedDx : undefined,
    };
    // Which verify-able fields the template actually filled in — those become the per-field review set.
    const inferredFields = new Set<string>();
    for (const f of PROCEDURE_VERIFY_FIELDS) {
      const v = procDto[f];
      const has = Array.isArray(v) ? v.length > 0 : v != null && String(v).trim() !== '';
      if (has) inferredFields.add(f as string);
    }
    // Capture the PROCEDURE's resourceId specifically by diffing the procedures array. Don't use
    // saveAndMerge's flat newIds[0]: on a fresh chart the step-2 response also reports the step-1
    // cpt/dx as "new" (chartDataRef is still pre-step-1 until the next render), so newIds[0] would be
    // a diagnosis id and the provenance entry would be keyed to the wrong resource.
    const beforeProcIds = new Set(
      (chartDataRef.current?.procedures ?? []).map((p) => p.resourceId).filter((id): id is string => !!id)
    );
    const step2 = await apiClient.saveChartData({ encounterId, procedures: [procDto] });
    mergeSaveResponse(step2);
    const newProc = (step2.chartData?.procedures ?? []).find((p) => p.resourceId && !beforeProcIds.has(p.resourceId));
    return { resourceId: newProc?.resourceId, inferredFields };
  };
  // Keep the palette's stable onSelect pointed at the latest closure.
  saveProcedureFromQuickPickRef.current = saveProcedureFromQuickPick;

  const handleProcedurePick = async (qp: ProcedureQuickPickData, user: string): Promise<void> => {
    if (!apiClient || !encounterId) return;
    setConv({ kind: 'saving', user, chosenName: qp.name });
    // Capture this step's source phrase before the await — pendingProvenanceRef gets overwritten by
    // the next plan step.
    const sourceText = pendingProvenanceRef.current?.sourceText;
    try {
      const prov = await saveProcedureFromQuickPick(qp);
      // Register field-level provenance: the template-default fields become the per-field review set.
      if (prov?.resourceId && prov.inferredFields.size > 0) {
        const resourceId = prov.resourceId;
        setProcedureProv((prev) => new Map(prev).set(resourceId, { sourceText, inferredFields: prov.inferredFields }));
      }
      setConv({ kind: 'done', user, chosenName: qp.name });
    } catch (e) {
      console.error('Add procedure failed:', e);
      setConv({ kind: 'error', user, reply: `Could not add procedure "${qp.name}". Please try again.` });
    }
  };

  // Chart a structured ROS finding: save the leaf's -reports or -denies observation (value=true),
  // and uncheck the opposite-state observation if it was set (denies/reports are mutually exclusive).
  const handleRosPick = async (leaf: RosLeaf, finding: 'reports' | 'denies', user: string): Promise<string[]> => {
    if (!apiClient || !encounterId) return [];
    const stateLabel = `${finding === 'denies' ? 'Denies' : 'Reports'} ${leaf.label}`;
    setConv({ kind: 'saving', user, chosenName: stateLabel });
    try {
      const state = finding === 'denies' ? RosFindingState.Denies : RosFindingState.Reports;
      const pairedState = finding === 'denies' ? RosFindingState.Reports : RosFindingState.Denies;
      const fieldKey = rosField(leaf.baseKey, state);
      const pairedKey = rosField(leaf.baseKey, pairedState);
      const obs = chartDataRef.current?.rosObservations ?? [];
      const existing = obs.find((o) => o.field === fieldKey);
      const paired = obs.find((o) => o.field === pairedKey);
      const updates: ExamObservationDTO[] = [
        { field: fieldKey, label: leaf.label, value: true, resourceId: existing?.resourceId },
      ];
      if (paired?.value === true) {
        updates.push({ field: pairedKey, label: leaf.label, value: false, resourceId: paired.resourceId });
      }
      const newIds = await saveAndMerge({ encounterId, rosObservations: updates });
      setConv({ kind: 'done', user, chosenName: stateLabel });
      return newIds;
    } catch (e) {
      console.error('Add ROS finding failed:', e);
      setConv({ kind: 'error', user, reply: `Could not add "${stateLabel}". Please try again.` });
      return [];
    }
  };

  const handleExamPick = async (leaf: ExamLeaf, user: string): Promise<string[]> => {
    if (!apiClient || !encounterId) return [];
    setConv({ kind: 'saving', user, chosenName: leaf.label });
    let newIds: string[] = [];
    try {
      if (leaf.modalOption) {
        // Modal-option leaf: write as a `components` entry on the parent observation, the
        // same shape that ExamCheckboxWithModal.handleCloseModal saves. Preserve any
        // existing components on the parent observation that the provider had already
        // checked via the regular UI.
        const existing = (chartDataRef.current?.examObservations ?? []).find((o) => o.field === leaf.field);
        const existingComponents = existing?.components ?? [];
        const newComponent = {
          code: leaf.modalOption.optionCode,
          label: leaf.modalOption.optionLabel,
          value: true,
          groupLabel: leaf.modalOption.groupLabel,
          ...(leaf.modalOption.columnLabel ? { columnLabel: leaf.modalOption.columnLabel } : {}),
          abnormal: leaf.modalOption.abnormal,
        };
        // Dedup: replace by code if already present
        const merged = [...existingComponents.filter((c) => c.code !== newComponent.code), newComponent];
        newIds = await saveAndMerge({
          encounterId,
          examObservations: [
            {
              ...(existing?.resourceId ? { resourceId: existing.resourceId } : {}),
              field: leaf.field,
              // Preserve any existing label on the observation (set by the regular UI); fall
              // back to the parent checkbox label so the easy-chart render shows something
              // human-readable instead of the kebab-case field code.
              label: existing?.label ?? leaf.modalOption.parentLabel,
              value: true,
              components: merged,
            },
          ],
        });
      } else {
        // Plain checkbox leaf: simple field+value save.
        newIds = await saveAndMerge({
          encounterId,
          examObservations: [{ field: leaf.field, label: leaf.label, value: true }],
        });
      }
      setConv({ kind: 'done', user, chosenName: leaf.label });
      return newIds;
    } catch (e) {
      console.error('Add exam finding failed:', e);
      setConv({ kind: 'error', user, reply: `Could not add "${leaf.label}" to the exam. Please try again.` });
      return [];
    }
  };

  // Add several exam-finding leaves at once (from the multi-select picker). Leaves are grouped
  // by parent `field` so multiple modal-options under the same checkbox merge into ONE
  // observation's `components[]` (two separate saves would clobber each other), and so a plain
  // checkbox + its modal-options collapse into a single observation. Everything goes in one
  // saveAndMerge call.
  const handleExamPickMulti = async (leaves: ExamLeaf[], user: string): Promise<void> => {
    if (!apiClient || !encounterId || leaves.length === 0) return;
    const summary = leaves.map((l) => l.label).join(', ');
    setConv({ kind: 'saving', user, chosenName: summary });
    try {
      const byField = new Map<string, ExamLeaf[]>();
      for (const leaf of leaves) {
        byField.set(leaf.field, [...(byField.get(leaf.field) ?? []), leaf]);
      }

      const examObservations = Array.from(byField.entries()).map(([field, fieldLeaves]) => {
        const existing = (chartDataRef.current?.examObservations ?? []).find((o) => o.field === field);
        const modalLeaves = fieldLeaves.filter((l) => l.modalOption);
        const plainLeaf = fieldLeaves.find((l) => !l.modalOption);

        if (modalLeaves.length > 0) {
          const newComponents = modalLeaves.map((l) => ({
            code: l.modalOption!.optionCode,
            label: l.modalOption!.optionLabel,
            value: true,
            groupLabel: l.modalOption!.groupLabel,
            ...(l.modalOption!.columnLabel ? { columnLabel: l.modalOption!.columnLabel } : {}),
            abnormal: l.modalOption!.abnormal,
          }));
          const newCodes = new Set(newComponents.map((c) => c.code));
          const merged = [...(existing?.components ?? []).filter((c) => !newCodes.has(c.code)), ...newComponents];
          return {
            ...(existing?.resourceId ? { resourceId: existing.resourceId } : {}),
            field,
            label: existing?.label ?? modalLeaves[0].modalOption!.parentLabel,
            value: true,
            components: merged,
          };
        }
        // Plain checkbox leaf(s) only.
        return {
          ...(existing?.resourceId ? { resourceId: existing.resourceId } : {}),
          field,
          label: plainLeaf!.label,
          value: true,
        };
      });

      await saveAndMerge({ encounterId, examObservations });
      setConv({ kind: 'done', user, chosenName: summary });
    } catch (e) {
      console.error('Add exam findings failed:', e);
      setConv({ kind: 'error', user, reply: `Could not add those findings to the exam. Please try again.` });
    }
  };

  const handleExamRemove = async (item: ExamRemoveItem, user: string): Promise<void> => {
    if (!apiClient || !encounterId) return;
    setConv({ kind: 'removing', user, chosenName: item.displayName });
    try {
      if (!item.componentCode) {
        // Plain observation — delete it outright.
        const obs = chartDataRef.current?.examObservations?.find((o) => o.resourceId === item.resourceId);
        if (!obs) {
          setConv({ kind: 'error', user, reply: `Couldn't find that exam finding to remove.` });
          return;
        }
        flashAndRemoveItem(item.resourceId, () => {
          setChartData((prev) =>
            prev
              ? {
                  ...prev,
                  examObservations: (prev.examObservations ?? []).filter((o) => o.resourceId !== item.resourceId),
                }
              : prev
          );
        });
        await apiClient.deleteChartData({ encounterId, examObservations: [obs] } as Parameters<
          typeof apiClient.deleteChartData
        >[0]);
      } else {
        // Component-level removal — uncheck this component. If it's the last checked one,
        // delete the whole observation (mirrors the regular ExamCheckboxWithModal behavior).
        const obs = chartDataRef.current?.examObservations?.find((o) => o.resourceId === item.resourceId);
        if (!obs) {
          setConv({ kind: 'error', user, reply: `Couldn't find that exam finding to remove.` });
          return;
        }
        const remainingChecked = (obs.components ?? []).filter((c) => c.value && c.code !== item.componentCode);
        if (remainingChecked.length === 0) {
          flashAndRemoveItem(item.resourceId, () => {
            setChartData((prev) =>
              prev
                ? {
                    ...prev,
                    examObservations: (prev.examObservations ?? []).filter((o) => o.resourceId !== item.resourceId),
                  }
                : prev
            );
          });
          await apiClient.deleteChartData({ encounterId, examObservations: [obs] } as Parameters<
            typeof apiClient.deleteChartData
          >[0]);
        } else {
          // Save with the chosen component set to value=false (preserved in components so the
          // modal still shows it as available on next open, matching regular UI behavior).
          const nextComponents = (obs.components ?? []).map((c) =>
            c.code === item.componentCode ? { ...c, value: false } : c
          );
          await saveAndMerge({
            encounterId,
            examObservations: [
              {
                resourceId: obs.resourceId,
                field: obs.field,
                ...(obs.label ? { label: obs.label } : {}),
                value: true,
                components: nextComponents,
              },
            ],
          });
        }
      }
      setConv({ kind: 'removed', user, chosenName: item.displayName });
    } catch (e) {
      console.error('Remove exam finding failed:', e);
      setConv({ kind: 'error', user, reply: `Could not remove "${item.displayName}". Please try again.` });
    }
  };

  // Delete a charted ROS observation (plain observation — no components, mirrors the exam plain-
  // observation delete path).
  const handleRosRemove = async (obs: ExamObservationDTO, user: string): Promise<void> => {
    if (!apiClient || !encounterId || !obs.resourceId) return;
    const label = rosObsLabel(obs);
    const resourceId = obs.resourceId;
    setConv({ kind: 'removing', user, chosenName: label });
    try {
      flashAndRemoveItem(resourceId, () => {
        setChartData((prev) =>
          prev
            ? { ...prev, rosObservations: (prev.rosObservations ?? []).filter((o) => o.resourceId !== resourceId) }
            : prev
        );
      });
      await apiClient.deleteChartData({ encounterId, rosObservations: [obs] } as Parameters<
        typeof apiClient.deleteChartData
      >[0]);
      setConv({ kind: 'removed', user, chosenName: label });
    } catch (e) {
      console.error('Remove ROS finding failed:', e);
      setConv({ kind: 'error', user, reply: `Could not remove "${label}". Please try again.` });
    }
  };

  // Single save path for a free-text note field, shared by the right-pane planner
  // (handleEditNoteText) and the left-pane inline editors (InlineNoteField via NoteSections).
  // `key` is the actual chart-data storage key — the CC↔HPI swap is applied by the caller. Saves
  // to the same field are serialized through a per-field promise chain so they can't race.
  const saveNoteField = (key: ChartNoteKey, text: string): Promise<void> => {
    if (!apiClient || !encounterId) return Promise.resolve();
    const run = async (): Promise<void> => {
      const existing = chartDataRef.current?.[key] as { resourceId?: string } | undefined;
      const payload: SaveChartDataRequest = {
        encounterId,
        [key]: { resourceId: existing?.resourceId, text },
      } as SaveChartDataRequest;
      await saveAndMerge(payload);
    };
    const prior = noteSaveChainRef.current[key] ?? Promise.resolve();
    const next = prior.then(run, run);
    noteSaveChainRef.current[key] = next;
    return next;
  };

  const handleEditNoteText = async (
    intent: Extract<EasyChartAgentIntent, { kind: 'edit-note-text' }>,
    user: string
  ): Promise<void> => {
    if (!apiClient || !encounterId) return;
    // Capture the dictation snippet this field was generated from (set per planner step) so the
    // provider can compare the AI-written prose against what they actually said.
    const provSrc = pendingProvenanceRef.current?.sourceText;
    // Map LLM-canonical field names to the corresponding chart-data scalar. The in-person
    // CC ↔ HPI swap (HpiField.tsx) means the textarea labeled "Chief Complaint" is backed
    // by historyOfPresentIllness and vice versa — we keep the agent honest by using the
    // human labels but writing to whichever chart-data key actually backs it.
    const fieldLabels: Record<typeof intent.field, string> = {
      chiefComplaint: 'Chief Complaint',
      historyOfPresentIllness: 'History of Present Illness',
      mechanismOfInjury: 'Mechanism of Injury',
      ros: 'Review of Systems',
      medicalDecision: 'Medical Decision Making',
    };
    const fieldLabel = fieldLabels[intent.field];
    // Re-apply the CC↔HPI swap when writing back. The LLM thinks of `chiefComplaint` as the
    // CC label's text, but in chart-data terms the CC label is backed by historyOfPresentIllness.
    const saveField: ChartNoteKey =
      intent.field === 'chiefComplaint'
        ? 'historyOfPresentIllness'
        : intent.field === 'historyOfPresentIllness'
        ? 'chiefComplaint'
        : intent.field;
    if (provSrc) {
      setNoteFieldMeta((prev) => {
        const n = new Map(prev);
        n.set(saveField, { ...n.get(saveField), sourceText: provSrc });
        return n;
      });
    }
    setConv({ kind: 'editing-note-text', user, fieldLabel });
    try {
      await saveNoteField(saveField, intent.newText);
      setConv({ kind: 'edited-note-text', user, fieldLabel });
    } catch (e) {
      console.error('Edit note text failed:', e);
      setConv({ kind: 'error', user, reply: `Could not update ${fieldLabel}. Please try again.` });
    }
  };

  // Inline structured-item removal from the left pane. Mirrors handleRemovePick (generic array
  // delete + removal flash) but without the right-pane conversation chatter; E&M is a scalar so
  // it gets its own branch. Errors surface via snackbar rather than the planner conversation.
  // Optimistic remove: drop the item from the UI immediately, delete in the background, and if the
  // delete fails restore the prior state + toast. Avoids the lag of waiting on the round-trip.
  const removeInline = async (field: string, dto: { resourceId?: string }): Promise<void> => {
    if (!apiClient || !encounterId || !dto.resourceId) return;
    const resourceId = dto.resourceId;
    clearAiChartedId(resourceId); // removing an item also clears any needs-review flag on it
    const snapshot = chartDataRef.current;
    setChartData((prev) => {
      if (!prev) return prev;
      const next: GetChartDataResponse = { ...prev };
      const list = (next[field as keyof GetChartDataResponse] as Array<{ resourceId?: string }> | undefined) ?? [];
      (next[field as keyof GetChartDataResponse] as unknown) = list.filter((x) => x.resourceId !== resourceId);
      return next;
    });
    try {
      await apiClient.deleteChartData({ encounterId, [field]: [dto] } as Parameters<
        typeof apiClient.deleteChartData
      >[0]);
    } catch (e) {
      console.error('Inline remove failed:', e);
      if (snapshot) setChartData(snapshot);
      enqueueSnackbar("Couldn't remove that item — it's been restored.", { variant: 'error' });
    }
  };

  const removeEmInline = async (dto: { resourceId?: string }): Promise<void> => {
    if (!apiClient || !encounterId || !dto.resourceId) return;
    const snapshot = chartDataRef.current;
    setChartData((prev) => (prev ? { ...prev, emCode: undefined } : prev));
    try {
      await apiClient.deleteChartData({ encounterId, emCode: dto } as Parameters<typeof apiClient.deleteChartData>[0]);
    } catch (e) {
      console.error('Inline E&M remove failed:', e);
      if (snapshot) setChartData(snapshot);
      enqueueSnackbar("Couldn't remove the E&M code — it's been restored.", { variant: 'error' });
    }
  };

  const handleInlineRemove = (field: string, dto: { resourceId?: string }): void => {
    if (field === 'emCode') {
      void removeEmInline(dto);
      return;
    }
    void removeInline(field, dto);
  };

  const handleProcedureUpdate = async (
    procedure: ProcedureDTO,
    intent: UpdateProcedureIntent,
    user: string
  ): Promise<void> => {
    if (!apiClient || !encounterId || !procedure.resourceId) return;
    const procName = procedure.procedureType ?? procedure.cptCodes?.[0]?.display ?? 'procedure';
    setConv({ kind: 'updating-procedure', user, chosenName: procName });
    try {
      const { updated, applied, skipped } = applyProcedureUpdates(
        procedure,
        intent.updates,
        procedureFieldAllowedValues
      );
      if (applied.length === 0) {
        const skippedMsg = skipped.length > 0 ? ` Unrecognized: ${skipped.join(', ')}.` : '';
        setConv({ kind: 'error', user, reply: `I couldn't apply any updates.${skippedMsg}` });
        return;
      }
      // saveChartData with resourceId set updates the existing procedure ServiceRequest.
      // Preserve cptCodes / diagnoses references (they already have resourceIds from the
      // initial save) so the update doesn't drop them.
      await saveAndMerge({ encounterId, procedures: [updated] });
      const summary = applied
        .map((a) => (a.value === undefined ? `${a.field}=(cleared)` : `${a.field}=${JSON.stringify(a.value)}`))
        .join(', ');
      const skipNote = skipped.length > 0 ? ` (skipped: ${skipped.join(', ')})` : '';
      setConv({ kind: 'updated-procedure', user, chosenName: procName, summary: summary + skipNote });
    } catch (e) {
      console.error('Update procedure failed:', e);
      setConv({ kind: 'error', user, reply: `Could not update procedure "${procName}". Please try again.` });
    }
  };

  // Confirm or dismiss a review-proposed note-field rewrite (see pendingNoteEdits).
  const applyPendingNoteEdit = async (id: number): Promise<void> => {
    const edit = pendingNoteEdits.find((e) => e.id === id);
    if (!edit) return;
    setPendingNoteEdits((prev) => prev.filter((e) => e.id !== id));
    pendingProvenanceRef.current = { reviewNote: edit.note };
    try {
      await dispatchIntent(
        { kind: 'edit-note-text', field: edit.field, newText: edit.newText } as EasyChartAgentIntent,
        `Note review: ${edit.note.slice(0, 60)}`
      );
    } catch (e) {
      console.error('Applying confirmed note edit failed:', e);
      captureException(e);
    } finally {
      pendingProvenanceRef.current = null;
    }
  };
  const dismissPendingNoteEdit = (id: number): void => {
    setPendingNoteEdits((prev) => prev.filter((e) => e.id !== id));
  };

  const handlePick = async (
    intent: AddSearchIntent,
    result: SearchResult,
    user: string,
    // When set, the saved item is registered as AI-charted (needs review) — used by the
    // no-stopping auto-chart path.
    provenance?: AiChartedMeta
  ): Promise<void> => {
    if (!apiClient || !encounterId) return;
    // Dose-safety: if the ORDERED medication strength differs from what was dictated, record it so the
    // free-text fields (which still carry the dictated dose) get flagged for review after the plan runs.
    if (
      intent.kind === 'add-medication' &&
      'strength' in intent &&
      intent.strength &&
      result.strength &&
      !strengthCompatible(intent.strength, result.strength)
    ) {
      const drug = (result.name || intent.display || '').split(/[\s(]/)[0];
      if (drug) medDoseMismatchRef.current.push({ drug, dictated: intent.strength, order: result.strength });
    }
    // A "Discuss" picker replaces the item it came from: delete the original first.
    const replaceTarget = replaceTargetRef.current;
    replaceTargetRef.current = null;
    setConv({ kind: 'saving', user, chosenName: result.name });
    try {
      if (replaceTarget) {
        await deleteChartedResource(replaceTarget.field, replaceTarget.dto);
      }
      const payload = buildIntentPayload(encounterId, intent, result);
      let newIds: string[] = [];
      if (payload) {
        newIds = await saveAndMerge(payload);
      }
      if (provenance && newIds.length > 0) {
        const stamped = withPendingProv(provenance);
        // Suspected-language guard: "suspected DVT pending imaging" charts the diagnosis (the
        // review may refine it) but must carry the caution into the hover and the amber tier.
        if (intent.kind === 'add-diagnosis' || intent.kind === 'add-condition') {
          const hay = `${intent.display} ${stamped.sourceText ?? ''}`;
          if (
            /\b(?:suspected|presumed|possible|rule[- ]?out|r\/o|pending (?:imaging|results|confirmation|studies|culture))\b/i.test(
              hay
            )
          ) {
            stamped.lowConfidence = true;
            stamped.caution = 'Dictated as suspected / pending confirmation — verify the final diagnosis.';
          }
        }
        setAiCharted((prev) => {
          const next = new Map(prev);
          for (const id of newIds) next.set(id, stamped);
          return next;
        });
      }
      setConv({ kind: 'done', user, chosenName: result.name });
    } catch (e) {
      console.error('Save failed:', e);
      setConv({ kind: 'error', user, reply: `Could not add "${result.name}". Please try again.` });
    }
  };

  const isThinking =
    conv?.kind === 'thinking' ||
    conv?.kind === 'saving' ||
    conv?.kind === 'removing' ||
    conv?.kind === 'applying-template' ||
    conv?.kind === 'updating-procedure' ||
    conv?.kind === 'editing-note-text';

  return {
    conv,
    setConv,
    pendingNoteEdits,
    applyPendingNoteEdit,
    dismissPendingNoteEdit,
    thread,
    committedConv,
    plan,
    setPlan,
    refineText,
    setRefineText,
    pickerRefineText,
    setPickerRefineText,
    examPickSelected,
    setExamPickSelected,
    isThinking,
    tokenTally,
    setTokenTally,
    reviewLoading,
    reviewError,
    reviewAnchorId,
    dispatchIntent,
    describePlanStep,
    handleSend,
    handleSkipPicker,
    handleRefinePicker,
    handleLabPick,
    handleRemovePick,
    handleApplyTemplate,
    handleProcedurePick,
    handleRosPick,
    handleExamPick,
    handleExamPickMulti,
    handleExamRemove,
    handleRosRemove,
    saveNoteField,
    handleEditNoteText,
    handleInlineRemove,
    handleProcedureUpdate,
    handlePick,
    aiDiscuss,
    runReview,
    buildChartStateSummary,
    pushUserMessage,
    pushAssistantMessage,
    recordUsage,
    lastNarrativeRef,
  };
}
