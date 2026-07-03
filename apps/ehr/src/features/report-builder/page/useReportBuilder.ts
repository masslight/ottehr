import { useQueryClient } from '@tanstack/react-query';
import { DateTime } from 'luxon';
import { useSnackbar } from 'notistack';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  ADHOC_RUNTIME_VERSION,
  AdHocDateRangeFilter,
  AdHocRow,
  GenerateAdHocReportInput,
  LlmDatasetSchema,
  SavedAdHocReportDefinition,
} from 'utils';
import { generateAdHocReport, inferAdHocReportLayers, listAdHocReports, saveAdHocReport } from '../../../api/api';
import { useApiClients } from '../../../hooks/useAppClients';
import { AdHocCriteria, clearAdHocCriteria, peekAdHocCriteria } from '../customize/seed';
import { AD_HOC_DATASETS, getDataset, otherDatasetsFor } from '../datasets/registry';
import { showAdHocDebugLog } from '../debug';
import { SANDBOX_TIMEOUT_MESSAGE } from '../hooks/useSandbox';
import { getBatchWindowFailures } from '../query/batching';

// How many times to transparently regenerate after a runtime error before surfacing it to the user.
// The iframe run over the real rows IS the validation pass (the zambda never executes code), so
// this client loop is the design's "validate and regenerate on failure, bounded (~2-3 tries)":
// 1 initial generation + up to 2 repairs.
const MAX_AUTO_RETRIES = 2;

type PreviousAttempt = NonNullable<GenerateAdHocReportInput['previousAttempt']>;

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

function defaultOptionsFor(datasetId: string): Record<string, boolean> {
  const out: Record<string, boolean> = {};
  (getDataset(datasetId)?.options ?? []).forEach((opt) => {
    out[opt.id] = !!opt.default;
  });
  return out;
}

// Some (not all) batched date windows failed — data is usable but incomplete. Null when all loaded.
function partialWarningFor(rows: AdHocRow[]): string | null {
  const f = getBatchWindowFailures(rows);
  return f && f.failedWindows > 0
    ? `${f.failedWindows} of ${f.totalWindows} date windows failed to load — results are partial.`
    : null;
}

type UseReportBuilder = {
  oystehrZambda: ReturnType<typeof useApiClients>['oystehrZambda'];
  criteria: AdHocCriteria | null;
  datasetId: string;
  dateRange: AdHocDateRangeFilter;
  customDate: string;
  customStartDate: string;
  customEndDate: string;
  rows: AdHocRow[] | null;
  schema: LlmDatasetSchema | null;
  loading: boolean;
  error: string | null;
  partialWarning: string | null;
  request: string;
  generating: boolean;
  generatedCode: string | null;
  generatedTitle: string | undefined;
  generateError: string | null;
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
  setRequest: (request: string) => void;
  setShowSchema: (showSchema: boolean) => void;
  setShowCode: (showCode: boolean) => void;
  setSavedName: (savedName: string) => void;
  setSavedDescription: (savedDescription: string) => void;
  setSaveDialogOpen: (saveDialogOpen: boolean) => void;
  onDatasetChange: (datasetId: string) => void;
  handleFetch: () => void;
  handleGenerate: () => void;
  handleReset: () => void;
  handleRenderError: (message: string) => void;
  handleRendered: () => void;
  handleSave: (mode: 'update' | 'new') => Promise<void>;
  openSaveDialog: () => void;
};

// Coordinates the client-side pipeline (infer layers → fetch rows → generate code → needsLayers
// backfill) plus save/load. Fetch stays client-side by necessity: the rows must reach the sandboxed
// iframe in the browser and never the LLM (which only ever sees the Zod-derived column schema).
//
// There is NO refinement: the user edits the original request and regenerates. The only multi-turn
// mechanism is the technical auto-repair — when the code crashes at runtime the previous code +
// error go back to the generator once (previousAttempt), invisibly to the user.
export function useReportBuilder(): UseReportBuilder {
  const { oystehrZambda } = useApiClients();
  const queryClient = useQueryClient();
  const [searchParams] = useSearchParams();
  const { enqueueSnackbar } = useSnackbar();

  // "Customize" hand-off: capture stashed criteria once (peek is StrictMode-safe), then clear it.
  const [criteria] = useState(() => peekAdHocCriteria());
  useEffect(() => {
    clearAdHocCriteria();
  }, []);

  const initialDatasetId = criteria?.datasetId ?? AD_HOC_DATASETS[0]?.id ?? 'encounters-comprehensive';
  const [datasetId, setDatasetId] = useState<string>(initialDatasetId);
  const [dateRange, setDateRange] = useState<AdHocDateRangeFilter>(
    (criteria?.dateRange as AdHocDateRangeFilter) ?? 'last-30-days'
  );
  const [customDate, setCustomDate] = useState<string>(criteria?.customDate ?? DateTime.now().toFormat('yyyy-MM-dd'));
  const [customStartDate, setCustomStartDate] = useState<string>(
    criteria?.customStartDate ?? DateTime.now().minus({ days: 30 }).toFormat('yyyy-MM-dd')
  );
  const [customEndDate, setCustomEndDate] = useState<string>(
    criteria?.customEndDate ?? DateTime.now().toFormat('yyyy-MM-dd')
  );
  const [datasetOptions, setDatasetOptions] = useState<Record<string, boolean>>(
    () => criteria?.options ?? defaultOptionsFor(initialDatasetId)
  );

  const [rows, setRows] = useState<AdHocRow[] | null>(null);
  const [schema, setSchema] = useState<LlmDatasetSchema | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Soft warning: some batched date windows failed but the rest loaded. Kept separate from `error`.
  const [partialWarning, setPartialWarning] = useState<string | null>(null);

  const [request, setRequest] = useState('');
  const [generating, setGenerating] = useState(false);
  const [generatedCode, setGeneratedCode] = useState<string | null>(null);
  const [generatedTitle, setGeneratedTitle] = useState<string | undefined>(undefined);
  const [generateError, setGenerateError] = useState<string | null>(null);
  const [renderError, setRenderError] = useState<string | null>(null);
  const [showSchema, setShowSchema] = useState(false);
  const [showCode, setShowCode] = useState(false);
  // The request the current code was generated from — the auto-repair regenerates THIS, not
  // whatever is currently typed in the box.
  const activeRequestRef = useRef('');
  // Bounds transparent regenerations after a runtime crash, so broken code can't loop forever.
  const autoRetryRef = useRef(0);
  // True once the current code is an auto-repair (or version regeneration) — a clean render then
  // persists the fixed code back to the saved report so it doesn't repair itself on every open.
  const autoFixedRef = useRef(false);

  const [loadedSavedId, setLoadedSavedId] = useState<string | null>(null);
  const [savedName, setSavedName] = useState<string>('');
  const [savedDescription, setSavedDescription] = useState<string>('');
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const loadAttemptedRef = useRef(false);
  // A regeneration requested by the saved-report loader. It must NOT call orchestrate directly:
  // right after the loader's setState calls, orchestrate (and fetchWithOptions inside it) still
  // close over the PREVIOUS render's datasetId/dateRange/options/schema — it would fetch the wrong
  // dataset. Deferring through state runs it on the next render, over the committed values.
  const [pendingRegenerate, setPendingRegenerate] = useState<string | null>(null);

  const getDateRangeIso = useCallback(
    (filter: AdHocDateRangeFilter) => rangeFromControls(filter, customDate, customStartDate, customEndDate),
    [customDate, customStartDate, customEndDate]
  );

  // Fetch the dataset for `opts`, build the LLM schema (static Zod metadata only — no values leave
  // the client), return both so a caller can use them without waiting for setState.
  const fetchWithOptions = useCallback(
    async (opts: Record<string, boolean>): Promise<{ rows: AdHocRow[]; schema: LlmDatasetSchema } | null> => {
      if (!oystehrZambda) return null;
      const dataset = getDataset(datasetId);
      if (!dataset) return null;
      setLoading(true);
      setError(null);
      setPartialWarning(null);
      try {
        const range = getDateRangeIso(dateRange);
        const fetched = await dataset.fetch({ oystehrZambda, queryClient, dateRange: range, options: opts });
        const builtSchema: LlmDatasetSchema = {
          ...dataset.buildSchema(fetched, opts),
          otherDatasets: otherDatasetsFor(datasetId),
        };
        showAdHocDebugLog('fetch', `fetched ${fetched.length} rows`, {
          datasetId,
          options: opts,
          fields: builtSchema.fields.length,
        });
        setPartialWarning(partialWarningFor(fetched));
        setRows(fetched);
        setSchema(builtSchema);
        setDatasetOptions(opts);
        return { rows: fetched, schema: builtSchema };
      } catch (e) {
        showAdHocDebugLog('fetch', 'FAILED', e);
        setError(e instanceof Error ? e.message : 'Failed to fetch data');
        return null;
      } finally {
        setLoading(false);
      }
    },
    [oystehrZambda, queryClient, datasetId, dateRange, getDateRangeIso]
  );

  const handleFetch = useCallback((): void => {
    void fetchWithOptions(datasetOptions);
  }, [fetchWithOptions, datasetOptions]);

  const onDatasetChange = useCallback((id: string): void => {
    setDatasetId(id);
    setDatasetOptions(defaultOptionsFor(id));
  }, []);

  // Customize hand-off: dataset + range are pre-set, so fetch immediately. Skipped for ?saved=.
  const criteriaFetchedRef = useRef(false);
  useEffect(() => {
    if (!criteria || criteriaFetchedRef.current || !oystehrZambda || searchParams.get('saved')) return;
    criteriaFetchedRef.current = true;
    void fetchWithOptions(criteria?.options ?? defaultOptionsFor(datasetId));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [oystehrZambda]);

  // Which opt-in layers this request needs. Falls back to defaults; generate's needsLayers backfills misses.
  const inferOptions = useCallback(
    async (message: string): Promise<Record<string, boolean>> => {
      const dataset = getDataset(datasetId);
      const layers = dataset?.options ?? [];
      const base = defaultOptionsFor(datasetId);
      if (!oystehrZambda || layers.length === 0) return base;
      try {
        const { layerIds } = await inferAdHocReportLayers(oystehrZambda, {
          datasetId,
          layers: layers.map((l) => ({ id: l.id, label: l.label, description: l.description })),
          request: message,
        });
        const out = { ...base };
        layerIds.forEach((id) => {
          if (id in out) out[id] = true;
        });
        return out;
      } catch (e) {
        showAdHocDebugLog('infer', 'layer inference failed — using defaults', e);
        return base;
      }
    },
    [oystehrZambda, datasetId]
  );

  // Send schema + request (never rows) to generate. Returns the result for the needsLayers backfill.
  const callGenerate = useCallback(
    async (
      message: string,
      useSchema: LlmDatasetSchema,
      previousAttempt?: PreviousAttempt
    ): Promise<{ code: string; needsLayers?: string[] } | null> => {
      if (!oystehrZambda) return null;
      showAdHocDebugLog('generate', 'requesting report code', {
        request: message,
        repair: !!previousAttempt,
        fields: useSchema.fields.map((f) => f.name),
        rowCount: useSchema.rowCount,
      });
      const result = await generateAdHocReport(oystehrZambda, {
        schema: useSchema,
        request: message,
        previousAttempt,
      });
      showAdHocDebugLog('generate', 'received report code', {
        title: result.title,
        needsLayers: result.needsLayers,
        codeLength: result.code.length,
      });
      activeRequestRef.current = message;
      setGeneratedCode(result.code);
      setGeneratedTitle(result.title);
      return result;
    },
    [oystehrZambda]
  );

  // Lets the saved-report loader and the render-error repair re-invoke the pipeline via a ref.
  const orchestrateRef = useRef<(m: string, infer: boolean, prev?: PreviousAttempt) => Promise<void>>();

  // infer → fetch → generate → (needsLayers) refetch + regenerate once. `infer` is false when the
  // loaded data can be reused (auto-repair, saved-report regeneration).
  const orchestrate = useCallback(
    async (message: string, infer: boolean, previousAttempt?: PreviousAttempt): Promise<void> => {
      if (!oystehrZambda) return;
      setGenerating(true);
      setGenerateError(null);
      setRenderError(null);
      try {
        let activeOpts = datasetOptions;
        let activeSchema = schema;
        if (infer) {
          activeOpts = await inferOptions(message);
          const fetched = await fetchWithOptions(activeOpts);
          if (!fetched) return;
          activeSchema = fetched.schema;
        } else if (!activeSchema) {
          const fetched = await fetchWithOptions(activeOpts);
          if (!fetched) return;
          activeSchema = fetched.schema;
        }

        const result = await callGenerate(message, activeSchema, previousAttempt);

        // Safety net: the code named layers it needs that weren't loaded — fetch them and regenerate.
        const wanted = (result?.needsLayers ?? []).filter((id) => id in activeOpts && !activeOpts[id]);
        if (wanted.length) {
          const merged = { ...activeOpts };
          wanted.forEach((id) => (merged[id] = true));
          const refetched = await fetchWithOptions(merged);
          if (refetched) await callGenerate(message, refetched.schema, previousAttempt);
        }
      } catch (e) {
        showAdHocDebugLog('generate', 'orchestrate FAILED', e);
        setGenerateError(e instanceof Error ? e.message : 'Failed to generate report');
      } finally {
        setGenerating(false);
      }
    },
    [oystehrZambda, datasetOptions, schema, inferOptions, fetchWithOptions, callGenerate]
  );
  orchestrateRef.current = orchestrate;

  // Consume a deferred regeneration on the render AFTER the saved-report loader committed the saved
  // dataset/range/options/schema — orchestrate now closes over the right values. infer=false: the
  // loader already fetched the rows + schema for the saved criteria.
  useEffect(() => {
    if (!pendingRegenerate || loading || generating) return;
    const request = pendingRegenerate;
    setPendingRegenerate(null);
    void orchestrate(request, false);
  }, [pendingRegenerate, loading, generating, orchestrate]);

  // Editing the request and generating again IS the refinement flow — there is no separate one.
  const handleGenerate = useCallback((): void => {
    if (!request.trim()) return;
    autoRetryRef.current = 0;
    autoFixedRef.current = false;
    setGeneratedCode(null);
    void orchestrate(request, true);
  }, [request, orchestrate]);

  // When the generated code throws at runtime in the iframe, transparently regenerate once with the
  // failing code + error attached. After the budget is spent, surface the error. A watchdog
  // TIMEOUT is not a code failure (the code may be fine and merely slow here) — show it, never
  // regenerate over it.
  const handleRenderError = useCallback(
    (message: string): void => {
      if (
        message !== SANDBOX_TIMEOUT_MESSAGE &&
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
        void orchestrateRef.current?.(
          activeRequestRef.current,
          false,
          failingCode ? { code: failingCode, error: message } : undefined
        );
        return;
      }
      setRenderError(message);
    },
    [generating, generatedCode]
  );

  // Clear the generated report to start fresh. Keeps the fetched rows/schema and request text, so
  // the user can tweak the request and regenerate without re-fetching.
  const handleReset = useCallback((): void => {
    setGeneratedCode(null);
    setGeneratedTitle(undefined);
    setGenerateError(null);
    setRenderError(null);
    setLoadedSavedId(null);
    activeRequestRef.current = '';
    autoRetryRef.current = 0;
    autoFixedRef.current = false;
  }, []);

  // Open from a saved tile (?saved=): load definition, set controls, re-fetch live data, re-run the
  // saved code in the iframe. On a runtime-version mismatch the saved code was generated against an
  // older execution contract — regenerate it from the saved prompt instead of running it.
  useEffect(() => {
    const savedId = searchParams.get('saved');

    if (!savedId || !oystehrZambda || criteria || loadAttemptedRef.current) return;

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
        const filter = saved.criteria.dateRange as AdHocDateRangeFilter;
        setDatasetId(saved.datasetId);
        setDateRange(filter);
        if (saved.criteria.customDate) setCustomDate(saved.criteria.customDate);
        if (saved.criteria.customStartDate) setCustomStartDate(saved.criteria.customStartDate);
        if (saved.criteria.customEndDate) setCustomEndDate(saved.criteria.customEndDate);
        setRequest(saved.request);
        setSavedDescription(saved.description ?? '');
        setLoadedSavedId(saved.id);
        setSavedName(saved.name);
        const savedOptions = saved.criteria.options ?? defaultOptionsFor(saved.datasetId);
        setDatasetOptions(savedOptions);

        const dataset = getDataset(saved.datasetId);
        if (!dataset) {
          setError(`Unknown dataset "${saved.datasetId}".`);
          return;
        }
        const range = rangeFromControls(
          filter,
          saved.criteria.customDate ?? customDate,
          saved.criteria.customStartDate ?? customStartDate,
          saved.criteria.customEndDate ?? customEndDate
        );
        const fetched = await dataset.fetch({ oystehrZambda, dateRange: range, options: savedOptions, queryClient });
        const builtSchema: LlmDatasetSchema = {
          ...dataset.buildSchema(fetched, savedOptions),
          otherDatasets: otherDatasetsFor(saved.datasetId),
        };
        setRows(fetched);
        setSchema(builtSchema);
        activeRequestRef.current = saved.request;
        autoRetryRef.current = 0;

        if ((saved.runtimeVersion ?? 0) !== ADHOC_RUNTIME_VERSION) {
          // The stored code targets an older runtime — regenerate from the original prompt. The
          // successful render then persists the regenerated code back (handleRendered). Deferred
          // through state so the regeneration runs over the saved dataset/range just committed
          // above, not this render's stale closures.
          showAdHocDebugLog('saved', 'runtime version mismatch — regenerating from prompt', {
            saved: saved.runtimeVersion,
            current: ADHOC_RUNTIME_VERSION,
          });
          autoFixedRef.current = true;
          setPendingRegenerate(saved.request);
        } else {
          setGeneratedCode(saved.code);
          setGeneratedTitle(saved.title);
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to load saved report');
      } finally {
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [oystehrZambda]);

  const buildDefinition = useCallback(
    (name: string, code: string): SavedAdHocReportDefinition => ({
      name: name.trim(),
      description: savedDescription.trim() || undefined,
      datasetId,
      criteria: { dateRange, customDate, customStartDate, customEndDate, options: datasetOptions },
      request: activeRequestRef.current || request,
      code,
      title: generatedTitle,
      runtimeVersion: ADHOC_RUNTIME_VERSION,
    }),
    [
      savedDescription,
      datasetId,
      dateRange,
      customDate,
      customStartDate,
      customEndDate,
      datasetOptions,
      request,
      generatedTitle,
    ]
  );

  // When an auto-repaired (or version-regenerated) report renders cleanly, persist the fixed code
  // back to the saved report so it doesn't repair itself again on every open.
  const handleRendered = useCallback((): void => {
    if (!autoFixedRef.current) return;
    autoFixedRef.current = false;
    if (!oystehrZambda || !loadedSavedId || !generatedCode) return;
    void saveAdHocReport(oystehrZambda, {
      reportId: loadedSavedId,
      definition: buildDefinition(savedName || generatedTitle || 'Report', generatedCode),
    }).catch((e) => console.warn('Could not persist auto-fixed report', e));
  }, [oystehrZambda, loadedSavedId, generatedCode, buildDefinition, savedName, generatedTitle]);

  const handleSave = useCallback(
    async (mode: 'update' | 'new'): Promise<void> => {
      if (!oystehrZambda || !generatedCode || !savedName.trim()) return;
      setSaving(true);
      try {
        const { report: saved } = await saveAdHocReport(oystehrZambda, {
          reportId: mode === 'update' ? loadedSavedId ?? undefined : undefined,
          definition: buildDefinition(savedName, generatedCode),
        });
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
    [oystehrZambda, generatedCode, savedName, loadedSavedId, buildDefinition, enqueueSnackbar]
  );

  const openSaveDialog = useCallback((): void => {
    setSavedName((n) => n || generatedTitle || '');
    setSaveDialogOpen(true);
  }, [generatedTitle]);

  return {
    oystehrZambda,
    criteria,
    datasetId,
    dateRange,
    customDate,
    customStartDate,
    customEndDate,
    rows,
    schema,
    loading,
    error,
    partialWarning,
    request,
    generating,
    generatedCode,
    generatedTitle,
    generateError,
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
    setRequest,
    setShowSchema,
    setShowCode,
    setSavedName,
    setSavedDescription,
    setSaveDialogOpen,
    onDatasetChange,
    handleFetch,
    handleGenerate,
    handleReset,
    handleRenderError,
    handleRendered,
    handleSave,
    openSaveDialog,
  };
}
