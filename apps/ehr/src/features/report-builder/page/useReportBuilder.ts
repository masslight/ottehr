import { captureException } from '@sentry/react';
import { useQueryClient } from '@tanstack/react-query';
import type { FhirResource } from 'fhir/r4b';
import { DateTime } from 'luxon';
import { enqueueSnackbar } from 'notistack';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { getApiError } from 'utils/lib/helpers/oystehrApi';
import { AdHocRow, LlmDatasetSchema } from 'utils/lib/types/adhoc/datasets/llm-schema';
import {
  AD_HOC_REPORT_DEFAULT_MODEL,
  AdHocReportModel,
  GenerateAdHocReportInput,
  GenerateAdHocReportOutput,
} from 'utils/lib/types/adhoc/generation/generate.types';
import { InferDatasetFeedback } from 'utils/lib/types/adhoc/generation/infer.types';
import { chooseFetchMode, MeasuredFetch, measuredFetch } from 'utils/lib/types/adhoc/plan/fetch-mode';
import {
  FetchPlan,
  FetchStepStats,
  isRejectedStepsError,
  planNeedsPatient,
  planUsesDateRange,
  rejectedStepsError,
} from 'utils/lib/types/adhoc/plan/fetch-plan';
import { PlanReportParams } from 'utils/lib/types/adhoc/plan/report-scope';
import { AdHocDateRangeFilter, DateRange } from 'utils/lib/types/adhoc/query/date-range';
import { ADHOC_RUNTIME_VERSION, SavedAdHocReportDefinition } from 'utils/lib/types/adhoc/saved/saved.types';
import {
  AD_HOC_REPORT_EDIT_ROLES,
  AD_HOC_REPORT_MODEL_PICKER_ROLES,
  AD_HOC_REPORT_VIEW_ROLES,
} from 'utils/lib/types/api/adhoc-report-access';
import { inferAdHocReportLayers, listAdHocReports, saveAdHocReport } from '../../../api/api';
import { useApiClients } from '../../../hooks/useAppClients';
import useEvolveUser from '../../../hooks/useEvolveUser';
import { datasetCatalog, getDataset, otherDatasetsFor } from '../datasets/registry';
import { showAdHocDebugLog } from '../debug';
import { SANDBOX_TIMEOUT_MESSAGE } from '../hooks/useSandbox';
import { toLocalYmd } from '../query/dataset-query';
import { runAdHocReportGeneration } from '../query/generation-query';
import { controlsFromInputs, DateRangeControls, inputsForPlan } from '../query/plan-inputs';
import { FetchedPlanData, fetchPlanData } from '../query/plan-query';

// How many times to transparently regenerate after a runtime error, or after the server rejected a search of
// the plan, before surfacing it to the user. 1 initial generation + up to 2 repairs.
const MAX_AUTO_RETRIES = 2;

type PreviousAttempt = NonNullable<GenerateAdHocReportInput['previousAttempt']>;

interface InferResult {
  datasetIds: string[];
  options: Record<string, boolean>;
  unavailable?: string[];
  hint?: string;
}

export interface UnavailableRequest {
  concepts: string[];
  hint?: string;
}

export interface MultiDatasetRequest {
  datasets: string[];
  hint?: string;
}

function rangeFromControls(
  filter: AdHocDateRangeFilter,
  customDate: string,
  customStartDate: string,
  customEndDate: string
): { start: string; end: string } {
  const today = DateTime.now().setZone('America/New_York').startOf('day');
  switch (filter) {
    case 'today':
      return { start: today.toISO() ?? '', end: today.endOf('day').toISO() ?? '' };
    case 'yesterday': {
      const y = today.minus({ days: 1 });
      return { start: y.toISO() ?? '', end: y.endOf('day').toISO() ?? '' };
    }
    case 'last-7-days':
      return { start: today.minus({ days: 6 }).toISO() ?? '', end: today.endOf('day').toISO() ?? '' };
    case 'last-30-days':
      return { start: today.minus({ days: 29 }).toISO() ?? '', end: today.endOf('day').toISO() ?? '' };
    case 'custom': {
      const d = DateTime.fromISO(customDate).setZone('America/New_York');
      return { start: d.startOf('day').toISO() ?? '', end: d.endOf('day').toISO() ?? '' };
    }
    case 'customRange': {
      const s = DateTime.fromISO(customStartDate).setZone('America/New_York');
      const e = DateTime.fromISO(customEndDate).setZone('America/New_York');
      return { start: s.startOf('day').toISO() ?? '', end: e.endOf('day').toISO() ?? '' };
    }
    default:
      return { start: today.toISO() ?? '', end: today.endOf('day').toISO() ?? '' };
  }
}

function schemaDateRange(range: { start: string; end: string }): LlmDatasetSchema['dateRange'] {
  const start = toLocalYmd(range.start);
  const end = toLocalYmd(range.end);

  return start && end ? { start, end } : undefined;
}

function toMultiDatasetRequest({ datasetIds, hint }: Pick<InferResult, 'datasetIds' | 'hint'>): MultiDatasetRequest {
  return { datasets: datasetIds.map((id) => getDataset(id)?.label ?? id), ...(hint ? { hint } : {}) };
}

function defaultOptionsFor(datasetId: string): Record<string, boolean> {
  const out: Record<string, boolean> = {};
  (getDataset(datasetId)?.options ?? []).forEach((opt) => {
    out[opt.id] = !!opt.default;
  });
  return out;
}

const samePlan = (a: FetchPlan | null, b: FetchPlan): boolean => !!a && JSON.stringify(a) === JSON.stringify(b);

type UseReportBuilder = {
  oystehrZambda: ReturnType<typeof useApiClients>['oystehrZambda'];
  canView: boolean;
  canCreate: boolean;
  canPickModel: boolean;
  model: AdHocReportModel;
  datasetId: string | null;
  dateRange: AdHocDateRangeFilter;
  customDate: string;
  customStartDate: string;
  customEndDate: string;
  rows: AdHocRow[] | null;
  schema: LlmDatasetSchema | null;
  datasetOptions: Record<string, boolean>;
  /** A fetch-plan report: the plan, what its last run fetched, and the run values the code gets. */
  plan: FetchPlan | null;
  resources: Record<string, FhirResource[]> | null;
  fetchStats: FetchStepStats[] | null;
  planParams: PlanReportParams | null;
  /** Whether the page asks for a date range: always before a report exists or for a dataset report; for a plan report only when the plan uses one. */
  needsDateRange: boolean;
  /** Whether the plan is about one patient ({{patientId}}). */
  needsPatient: boolean;
  /** The patient the screen that opened the builder passed (?patientId=…), if any. */
  patientFromScreen: string | undefined;
  patientIdInput: string;
  loading: boolean;
  error: string | null;
  request: string;
  generating: boolean;
  /** Layer labels being auto-loaded after the model asked for them — the shown report is incomplete meanwhile. */
  loadingLayers: string[];
  generatedCode: string | null;
  generatedTitle: string | undefined;
  generateError: string | null;
  unavailableRequest: UnavailableRequest | null;
  multiDatasetRequest: MultiDatasetRequest | null;
  renderError: string | null;
  showSchema: boolean;
  showCode: boolean;
  loadedSavedId: string | null;
  savedName: string;
  savedDescription: string;
  saveDialogOpen: boolean;
  saving: boolean;
  setDateRange: (dateRange: AdHocDateRangeFilter) => void;
  setCustomDate: (customDate: string) => void;
  setCustomStartDate: (customStartDate: string) => void;
  setCustomEndDate: (customEndDate: string) => void;
  setPatientIdInput: (patientId: string) => void;
  setRequest: (request: string) => void;
  setModel: (model: AdHocReportModel) => void;
  setShowSchema: (showSchema: boolean) => void;
  setShowCode: (showCode: boolean) => void;
  setSavedName: (savedName: string) => void;
  setSavedDescription: (savedDescription: string) => void;
  setSaveDialogOpen: (saveDialogOpen: boolean) => void;
  handleFetch: () => void;
  handleGenerate: () => void;
  handleReset: () => void;
  handleRenderError: (message: string) => void;
  handleRendered: () => void;
  handleSave: (mode: 'update' | 'new') => Promise<void>;
  openSaveDialog: () => void;
};

export function useReportBuilder(): UseReportBuilder {
  const { oystehrZambda } = useApiClients();
  const queryClient = useQueryClient();
  const [searchParams] = useSearchParams();
  const user = useEvolveUser();
  const canView = user?.hasRole(AD_HOC_REPORT_VIEW_ROLES) ?? false;
  const canCreate = user?.hasRole(AD_HOC_REPORT_EDIT_ROLES) ?? false;
  const canPickModel = user?.hasRole(AD_HOC_REPORT_MODEL_PICKER_ROLES) ?? false;

  const [datasetId, setDatasetId] = useState<string | null>(null);
  const [dateRange, setDateRange] = useState<AdHocDateRangeFilter>('last-30-days');
  const [customDate, setCustomDate] = useState<string>(DateTime.now().toFormat('yyyy-MM-dd'));
  const [customStartDate, setCustomStartDate] = useState<string>(
    DateTime.now().minus({ days: 30 }).toFormat('yyyy-MM-dd')
  );
  const [customEndDate, setCustomEndDate] = useState<string>(DateTime.now().toFormat('yyyy-MM-dd'));
  const [datasetOptions, setDatasetOptions] = useState<Record<string, boolean>>({});

  const [rows, setRows] = useState<AdHocRow[] | null>(null);
  const [schema, setSchema] = useState<LlmDatasetSchema | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // A plan report's state; `measured` is what the last run taught about its fetch (saved with the report).
  const [plan, setPlan] = useState<FetchPlan | null>(null);
  const [resources, setResources] = useState<Record<string, FhirResource[]> | null>(null);
  const [fetchStats, setFetchStats] = useState<FetchStepStats[] | null>(null);
  const [planParams, setPlanParams] = useState<PlanReportParams | null>(null);
  const [measured, setMeasured] = useState<MeasuredFetch>({});
  const [patientIdInput, setPatientIdInput] = useState('');
  const patientFromScreen = searchParams.get('patientId')?.trim() || undefined;

  const [request, setRequest] = useState('');
  const [model, setModel] = useState<AdHocReportModel>(AD_HOC_REPORT_DEFAULT_MODEL);
  const [generating, setGenerating] = useState(false);
  const [loadingLayers, setLoadingLayers] = useState<string[]>([]);
  const [generatedCode, setGeneratedCode] = useState<string | null>(null);
  const [generatedTitle, setGeneratedTitle] = useState<string | undefined>(undefined);
  const [generateError, setGenerateError] = useState<string | null>(null);
  const [unavailableRequest, setUnavailableRequest] = useState<UnavailableRequest | null>(null);
  const [multiDatasetRequest, setMultiDatasetRequest] = useState<MultiDatasetRequest | null>(null);
  const [renderError, setRenderError] = useState<string | null>(null);
  const [showSchema, setShowSchema] = useState(false);
  const [showCode, setShowCode] = useState(false);
  const activeRequestRef = useRef('');
  const autoRetryRef = useRef(0);
  const autoFixedRef = useRef(false);

  const [loadedSavedId, setLoadedSavedId] = useState<string | null>(null);
  // The definition as last saved or loaded: the timing written after a run changes only its timing fields.
  const savedDefinitionRef = useRef<SavedAdHocReportDefinition | null>(null);
  const [savedName, setSavedName] = useState<string>('');
  const [savedDescription, setSavedDescription] = useState<string>('');
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const loadAttemptedRef = useRef(false);
  const [pendingRegenerate, setPendingRegenerate] = useState<string | null>(null);

  const getDateRangeIso = useCallback(
    (filter: AdHocDateRangeFilter) => rangeFromControls(filter, customDate, customStartDate, customEndDate),
    [customDate, customStartDate, customEndDate]
  );

  const fetchWithOptions = useCallback(
    async (
      datasetId: string,
      opts: Record<string, boolean>
    ): Promise<{ rows: AdHocRow[]; schema: LlmDatasetSchema } | null> => {
      if (!oystehrZambda) return null;
      const dataset = getDataset(datasetId);
      if (!dataset) return null;
      setLoading(true);
      setError(null);
      try {
        const range = getDateRangeIso(dateRange);
        const fetched = await dataset.fetch({ oystehrZambda, queryClient, dateRange: range, options: opts });
        const builtSchema: LlmDatasetSchema = {
          ...dataset.buildSchema(fetched, opts),
          dateRange: schemaDateRange(range),
          otherDatasets: otherDatasetsFor(datasetId),
        };
        showAdHocDebugLog('fetch', `fetched ${fetched.length} rows`, {
          datasetId,
          options: opts,
          fields: builtSchema.fields.length,
        });
        setDatasetId(datasetId);
        setRows(fetched);
        setSchema(builtSchema);
        setDatasetOptions(opts);
        return { rows: fetched, schema: builtSchema };
      } catch (e) {
        showAdHocDebugLog('fetch', 'FAILED', e);
        setError(getApiError({ error: e, defaultError: 'Failed to fetch data' }));
        return null;
      } finally {
        setLoading(false);
      }
    },
    [oystehrZambda, queryClient, dateRange, getDateRangeIso]
  );

  // Runs a plan on the server (the shared runner, direct or through the background Task by the report's last
  // measured timing) and keeps what it fetched. `range` overrides the page's picker (a saved report's own range).
  const runPlan = useCallback(
    async (activePlan: FetchPlan, previous: MeasuredFetch, range?: DateRange): Promise<FetchedPlanData | null> => {
      if (!oystehrZambda) return null;
      const runRange = planUsesDateRange(activePlan) ? range ?? getDateRangeIso(dateRange) : undefined;
      const patientId = patientFromScreen ?? (patientIdInput.trim() || undefined);
      if (planNeedsPatient(activePlan) && !patientId) {
        setError('This report is about one patient. Enter a patient id to run it.');
        return null;
      }
      setLoading(true);
      setError(null);
      try {
        const mode = chooseFetchMode(previous, runRange);
        const { data, fellBack } = await fetchPlanData(
          oystehrZambda,
          { plan: activePlan, dateRange: runRange, parameters: patientId ? { patientId } : undefined },
          mode
        );
        showAdHocDebugLog('fetch', `ran the plan (${mode}) in ${data.totalMs} ms`, {
          steps: data.stats.map(({ id, count, ms, mode: stepMode, error: stepError }) => ({
            id,
            count,
            ms,
            mode: stepMode,
            error: stepError,
          })),
        });
        setPlan(activePlan);
        setResources(data.resources);
        setFetchStats(data.stats);
        setPlanParams({
          dateRange: runRange,
          timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
          patientId,
          totals: Object.fromEntries(data.stats.flatMap((s) => (s.total === undefined ? [] : [[s.id, s.total]]))),
        });
        setMeasured(measuredFetch(data.totalMs, runRange, fellBack));
        const failed = data.stats.filter((s) => s.error);
        if (failed.length) {
          setError(`Some of the report's searches failed: ${failed.map((s) => `${s.id} — ${s.error}`).join('; ')}`);
        }
        return data;
      } catch (e) {
        showAdHocDebugLog('fetch', 'plan FAILED', e);
        setError(getApiError({ error: e, defaultError: 'Failed to fetch data' }));
        return null;
      } finally {
        setLoading(false);
      }
    },
    [oystehrZambda, dateRange, getDateRangeIso, patientFromScreen, patientIdInput]
  );

  const handleFetch = useCallback((): void => {
    if (plan) void runPlan(plan, measured);
    else if (datasetId) void fetchWithOptions(datasetId, datasetOptions);
  }, [plan, runPlan, measured, fetchWithOptions, datasetId, datasetOptions]);

  const inferOptions = useCallback(
    async (message: string, feedback?: InferDatasetFeedback): Promise<InferResult> => {
      if (!oystehrZambda) throw new Error('Not connected');
      const inferred = await inferAdHocReportLayers(oystehrZambda, {
        datasets: datasetCatalog(),
        request: message,
        ...(feedback ? { feedback } : {}),
      });
      showAdHocDebugLog('infer', 'classified request', { ...inferred, feedback });
      const datasetIds = inferred.datasets.map((d) => d.id);
      if (inferred.unavailable?.length) {
        return { datasetIds, options: {}, unavailable: inferred.unavailable, hint: inferred.hint };
      }

      const options = defaultOptionsFor(datasetIds[0]);

      if (datasetIds.length > 1) return { datasetIds, options, hint: inferred.hint };

      inferred.datasets[0].layerIds.forEach((layerId) => {
        if (layerId in options) options[layerId] = true;
      });

      return { datasetIds, options };
    },
    [oystehrZambda]
  );

  const requestGenerate = useCallback(
    async (
      message: string,
      useSchema: LlmDatasetSchema,
      previousAttempt?: PreviousAttempt
    ): Promise<GenerateAdHocReportOutput> => {
      if (!oystehrZambda) throw new Error('Not connected');
      showAdHocDebugLog('generate', 'requesting report code', {
        request: message,
        repair: !!previousAttempt,
        fields: useSchema.fields.map((f) => f.name),
        rowCount: useSchema.rowCount,
      });
      const result = await runAdHocReportGeneration(oystehrZambda, {
        schema: useSchema,
        request: message,
        previousAttempt,
        ...(canPickModel ? { model } : {}),
      });
      showAdHocDebugLog('generate', 'received report code', {
        title: result.title,
        needsLayers: result.needsLayers,
        needsDataset: result.needsDataset,
        codeLength: result.code.length,
      });
      return result;
    },
    [oystehrZambda, canPickModel, model]
  );

  const commitGenerated = useCallback((message: string, result: GenerateAdHocReportOutput): void => {
    activeRequestRef.current = message;
    setGeneratedCode(result.code);
    setGeneratedTitle(result.title);
  }, []);

  const orchestrateRef = useRef<(m: string, infer: boolean, prev?: PreviousAttempt) => Promise<void>>();
  const orchestratePlanRef = useRef<(m: string, prev?: PreviousAttempt) => Promise<void>>();

  // The dataset flow: pick a dataset, fetch its rows, generate code over their schema. New reports no longer
  // come through here — reports saved on a dataset keep regenerating and running this way.
  const orchestrate = useCallback(
    async (message: string, infer: boolean, previousAttempt?: PreviousAttempt): Promise<void> => {
      if (!oystehrZambda) return;
      setGenerating(true);
      setGenerateError(null);
      setRenderError(null);
      setUnavailableRequest(null);
      setMultiDatasetRequest(null);
      try {
        let activeId = datasetId;
        let activeOpts = datasetOptions;
        let activeSchema = schema;
        if (infer) {
          const inferred = await inferOptions(message);
          if (inferred.unavailable?.length) {
            setUnavailableRequest({ concepts: inferred.unavailable, hint: inferred.hint });
            return;
          }
          if (inferred.datasetIds.length > 1) {
            setMultiDatasetRequest(toMultiDatasetRequest(inferred));
            return;
          }
          activeId = inferred.datasetIds[0];
          activeOpts = inferred.options;
          const fetched = await fetchWithOptions(activeId, activeOpts);
          if (!fetched) return;
          activeSchema = fetched.schema;
        } else if (!activeSchema && activeId) {
          const fetched = await fetchWithOptions(activeId, activeOpts);
          if (!fetched) return;
          activeSchema = fetched.schema;
        }

        if (!activeId || !activeSchema) return;

        let currentId = activeId;
        let repicked = false;
        let switched = false;

        const reject = (apply: () => void): null => {
          setGeneratedCode(null);
          setGeneratedTitle(undefined);
          apply();
          return null;
        };

        const resolveDataset = async (res: GenerateAdHocReportOutput): Promise<GenerateAdHocReportOutput | null> => {
          const needed = res.needsDataset;
          if (!infer || !needed) return res;

          if (switched) {
            return reject(() => setMultiDatasetRequest(toMultiDatasetRequest({ datasetIds: [currentId, needed.id] })));
          }

          if (repicked) return res;

          repicked = true;

          const retried = await inferOptions(message, {
            datasetId: currentId,
            concepts: needed.concepts,
            suggestedDatasetId: needed.id,
          }).catch((e) => {
            showAdHocDebugLog('infer', 're-pick failed — keeping the first report', e);
            return null;
          });

          if (!retried) return res;

          if (retried.unavailable?.length) {
            const { unavailable, hint } = retried;
            return reject(() => setUnavailableRequest({ concepts: unavailable, hint }));
          }

          if (retried.datasetIds.length > 1)
            return reject(() => setMultiDatasetRequest(toMultiDatasetRequest(retried)));

          if (retried.datasetIds[0] === currentId) return res;

          const refetched = await fetchWithOptions(retried.datasetIds[0], retried.options);

          if (!refetched) return res;

          currentId = retried.datasetIds[0];
          activeOpts = retried.options;
          switched = true;

          return resolveDataset(await requestGenerate(message, refetched.schema));
        };

        const result = await resolveDataset(await requestGenerate(message, activeSchema, previousAttempt));

        if (!result) return;

        commitGenerated(message, result);

        const wanted = (result.needsLayers ?? []).filter((id) => id in activeOpts && !activeOpts[id]);

        if (wanted.length) {
          const layerLabels = getDataset(currentId)?.options ?? [];
          setLoadingLayers(wanted.map((id) => layerLabels.find((l) => l.id === id)?.label ?? id));
          const merged = { ...activeOpts };
          wanted.forEach((id) => (merged[id] = true));
          const refetched = await fetchWithOptions(currentId, merged);

          if (refetched) {
            const rerun = await resolveDataset(await requestGenerate(message, refetched.schema, previousAttempt));
            if (rerun) commitGenerated(message, rerun);
          }
        }
      } catch (e) {
        showAdHocDebugLog('generate', 'orchestrate FAILED', e);
        setGenerateError(getApiError({ error: e, defaultError: 'Failed to generate report' }));
      } finally {
        setGenerating(false);
        setLoadingLayers([]);
      }
    },
    [oystehrZambda, datasetId, datasetOptions, schema, inferOptions, fetchWithOptions, requestGenerate, commitGenerated]
  );

  // The fetch-plan flow for new reports: the model gets the request and the data map (never any records) and
  // writes the plan and the code; the plan runs on the server; the code renders over what it fetched.
  const orchestratePlan = useCallback(
    async (message: string, previousAttempt?: PreviousAttempt): Promise<void> => {
      if (!oystehrZambda) return;
      setGenerating(true);
      setGenerateError(null);
      setRenderError(null);
      setUnavailableRequest(null);
      setMultiDatasetRequest(null);
      try {
        showAdHocDebugLog('generate', 'requesting plan and report code', {
          request: message,
          repair: !!previousAttempt,
        });
        const result = await runAdHocReportGeneration(oystehrZambda, {
          request: message,
          previousAttempt,
          ...(canPickModel ? { model } : {}),
        });
        if (!result.plan) throw new Error('The generated report has no fetch plan');
        showAdHocDebugLog('generate', 'received plan and report code', {
          title: result.title,
          steps: result.plan.steps.map((s) => `${s.id}: ${s.resourceType}`),
          codeLength: result.code.length,
        });
        // A repair that kept the plan renders on the data already fetched; a new plan has no timing yet, and a
        // plan the server rejected a search of runs again even unchanged (its data is the failed run's).
        const rejectedPlan =
          previousAttempt && isRejectedStepsError(previousAttempt.error) ? previousAttempt.plan ?? null : null;
        if (!(resources && samePlan(plan, result.plan)) || samePlan(rejectedPlan, result.plan)) {
          const fetched = await runPlan(result.plan, {});
          if (!fetched) return;
          // A search the server rejected is the plan's fault: the model gets the server's answer and fixes the
          // plan, within the same budget as a runtime repair; past it the run's error stays on screen.
          const rejection = rejectedStepsError(fetched.stats);
          if (rejection && autoRetryRef.current < MAX_AUTO_RETRIES) {
            autoRetryRef.current += 1;
            showAdHocDebugLog('autofix', `re-planning after a rejected search (attempt ${autoRetryRef.current})`, {
              rejection,
            });
            await orchestratePlanRef.current?.(message, { code: result.code, error: rejection, plan: result.plan });
            return;
          }
        }
        setDatasetId(null);
        setRows(null);
        setSchema(null);
        setDatasetOptions({});
        commitGenerated(message, result);
      } catch (e) {
        showAdHocDebugLog('generate', 'orchestratePlan FAILED', e);
        setGenerateError(getApiError({ error: e, defaultError: 'Failed to generate report' }));
      } finally {
        setGenerating(false);
      }
    },
    [oystehrZambda, canPickModel, model, resources, plan, runPlan, commitGenerated]
  );

  orchestrateRef.current = orchestrate;
  orchestratePlanRef.current = orchestratePlan;

  useEffect(() => {
    if (!pendingRegenerate || loading || generating) return;
    const request = pendingRegenerate;
    setPendingRegenerate(null);
    if (plan) void orchestratePlan(request);
    else void orchestrate(request, false);
  }, [pendingRegenerate, loading, generating, plan, orchestrate, orchestratePlan]);

  const handleGenerate = useCallback((): void => {
    if (!request.trim() || !canCreate) return;
    autoRetryRef.current = 0;
    autoFixedRef.current = false;
    setGeneratedCode(null);
    void orchestratePlan(request);
  }, [request, canCreate, orchestratePlan]);

  const handleRenderError = useCallback(
    (message: string): void => {
      if (
        message !== SANDBOX_TIMEOUT_MESSAGE &&
        canCreate &&
        autoRetryRef.current < MAX_AUTO_RETRIES &&
        !generating &&
        activeRequestRef.current
      ) {
        autoRetryRef.current += 1;
        autoFixedRef.current = true;
        showAdHocDebugLog('autofix', `regenerating after runtime error (attempt ${autoRetryRef.current})`, {
          message,
        });
        const failingCode = generatedCode;
        if (plan) {
          void orchestratePlanRef.current?.(
            activeRequestRef.current,
            failingCode ? { code: failingCode, error: message, plan } : undefined
          );
        } else {
          void orchestrateRef.current?.(
            activeRequestRef.current,
            false,
            failingCode ? { code: failingCode, error: message } : undefined
          );
        }
        return;
      }
      setRenderError(message);
    },
    [canCreate, generating, generatedCode, plan]
  );

  const handleReset = useCallback((): void => {
    setGeneratedCode(null);
    setGeneratedTitle(undefined);
    setGenerateError(null);
    setUnavailableRequest(null);
    setMultiDatasetRequest(null);
    setRenderError(null);
    setLoadedSavedId(null);
    setPlan(null);
    setResources(null);
    setFetchStats(null);
    setPlanParams(null);
    setMeasured({});
    activeRequestRef.current = '';
    autoRetryRef.current = 0;
    autoFixedRef.current = false;
  }, []);

  useEffect(() => {
    const savedId = searchParams.get('saved');

    if (!savedId || !oystehrZambda || !canView || loadAttemptedRef.current) return;

    loadAttemptedRef.current = true;

    void (async () => {
      setLoading(true);
      setError(null);
      try {
        const { reports } = await listAdHocReports(oystehrZambda);
        const saved = reports.find((r) => r.id === savedId);
        if (!saved) {
          setError('That saved report no longer exists.');
          return;
        }
        const { id: _id, updatedAt: _updatedAt, ...savedDefinition } = saved;
        savedDefinitionRef.current = savedDefinition;
        setRequest(saved.request);
        setSavedDescription(saved.description ?? '');
        setLoadedSavedId(saved.id);
        setSavedName(saved.name);
        activeRequestRef.current = saved.request;
        autoRetryRef.current = 0;

        if (saved.plan) {
          // A plan report: its own date range (the dateRange input's default) and timing, then its plan runs again.
          const controls = controlsFromInputs(saved.inputs);
          if (controls?.dateRange) setDateRange(controls.dateRange);
          if (controls?.customDate) setCustomDate(controls.customDate);
          if (controls?.customStartDate) setCustomStartDate(controls.customStartDate);
          if (controls?.customEndDate) setCustomEndDate(controls.customEndDate);
          const previous: MeasuredFetch = {
            fetchMode: saved.fetchMode,
            measuredFetchSeconds: saved.measuredFetchSeconds,
            measuredRangeDays: saved.measuredRangeDays,
          };
          setPlan(saved.plan);
          setMeasured(previous);
          const range = planUsesDateRange(saved.plan)
            ? rangeFromControls(
                controls?.dateRange ?? dateRange,
                controls?.customDate ?? customDate,
                controls?.customStartDate ?? customStartDate,
                controls?.customEndDate ?? customEndDate
              )
            : undefined;
          // A run that could not happen yet (a per-patient report opened with no patient) must not hide the
          // report: the code is still set below, and "Refresh data" renders it once the input is there.
          await runPlan(saved.plan, previous, range);
        } else {
          const filter = saved.criteria?.dateRange as AdHocDateRangeFilter;
          const savedDatasetId = saved.datasetId ?? '';
          setDatasetId(savedDatasetId);
          setDateRange(filter);
          if (saved.criteria?.customDate) setCustomDate(saved.criteria.customDate);
          if (saved.criteria?.customStartDate) setCustomStartDate(saved.criteria.customStartDate);
          if (saved.criteria?.customEndDate) setCustomEndDate(saved.criteria.customEndDate);
          const savedOptions = saved.criteria?.options ?? defaultOptionsFor(savedDatasetId);
          setDatasetOptions(savedOptions);

          const dataset = getDataset(savedDatasetId);
          if (!dataset) {
            setError(`Unknown dataset "${savedDatasetId}".`);
            return;
          }
          const range = rangeFromControls(
            filter,
            saved.criteria?.customDate ?? customDate,
            saved.criteria?.customStartDate ?? customStartDate,
            saved.criteria?.customEndDate ?? customEndDate
          );
          const fetched = await dataset.fetch({ oystehrZambda, dateRange: range, options: savedOptions, queryClient });
          const builtSchema: LlmDatasetSchema = {
            ...dataset.buildSchema(fetched, savedOptions),
            dateRange: schemaDateRange(range),
            otherDatasets: otherDatasetsFor(savedDatasetId),
          };
          setRows(fetched);
          setSchema(builtSchema);
        }

        if ((saved.runtimeVersion ?? 0) !== ADHOC_RUNTIME_VERSION) {
          showAdHocDebugLog('saved', 'runtime version mismatch', {
            saved: saved.runtimeVersion,
            current: ADHOC_RUNTIME_VERSION,
          });

          if (!canCreate) {
            setError('This report was built for an older report engine and needs an administrator to rebuild it.');
          } else {
            enqueueSnackbar('This report was rebuilt for an updated report engine.', {
              variant: 'info',
            });
            autoFixedRef.current = true;
            setPendingRegenerate(saved.request);
          }
        } else {
          setGeneratedCode(saved.code);
          setGeneratedTitle(saved.title);
        }
      } catch (e) {
        setError(getApiError({ error: e, defaultError: 'Failed to load saved report' }));
      } finally {
        setLoading(false);
      }
    })();
    // Must run only when the client becomes available. Re-running on searchParams changes
    // would re-load the saved report from scratch (refetch data, rebuild schema, re-set the code →
    // the frame remounts), discarding the report currently on screen. So oystehrZambda is the sole dep.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [oystehrZambda]);

  const buildDefinition = useCallback(
    (name: string, code: string): SavedAdHocReportDefinition => {
      const controls: DateRangeControls = { dateRange, customDate, customStartDate, customEndDate };
      const base = {
        name: name.trim(),
        description: savedDescription.trim() || undefined,
        request: activeRequestRef.current || request,
        code,
        title: generatedTitle,
        runtimeVersion: ADHOC_RUNTIME_VERSION,
      };
      // A plan report keeps its plan, the values it takes from the screen and what its runs measured.
      if (plan) return { ...base, plan, inputs: inputsForPlan(plan, controls), ...measured };
      return { ...base, datasetId: datasetId ?? undefined, criteria: { ...controls, options: datasetOptions } };
    },
    [
      savedDescription,
      dateRange,
      customDate,
      customStartDate,
      customEndDate,
      datasetOptions,
      request,
      generatedTitle,
      plan,
      measured,
      datasetId,
    ]
  );

  const canSave = !!generatedCode && (!!plan || !!datasetId);

  const handleRendered = useCallback((): void => {
    setRenderError(null);

    if (!autoFixedRef.current) return;

    autoFixedRef.current = false;

    if (!canCreate || !oystehrZambda || !loadedSavedId || !generatedCode || !canSave) return;

    const definition = buildDefinition(savedName || generatedTitle || 'Report', generatedCode);
    void saveAdHocReport(oystehrZambda, { reportId: loadedSavedId, definition })
      .then(() => {
        savedDefinitionRef.current = definition;
      })
      .catch((e) => console.warn('Could not persist auto-fixed report', e));
  }, [canCreate, oystehrZambda, loadedSavedId, generatedCode, canSave, buildDefinition, savedName, generatedTitle]);

  // What a run measured is written to the saved report after each run (by someone allowed to save), so the next
  // run can choose the direct call or the background Task from it. Only the timing fields change — the plan and
  // code stay as saved, so a regeneration the user has not saved is never written by this.
  useEffect(() => {
    const saved = savedDefinitionRef.current;
    if (!plan || !loadedSavedId || !canCreate || !oystehrZambda || !saved?.plan || !samePlan(saved.plan, plan)) return;
    if (measured.fetchMode === undefined || saved.measuredFetchSeconds === measured.measuredFetchSeconds) return;
    const definition = { ...saved, ...measured };
    savedDefinitionRef.current = definition;
    void saveAdHocReport(oystehrZambda, { reportId: loadedSavedId, definition }).catch((e) => {
      console.warn('Could not persist the report timing', e);
      captureException(e);
    });
    // Runs on a new measurement only; the rest is read at that moment.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [measured]);

  const handleSave = useCallback(
    async (mode: 'update' | 'new'): Promise<void> => {
      if (!oystehrZambda || !generatedCode || !canSave || !savedName.trim()) return;
      setSaving(true);
      try {
        const definition = buildDefinition(savedName, generatedCode);
        const { report: saved } = await saveAdHocReport(oystehrZambda, {
          reportId: mode === 'update' ? loadedSavedId ?? undefined : undefined,
          definition,
        });
        savedDefinitionRef.current = definition;
        setLoadedSavedId(saved.id);
        setSavedName(saved.name);
        setSaveDialogOpen(false);
        enqueueSnackbar(`Saved report “${saved.name}”.`, { variant: 'success' });
      } catch (e) {
        enqueueSnackbar(e instanceof Error ? e.message : 'Could not save the report.', { variant: 'error' });
      } finally {
        setSaving(false);
      }
    },
    [oystehrZambda, generatedCode, canSave, savedName, loadedSavedId, buildDefinition]
  );

  const openSaveDialog = useCallback((): void => {
    setSavedName((n) => n || generatedTitle || '');
    setSaveDialogOpen(true);
  }, [generatedTitle]);

  return {
    oystehrZambda,
    canView,
    canCreate,
    canPickModel,
    model,
    datasetId,
    dateRange,
    customDate,
    customStartDate,
    customEndDate,
    rows,
    schema,
    datasetOptions,
    plan,
    resources,
    fetchStats,
    planParams,
    needsDateRange: !plan || planUsesDateRange(plan),
    needsPatient: !!plan && planNeedsPatient(plan),
    patientFromScreen,
    patientIdInput,
    loading,
    error,
    request,
    generating,
    loadingLayers,
    generatedCode,
    generatedTitle,
    generateError,
    unavailableRequest,
    multiDatasetRequest,
    renderError,
    showSchema,
    showCode,
    loadedSavedId,
    savedName,
    savedDescription,
    saveDialogOpen,
    saving,
    setDateRange,
    setCustomDate,
    setCustomStartDate,
    setCustomEndDate,
    setPatientIdInput,
    setRequest,
    setModel,
    setShowSchema,
    setShowCode,
    setSavedName,
    setSavedDescription,
    setSaveDialogOpen,
    handleFetch,
    handleGenerate,
    handleReset,
    handleRenderError,
    handleRendered,
    handleSave,
    openSaveDialog,
  };
}
