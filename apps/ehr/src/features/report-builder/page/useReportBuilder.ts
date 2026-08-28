import { useQueryClient } from '@tanstack/react-query';
import { DateTime } from 'luxon';
import { enqueueSnackbar } from 'notistack';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { getApiError } from 'utils/lib/helpers/oystehrApi';
import { AdHocRow, LlmDatasetSchema } from 'utils/lib/types/adhoc/datasets/llm-schema';
import { GenerateAdHocReportInput } from 'utils/lib/types/adhoc/generation/generate.types';
import { AdHocDateRangeFilter } from 'utils/lib/types/adhoc/query/date-range';
import { ADHOC_RUNTIME_VERSION, SavedAdHocReportDefinition } from 'utils/lib/types/adhoc/saved/saved.types';
import { AD_HOC_REPORT_EDIT_ROLES, AD_HOC_REPORT_VIEW_ROLES } from 'utils/lib/types/api/adhoc-report-access';
import { generateAdHocReport, inferAdHocReportLayers, listAdHocReports, saveAdHocReport } from '../../../api/api';
import { useApiClients } from '../../../hooks/useAppClients';
import useEvolveUser from '../../../hooks/useEvolveUser';
import { AD_HOC_DATASETS, datasetCatalog, getDataset, otherDatasetsFor } from '../datasets/registry';
import { showAdHocDebugLog } from '../debug';
import { SANDBOX_TIMEOUT_MESSAGE } from '../hooks/useSandbox';

// How many times to transparently regenerate after a runtime error before surfacing it to the user.
// 1 initial generation + up to 2 repairs.
const MAX_AUTO_RETRIES = 2;

type PreviousAttempt = NonNullable<GenerateAdHocReportInput['previousAttempt']>;

interface InferResult {
  options: Record<string, boolean>;
  unavailable?: string[];
  hint?: string;
}

export interface UnavailableRequest {
  concepts: string[];
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

function defaultOptionsFor(datasetId: string): Record<string, boolean> {
  const out: Record<string, boolean> = {};
  (getDataset(datasetId)?.options ?? []).forEach((opt) => {
    out[opt.id] = !!opt.default;
  });
  return out;
}

type UseReportBuilder = {
  oystehrZambda: ReturnType<typeof useApiClients>['oystehrZambda'];
  canView: boolean;
  canCreate: boolean;
  datasetId: string;
  dateRange: AdHocDateRangeFilter;
  customDate: string;
  customStartDate: string;
  customEndDate: string;
  rows: AdHocRow[] | null;
  schema: LlmDatasetSchema | null;
  datasetOptions: Record<string, boolean>;
  loading: boolean;
  error: string | null;
  request: string;
  generating: boolean;
  generatedCode: string | null;
  generatedTitle: string | undefined;
  generateError: string | null;
  unavailableRequest: UnavailableRequest | null;
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

export function useReportBuilder(): UseReportBuilder {
  const { oystehrZambda } = useApiClients();
  const queryClient = useQueryClient();
  const [searchParams] = useSearchParams();
  const user = useEvolveUser();
  const canView = user?.hasRole(AD_HOC_REPORT_VIEW_ROLES) ?? false;
  const canCreate = user?.hasRole(AD_HOC_REPORT_EDIT_ROLES) ?? false;

  const initialDatasetId = AD_HOC_DATASETS[0]?.id ?? 'encounters-comprehensive';
  const [datasetId, setDatasetId] = useState<string>(initialDatasetId);
  const [dateRange, setDateRange] = useState<AdHocDateRangeFilter>('last-30-days');
  const [customDate, setCustomDate] = useState<string>(DateTime.now().toFormat('yyyy-MM-dd'));
  const [customStartDate, setCustomStartDate] = useState<string>(
    DateTime.now().minus({ days: 30 }).toFormat('yyyy-MM-dd')
  );
  const [customEndDate, setCustomEndDate] = useState<string>(DateTime.now().toFormat('yyyy-MM-dd'));
  const [datasetOptions, setDatasetOptions] = useState<Record<string, boolean>>(() =>
    defaultOptionsFor(initialDatasetId)
  );

  const [rows, setRows] = useState<AdHocRow[] | null>(null);
  const [schema, setSchema] = useState<LlmDatasetSchema | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [request, setRequest] = useState('');
  const [generating, setGenerating] = useState(false);
  const [generatedCode, setGeneratedCode] = useState<string | null>(null);
  const [generatedTitle, setGeneratedTitle] = useState<string | undefined>(undefined);
  const [generateError, setGenerateError] = useState<string | null>(null);
  const [unavailableRequest, setUnavailableRequest] = useState<UnavailableRequest | null>(null);
  const [renderError, setRenderError] = useState<string | null>(null);
  const [showSchema, setShowSchema] = useState(false);
  const [showCode, setShowCode] = useState(false);
  const activeRequestRef = useRef('');
  const autoRetryRef = useRef(0);
  const autoFixedRef = useRef(false);

  const [loadedSavedId, setLoadedSavedId] = useState<string | null>(null);
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
    async (opts: Record<string, boolean>): Promise<{ rows: AdHocRow[]; schema: LlmDatasetSchema } | null> => {
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
          otherDatasets: otherDatasetsFor(datasetId),
        };
        showAdHocDebugLog('fetch', `fetched ${fetched.length} rows`, {
          datasetId,
          options: opts,
          fields: builtSchema.fields.length,
        });
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
    [oystehrZambda, queryClient, datasetId, dateRange, getDateRangeIso]
  );

  const handleFetch = useCallback((): void => {
    void fetchWithOptions(datasetOptions);
  }, [fetchWithOptions, datasetOptions]);

  const onDatasetChange = useCallback((id: string): void => {
    setDatasetId(id);
    setDatasetOptions(defaultOptionsFor(id));
  }, []);

  const inferOptions = useCallback(
    async (message: string): Promise<InferResult> => {
      const dataset = getDataset(datasetId);
      const layers = dataset?.options ?? [];
      const base = defaultOptionsFor(datasetId);
      if (!oystehrZambda || layers.length === 0) return { options: base };
      try {
        const { layerIds, unavailable, hint } = await inferAdHocReportLayers(oystehrZambda, {
          datasetId,
          datasets: datasetCatalog(),
          request: message,
        });
        if (unavailable?.length) return { options: base, unavailable, hint };
        const out = { ...base };
        layerIds.forEach((id) => {
          if (id in out) out[id] = true;
        });
        return { options: out };
      } catch (e) {
        showAdHocDebugLog('infer', 'layer inference failed — using defaults', e);
        return { options: base };
      }
    },
    [oystehrZambda, datasetId]
  );

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

  const orchestrateRef = useRef<(m: string, infer: boolean, prev?: PreviousAttempt) => Promise<void>>();

  const orchestrate = useCallback(
    async (message: string, infer: boolean, previousAttempt?: PreviousAttempt): Promise<void> => {
      if (!oystehrZambda) return;
      setGenerating(true);
      setGenerateError(null);
      setRenderError(null);
      setUnavailableRequest(null);
      try {
        let activeOpts = datasetOptions;
        let activeSchema = schema;
        if (infer) {
          const inferred = await inferOptions(message);
          if (inferred.unavailable?.length) {
            setUnavailableRequest({ concepts: inferred.unavailable, hint: inferred.hint });
            return;
          }
          activeOpts = inferred.options;
          const fetched = await fetchWithOptions(activeOpts);
          if (!fetched) return;
          activeSchema = fetched.schema;
        } else if (!activeSchema) {
          const fetched = await fetchWithOptions(activeOpts);
          if (!fetched) return;
          activeSchema = fetched.schema;
        }

        const result = await callGenerate(message, activeSchema, previousAttempt);

        const wanted = (result?.needsLayers ?? []).filter((id) => id in activeOpts && !activeOpts[id]);
        if (wanted.length) {
          const merged = { ...activeOpts };
          wanted.forEach((id) => (merged[id] = true));
          const refetched = await fetchWithOptions(merged);
          if (refetched) await callGenerate(message, refetched.schema, previousAttempt);
        }
      } catch (e) {
        showAdHocDebugLog('generate', 'orchestrate FAILED', e);
        setGenerateError(getApiError({ error: e, defaultError: 'Failed to generate report' }));
      } finally {
        setGenerating(false);
      }
    },
    [oystehrZambda, datasetOptions, schema, inferOptions, fetchWithOptions, callGenerate]
  );

  orchestrateRef.current = orchestrate;

  useEffect(() => {
    if (!pendingRegenerate || loading || generating) return;
    const request = pendingRegenerate;
    setPendingRegenerate(null);
    void orchestrate(request, false);
  }, [pendingRegenerate, loading, generating, orchestrate]);

  const handleGenerate = useCallback((): void => {
    if (!request.trim() || !canCreate) return;
    autoRetryRef.current = 0;
    autoFixedRef.current = false;
    setGeneratedCode(null);
    void orchestrate(request, true);
  }, [request, canCreate, orchestrate]);

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
        void orchestrateRef.current?.(
          activeRequestRef.current,
          false,
          failingCode ? { code: failingCode, error: message } : undefined
        );
        return;
      }
      setRenderError(message);
    },
    [canCreate, generating, generatedCode]
  );

  const handleReset = useCallback((): void => {
    setGeneratedCode(null);
    setGeneratedTitle(undefined);
    setGenerateError(null);
    setUnavailableRequest(null);
    setRenderError(null);
    setLoadedSavedId(null);
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

  const handleRendered = useCallback((): void => {
    setRenderError(null);
    if (!autoFixedRef.current) return;
    autoFixedRef.current = false;
    if (!canCreate || !oystehrZambda || !loadedSavedId || !generatedCode) return;
    void saveAdHocReport(oystehrZambda, {
      reportId: loadedSavedId,
      definition: buildDefinition(savedName || generatedTitle || 'Report', generatedCode),
    }).catch((e) => console.warn('Could not persist auto-fixed report', e));
  }, [canCreate, oystehrZambda, loadedSavedId, generatedCode, buildDefinition, savedName, generatedTitle]);

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
    [oystehrZambda, generatedCode, savedName, loadedSavedId, buildDefinition]
  );

  const openSaveDialog = useCallback((): void => {
    setSavedName((n) => n || generatedTitle || '');
    setSaveDialogOpen(true);
  }, [generatedTitle]);

  return {
    oystehrZambda,
    canView,
    canCreate,
    datasetId,
    dateRange,
    customDate,
    customStartDate,
    customEndDate,
    rows,
    schema,
    datasetOptions,
    loading,
    error,
    request,
    generating,
    generatedCode,
    generatedTitle,
    generateError,
    unavailableRequest,
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
