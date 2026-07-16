import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import SaveIcon from '@mui/icons-material/Save';
import {
  Box,
  Button,
  CircularProgress,
  Collapse,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  IconButton,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  SelectChangeEvent,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from '@mui/material';
import { DateTime } from 'luxon';
import { useSnackbar } from 'notistack';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { AdHocReportTurn, SavedAdHocReportDefinition } from 'utils';
import { generateAdHocReport, inferAdHocReportLayers, listAdHocReports, saveAdHocReport } from '../../api/api';
import { getBatchWindowFailures } from '../../features/reports/adHoc/datasetHelpers';
import { AD_HOC_DATASETS, getDataset, otherDatasetsFor } from '../../features/reports/adHoc/datasets';
import { ReportFrame } from '../../features/reports/adHoc/ReportFrame';
import { AdHocRow, DatasetSchema } from '../../features/reports/adHoc/types';
import { useApiClients } from '../../hooks/useAppClients';
import PageContainer from '../../layout/PageContainer';

type DateRangeFilter = 'today' | 'yesterday' | 'last-7-days' | 'last-30-days' | 'custom' | 'customRange';

// How many times to transparently regenerate after a render failure (threw, or rendered nothing)
// before surfacing it to the user. The server no longer execute-validates generated code (that was
// an arbitrary-code-execution surface), so this client loop IS the runtime validation: render in the
// sandboxed iframe, and on failure regenerate with the failing code + error as `previousAttempt`
// feedback. Initial generation + 2 retries = 3 attempts, matching the old server-side budget.
const MAX_AUTO_RETRIES = 2;

// Pure version of the date-range computation (no component state) so the saved-report loader can
// compute a range directly from stored criteria without waiting for setState to land.
// The window boundaries are the VIEWER'S BROWSER-LOCAL day boundaries: a report can mix locations
// across timezones, so the viewer's zone is the only internally consistent frame (and it matches
// how every date/time in the generated report is rendered). The fetch itself is by absolute ISO
// instants, so only the boundary zone — not the query semantics — depends on the viewer.
function rangeFromControls(
  filter: DateRangeFilter,
  customDate: string,
  customStartDate: string,
  customEndDate: string
): { start: string; end: string } {
  const now = DateTime.now();
  const today = now.startOf('day');
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
      // Parsed in the browser-local zone: the picked calendar day means "that day where I am".
      const d = DateTime.fromISO(customDate);
      return { start: d.startOf('day').toISO() ?? '', end: d.endOf('day').toISO() ?? '' };
    }
    case 'customRange': {
      const s = DateTime.fromISO(customStartDate);
      const e = DateTime.fromISO(customEndDate);
      return { start: s.startOf('day').toISO() ?? '', end: e.endOf('day').toISO() ?? '' };
    }
    default:
      return { start: today.toISO() ?? '', end: today.endOf('day').toISO() ?? '' };
  }
}

// The partial-results warning for a fetched row set: some (but not all) batched date windows failed,
// so the report is computed over incomplete data. Null when the fetch was complete.
function partialWarningFor(rows: AdHocRow[]): string | null {
  const failures = getBatchWindowFailures(rows);
  return failures && failures.failedWindows > 0
    ? `${failures.failedWindows} of ${failures.totalWindows} date windows failed to load — results are partial.`
    : null;
}

// The checkbox state a dataset starts with — each option's `default`, keyed by option id.
function defaultOptionsFor(datasetId: string): Record<string, boolean> {
  const out: Record<string, boolean> = {};
  (getDataset(datasetId)?.options ?? []).forEach((opt) => {
    out[opt.id] = !!opt.default;
  });
  return out;
}

export default function AdHocReport(): React.ReactElement {
  const navigate = useNavigate();
  const { oystehrZambda } = useApiClients();

  const [datasetId, setDatasetId] = useState<string>(AD_HOC_DATASETS[0]?.id ?? 'encounters-comprehensive');
  const [dateRange, setDateRange] = useState<DateRangeFilter>('last-30-days');
  const [customDate, setCustomDate] = useState<string>(DateTime.now().toFormat('yyyy-MM-dd'));
  const [customStartDate, setCustomStartDate] = useState<string>(
    DateTime.now().minus({ days: 30 }).toFormat('yyyy-MM-dd')
  );
  const [customEndDate, setCustomEndDate] = useState<string>(DateTime.now().toFormat('yyyy-MM-dd'));

  // Dataset opt-in layers (checkboxes), defaulted per dataset. Reset whenever the dataset changes.
  const [datasetOptions, setDatasetOptions] = useState<Record<string, boolean>>(() =>
    defaultOptionsFor(AD_HOC_DATASETS[0]?.id ?? 'encounters-comprehensive')
  );

  const [rows, setRows] = useState<AdHocRow[] | null>(null);
  const [schema, setSchema] = useState<DatasetSchema | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Some (not all) batched date windows failed to load — the data is usable but incomplete. Kept
  // separate from `error`, which is reserved for hard failures.
  const [partialWarning, setPartialWarning] = useState<string | null>(null);

  const [request, setRequest] = useState('');
  const [generating, setGenerating] = useState(false);
  const [generatedCode, setGeneratedCode] = useState<string | null>(null);
  const [generatedTitle, setGeneratedTitle] = useState<string | undefined>(undefined);
  const [generateError, setGenerateError] = useState<string | null>(null);
  const [renderError, setRenderError] = useState<string | null>(null);
  const [showCode, setShowCode] = useState(false);
  const [showSchema, setShowSchema] = useState(false);
  const [conversation, setConversation] = useState<AdHocReportTurn[]>([]);
  const [refineText, setRefineText] = useState('');
  // Mirror of `conversation` for the stable render-error callback, and a per-request auto-fix budget.
  const conversationRef = useRef<AdHocReportTurn[]>([]);
  const autoRetryRef = useRef(0);
  // The last generate call (message + conversation snapshot), so the render-failure loop can re-issue
  // the SAME request with `previousAttempt` feedback. Null until something has been generated (or a
  // saved report loaded), which also keeps the loop from firing for states it can't regenerate.
  const lastGenerateRef = useRef<{ message: string; priorConversation: AdHocReportTurn[] } | null>(null);
  // True once the current code is an auto-repair of a crashed render — so a successful render can be
  // persisted back to the saved report (otherwise it crash-then-retries on every open).
  const autoFixedRef = useRef(false);
  // Set when a report is opened from a saved tile so the view starts at the top:
  // the table grid mounts below the chart after the iframe renders and otherwise
  // pulls the page down to itself. Cleared after we scroll back up once.
  const scrollTopOnRenderRef = useRef(false);

  const getDateRangeIso = useCallback(
    (filter: DateRangeFilter): { start: string; end: string } =>
      rangeFromControls(filter, customDate, customStartDate, customEndDate),
    [customDate, customStartDate, customEndDate]
  );

  // Saved-report state. `loadedSavedId` is set when this screen was opened from a saved tile
  // (?saved=<id>) — it drives "Update" vs "Save as new". `savedName` seeds the save dialog.
  const [searchParams] = useSearchParams();
  const { enqueueSnackbar } = useSnackbar();
  const [loadedSavedId, setLoadedSavedId] = useState<string | null>(null);
  const [savedName, setSavedName] = useState<string>('');
  const [savedDescription, setSavedDescription] = useState<string>('');
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const loadAttemptedRef = useRef(false);

  // Fetch the dataset for `opts` (the layers to load), build the schema, and return both so a caller
  // can use them immediately without waiting for setState. Also records the loaded layer set in
  // `datasetOptions` so it's what gets persisted when the report is saved.
  const fetchWithOptions = useCallback(
    async (opts: Record<string, boolean>): Promise<{ rows: AdHocRow[]; schema: DatasetSchema } | null> => {
      if (!oystehrZambda) return null;
      const dataset = getDataset(datasetId);
      if (!dataset) return null;
      setLoading(true);
      setError(null);
      setPartialWarning(null);
      try {
        const range = getDateRangeIso(dateRange);
        const fetched = await dataset.fetch({ oystehrZambda, dateRange: range, options: opts });
        setPartialWarning(partialWarningFor(fetched));
        const builtSchema: DatasetSchema = {
          ...dataset.buildSchema(fetched, opts),
          otherDatasets: otherDatasetsFor(datasetId),
        };
        setRows(fetched);
        setSchema(builtSchema);
        setDatasetOptions(opts);
        return { rows: fetched, schema: builtSchema };
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to fetch data');
        return null;
      } finally {
        setLoading(false);
      }
    },
    [oystehrZambda, datasetId, dateRange, getDateRangeIso]
  );

  // Manual "Fetch data" button: load just the base dataset (current layer selection) so the user can
  // preview the schema / row count. Generating a report does its own layer-aware fetch below.
  const handleFetch = useCallback((): void => {
    void fetchWithOptions(datasetOptions);
  }, [fetchWithOptions, datasetOptions]);

  // Ask the inference zambda which opt-in layers this request needs, and return the option map to
  // fetch. Falls back to the dataset defaults on any failure — the generate step's `needsLayers` is
  // the safety net that backfills anything the classifier misses.
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
      } catch {
        return base;
      }
    },
    [oystehrZambda, datasetId]
  );

  // Send schema + request (no rows) to the generate zambda, run the returned JS in the sandboxed
  // iframe, and record the turn. Returns the raw result so the orchestrator can react to needsLayers.
  const callGenerate = useCallback(
    async (
      message: string,
      priorConversation: AdHocReportTurn[],
      useSchema: DatasetSchema,
      previousAttempt?: { code: string; error: string }
    ): Promise<{ needsLayers?: string[] } | null> => {
      if (!oystehrZambda) return null;
      const result = await generateAdHocReport(oystehrZambda, {
        schema: useSchema,
        request: message,
        conversation: priorConversation.length ? priorConversation : undefined,
        previousAttempt,
      });
      setGeneratedCode(result.code);
      setGeneratedTitle(result.title);
      // Keep only the most recent exchanges so refine prompts stay bounded.
      const next = [
        ...priorConversation,
        { role: 'user' as const, content: message },
        { role: 'assistant' as const, content: result.code },
      ].slice(-6);
      conversationRef.current = next;
      setConversation(next);
      setRefineText('');
      return result;
    },
    [oystehrZambda]
  );

  // The generate pipeline: (optionally) infer the needed layers, fetch them, generate the report, and
  // if the report reports it still needs an un-loaded layer (`needsLayers`), fetch that and regenerate
  // once. `infer` is true for a fresh request and false for a refinement (which reuses the loaded
  // data, but still auto-fetches if the refinement introduces a new concept).
  const orchestrate = useCallback(
    async (
      message: string,
      priorConversation: AdHocReportTurn[],
      infer: boolean,
      previousAttempt?: { code: string; error: string }
    ): Promise<void> => {
      if (!oystehrZambda) return;
      setGenerating(true);
      setGenerateError(null);
      setRenderError(null);
      lastGenerateRef.current = { message, priorConversation };
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

        const result = await callGenerate(message, priorConversation, activeSchema, previousAttempt);

        // Safety net: the report named layers it needs that weren't loaded — fetch them and regenerate.
        const wanted = (result?.needsLayers ?? []).filter((id) => id in activeOpts && !activeOpts[id]);
        if (wanted.length) {
          const merged = { ...activeOpts };
          wanted.forEach((id) => (merged[id] = true));
          const refetched = await fetchWithOptions(merged);
          if (refetched) await callGenerate(message, priorConversation, refetched.schema, previousAttempt);
        }
      } catch (e) {
        setGenerateError(e instanceof Error ? e.message : 'Failed to generate report');
      } finally {
        setGenerating(false);
      }
    },
    [oystehrZambda, datasetOptions, schema, inferOptions, fetchWithOptions, callGenerate]
  );

  // Fresh report: start a new conversation, infer the layers. Each user-initiated request gets a
  // fresh auto-fix budget.
  const handleGenerate = useCallback((): void => {
    if (!request.trim()) return;
    autoRetryRef.current = 0;
    setGeneratedCode(null);
    // A fresh request is a new report — de-link any previously saved report so the save dialog
    // doesn't carry the old name onto this one (or silently overwrite the old one via "Update").
    setLoadedSavedId(null);
    setSavedName('');
    setSavedDescription('');
    void orchestrate(request, [], true);
  }, [request, orchestrate]);

  // Refinement: continue the conversation over the already-loaded data. If the last attempt threw at
  // runtime, feed the error to the model so it can self-correct even when the user just says "try again".
  const handleRefine = useCallback((): void => {
    if (!refineText.trim()) return;
    autoRetryRef.current = 0;
    const message = renderError
      ? `The previous code failed at runtime with this error: "${renderError}". ${refineText}`
      : refineText;
    void orchestrate(message, conversation, false);
  }, [refineText, renderError, conversation, orchestrate]);

  // Reset the generated report (and the refinement conversation) so the user can start a new one.
  // Keeps the fetched rows/schema and the request text, so they can tweak and regenerate without
  // re-fetching; only the report artifacts are cleared.
  const handleReset = useCallback((): void => {
    setGeneratedCode(null);
    setGeneratedTitle(undefined);
    setGenerateError(null);
    setRenderError(null);
    setConversation([]);
    setRefineText('');
    setLoadedSavedId(null);
    setSavedName('');
    setSavedDescription('');
    conversationRef.current = [];
    lastGenerateRef.current = null;
    autoRetryRef.current = 0;
    autoFixedRef.current = false;
  }, []);

  // The render→validate→regenerate loop. The sandboxed iframe reports the render outcome; on a
  // failure (the code threw, timed out, or rendered nothing) transparently re-issue the SAME request
  // with the failing code + error as `previousAttempt`, so the model regenerates with the runtime
  // failure as feedback. After the budget is spent, surface the failure and the manual refine bar.
  const handleRenderError = useCallback(
    (message: string): void => {
      const last = lastGenerateRef.current;
      if (last && generatedCode && autoRetryRef.current < MAX_AUTO_RETRIES) {
        autoRetryRef.current += 1;
        autoFixedRef.current = true;
        void orchestrate(last.message, last.priorConversation, false, { code: generatedCode, error: message });
        return;
      }
      setRenderError(message);
      if (last) {
        setGenerateError(
          `Could not generate a valid report after ${MAX_AUTO_RETRIES + 1} attempts. Please rephrase your ` +
            `request and try again.`
        );
      }
    },
    [orchestrate, generatedCode]
  );

  // Open from a saved tile (?saved=<id>): load the definition, set the controls from its criteria,
  // RE-FETCH live data for that range, and render the stored code. Distinct from the frozen-rows seed
  // path — saved reports always re-fetch, so relative ranges (e.g. "last 30 days") stay live.
  useEffect(() => {
    const savedId = searchParams.get('saved');
    if (!savedId || !oystehrZambda || loadAttemptedRef.current) return;
    loadAttemptedRef.current = true;
    void (async () => {
      setLoading(true);
      setError(null);
      setPartialWarning(null);
      try {
        const { reports } = await listAdHocReports(oystehrZambda);
        const saved = reports.find((r) => r.id === savedId);
        if (!saved) {
          setError('That saved report no longer exists.');
          return;
        }
        const filter = saved.criteria.dateRange as DateRangeFilter;
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
        const fetched = await dataset.fetch({ oystehrZambda, dateRange: range, options: savedOptions });
        setPartialWarning(partialWarningFor(fetched));
        setRows(fetched);
        setSchema({ ...dataset.buildSchema(fetched, savedOptions), otherDatasets: otherDatasetsFor(saved.datasetId) });
        setGeneratedCode(saved.code);
        setGeneratedTitle(saved.title);
        scrollTopOnRenderRef.current = true; // start at the top once this report renders
        const conv: AdHocReportTurn[] = [
          { role: 'user', content: saved.request },
          { role: 'assistant', content: saved.code },
        ];
        conversationRef.current = conv;
        setConversation(conv);
        // Arm the render-failure loop for the stored code too: if it crashes on today's data, the
        // saved request is regenerated with the failing code as `previousAttempt` (and the fixed
        // code is persisted back — see handleRendered). Empty prior conversation: the failing code
        // travels in previousAttempt, so repeating it as an assistant turn would be redundant.
        lastGenerateRef.current = { message: saved.request, priorConversation: [] };
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to load saved report');
      } finally {
        setLoading(false);
      }
    })();
    // Only run on first mount once the zambda client is ready.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [oystehrZambda]);

  const buildDefinition = useCallback(
    (name: string): SavedAdHocReportDefinition => ({
      name: name.trim(),
      description: savedDescription.trim() || undefined,
      datasetId,
      criteria: { dateRange, customDate, customStartDate, customEndDate, options: datasetOptions },
      request,
      code: generatedCode ?? '',
      title: generatedTitle,
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
      generatedCode,
      generatedTitle,
    ]
  );

  // mode 'update' overwrites the saved report this screen was opened from; 'new' always creates one.
  const handleSave = useCallback(
    async (mode: 'update' | 'new'): Promise<void> => {
      if (!oystehrZambda || !generatedCode || !savedName.trim()) return;
      setSaving(true);
      try {
        const { report } = await saveAdHocReport(oystehrZambda, {
          reportId: mode === 'update' ? loadedSavedId ?? undefined : undefined,
          definition: buildDefinition(savedName),
        });
        setLoadedSavedId(report.id);
        setSavedName(report.name);
        setSaveDialogOpen(false);
        enqueueSnackbar(`Saved report “${report.name}”.`, { variant: 'success' });
      } catch (e) {
        enqueueSnackbar(e instanceof Error ? e.message : 'Could not save the report.', { variant: 'error' });
      } finally {
        setSaving(false);
      }
    },
    [oystehrZambda, generatedCode, savedName, loadedSavedId, buildDefinition, enqueueSnackbar]
  );

  // When an auto-repaired report renders cleanly, persist the fixed code back to the saved report so
  // it doesn't crash-then-retry every time it's opened. Only fires for a report opened from a tile.
  const handleRendered = useCallback((): void => {
    // Opening a saved report should start at the top. The chart renders first,
    // then the table grid mounts below it and scrolls the page down to itself;
    // re-assert top once now and again after the grid mounts (one-shot).
    if (scrollTopOnRenderRef.current) {
      scrollTopOnRenderRef.current = false;
      window.scrollTo({ top: 0 });
      requestAnimationFrame(() => window.scrollTo({ top: 0 }));
      setTimeout(() => window.scrollTo({ top: 0 }), 250);
    }
    if (!autoFixedRef.current) return;
    autoFixedRef.current = false;
    if (!oystehrZambda || !loadedSavedId || !generatedCode) return;
    void saveAdHocReport(oystehrZambda, {
      reportId: loadedSavedId,
      definition: buildDefinition(savedName || generatedTitle || 'Report'),
    }).catch((e) => console.warn('Could not persist auto-fixed report', e));
  }, [oystehrZambda, loadedSavedId, generatedCode, buildDefinition, savedName, generatedTitle]);

  return (
    <PageContainer>
      <>
        <Box>
          <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
            <IconButton onClick={() => navigate('/reports')} sx={{ mr: 2 }}>
              <ArrowBackIcon />
            </IconButton>
            <AutoAwesomeIcon sx={{ fontSize: 32, color: 'primary.main', mr: 2 }} />
            <Typography variant="h4" component="h1" color="primary.dark" fontWeight={600}>
              Ad-Hoc Report
            </Typography>
          </Box>

          {/* Dataset + date range + fetch */}
          <Box sx={{ mb: 3, display: 'flex', gap: 2, alignItems: 'center', flexWrap: 'wrap' }}>
            <FormControl size="small" sx={{ minWidth: 180 }}>
              <InputLabel>Dataset</InputLabel>
              <Select
                value={datasetId}
                label="Dataset"
                onChange={(e: SelectChangeEvent) => {
                  setDatasetId(e.target.value);
                  setDatasetOptions(defaultOptionsFor(e.target.value));
                }}
              >
                {AD_HOC_DATASETS.map((d) => (
                  <MenuItem key={d.id} value={d.id}>
                    {d.label}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <FormControl size="small" sx={{ minWidth: 200 }}>
              <InputLabel>Date Range</InputLabel>
              <Select
                value={dateRange}
                label="Date Range"
                onChange={(e: SelectChangeEvent<DateRangeFilter>) => setDateRange(e.target.value as DateRangeFilter)}
              >
                <MenuItem value="today">Today</MenuItem>
                <MenuItem value="yesterday">Yesterday</MenuItem>
                <MenuItem value="last-7-days">Last 7 Days</MenuItem>
                <MenuItem value="last-30-days">Last 30 Days</MenuItem>
                <MenuItem value="custom">Custom Date</MenuItem>
                <MenuItem value="customRange">Custom Date Range</MenuItem>
              </Select>
            </FormControl>

            {dateRange === 'custom' && (
              <TextField
                type="date"
                size="small"
                value={customDate}
                onChange={(e) => setCustomDate(e.target.value)}
                sx={{ minWidth: 160 }}
                InputLabelProps={{ shrink: true }}
              />
            )}
            {dateRange === 'customRange' && (
              <>
                <TextField
                  type="date"
                  size="small"
                  label="Start"
                  value={customStartDate}
                  onChange={(e) => setCustomStartDate(e.target.value)}
                  sx={{ minWidth: 160 }}
                  InputLabelProps={{ shrink: true }}
                />
                <TextField
                  type="date"
                  size="small"
                  label="End"
                  value={customEndDate}
                  onChange={(e) => setCustomEndDate(e.target.value)}
                  sx={{ minWidth: 160 }}
                  InputLabelProps={{ shrink: true }}
                />
              </>
            )}

            <Button variant="contained" onClick={() => void handleFetch()} disabled={loading || !oystehrZambda}>
              {loading ? <CircularProgress size={20} /> : 'Fetch data'}
            </Button>
          </Box>

          {error && (
            <Box sx={{ mb: 2, p: 2, bgcolor: 'error.light', borderRadius: 1 }}>
              <Typography color="error">{error}</Typography>
            </Box>
          )}

          {/* Partial-data warning: some batched date windows failed but the rest loaded, so the report
              below is computed over incomplete data. Distinct from the red `error` box above. */}
          {partialWarning && (
            <Box sx={{ mb: 2, p: 2, bgcolor: 'warning.light', borderRadius: 1 }}>
              <Typography variant="body2">{partialWarning}</Typography>
            </Box>
          )}

          {/* Describe → generate. The right data layers are inferred from the request and fetched
              automatically — there are no data-layer checkboxes to manage. The model only ever sees
              the schema (column metadata), never the rows. */}
          <Typography variant="subtitle1" sx={{ mb: 1 }}>
            Describe the report you want
          </Typography>
          <TextField
            multiline
            minRows={2}
            fullWidth
            placeholder="e.g. Bar chart of visits per provider; or average time from check-in to exam room by location"
            value={request}
            onChange={(e) => setRequest(e.target.value)}
            sx={{ mb: 1 }}
          />
          <Button
            variant="contained"
            onClick={generatedCode ? handleReset : handleGenerate}
            disabled={generating || loading || (!generatedCode && (!request.trim() || !oystehrZambda))}
            sx={{ mb: 2 }}
          >
            {generating || loading ? (
              <CircularProgress size={20} />
            ) : generatedCode ? (
              'Reset Report'
            ) : (
              'Generate report'
            )}
          </Button>

          {/* Refine: follow-up requests continue the conversation so the model modifies the current
              report ("now group by month", "make it a pie chart"). Sits directly below the
              Generate/Reset button; only shown once a report exists to refine. */}
          {generatedCode && (
            <Box sx={{ mb: 2, display: 'flex', gap: 1, alignItems: 'flex-start' }}>
              <TextField
                size="small"
                fullWidth
                placeholder={
                  renderError
                    ? 'Describe a change, or just say "fix it" — the error is sent along automatically'
                    : 'Refine this report — e.g. "now break it down by month" or "make it a pie chart"'
                }
                value={refineText}
                onChange={(e) => setRefineText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleRefine();
                  }
                }}
                disabled={generating}
              />
              <Button variant="outlined" onClick={handleRefine} disabled={generating || !refineText.trim()}>
                {generating ? <CircularProgress size={20} /> : 'Refine'}
              </Button>
            </Box>
          )}

          {generateError && (
            <Box sx={{ mb: 2, p: 2, bgcolor: 'error.light', borderRadius: 1 }}>
              <Typography color="error">{generateError}</Typography>
            </Box>
          )}

          {schema && rows && (
            <>
              <Box sx={{ mb: 1, display: 'flex', alignItems: 'center', gap: 1 }}>
                <Typography variant="subtitle1">
                  Fetched <strong>{rows.length.toLocaleString()}</strong> rows · schema:{' '}
                  <strong>{schema.fields.length}</strong> fields
                </Typography>
                <Button size="small" onClick={() => setShowSchema((v) => !v)}>
                  {showSchema ? 'Hide fields' : 'Show fields'}
                </Button>
              </Box>

              <Collapse in={showSchema}>
                <Paper variant="outlined" sx={{ mb: 3, overflow: 'auto' }}>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>Field</TableCell>
                        <TableCell>Type</TableCell>
                        <TableCell>Description</TableCell>
                        <TableCell>Domain</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {schema.fields.map((f) => (
                        <TableRow key={f.name}>
                          <TableCell sx={{ fontFamily: 'monospace' }}>{f.name}</TableCell>
                          <TableCell>{f.type}</TableCell>
                          <TableCell>{f.description}</TableCell>
                          <TableCell sx={{ fontSize: '0.75rem', color: 'text.secondary' }}>
                            {f.values
                              ? `${f.values.length} values: ${f.values.slice(0, 8).join(', ')}${
                                  f.values.length > 8 ? '…' : ''
                                }`
                              : f.min !== undefined
                              ? `${f.min} … ${f.max}`
                              : '(free text)'}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </Paper>
              </Collapse>

              {generatedCode && schema && (
                <>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                    <Typography variant="h6" sx={{ flexGrow: 1 }}>
                      {generatedTitle ?? 'Generated report'}
                    </Typography>
                    <Button
                      size="small"
                      variant="outlined"
                      startIcon={<SaveIcon />}
                      onClick={() => {
                        if (!savedName) setSavedName(generatedTitle ?? '');
                        setSaveDialogOpen(true);
                      }}
                    >
                      {loadedSavedId ? 'Save' : 'Save report'}
                    </Button>
                  </Box>

                  {renderError && (
                    <Box sx={{ mb: 2, p: 2, bgcolor: 'warning.light', borderRadius: 1 }}>
                      <Typography variant="body2">
                        The generated report failed to run: {renderError}. Try refining your request or regenerating.
                      </Typography>
                    </Box>
                  )}

                  {/* The model's code runs here, sandboxed, over the fetched rows. */}
                  <ReportFrame
                    code={generatedCode}
                    data={rows}
                    schema={schema}
                    onError={handleRenderError}
                    onRendered={handleRendered}
                    reportTitle={generatedTitle}
                  />

                  <Button size="small" sx={{ mt: 1 }} onClick={() => setShowCode((v) => !v)}>
                    {showCode ? 'Hide generated code' : 'View generated code'}
                  </Button>
                  <Collapse in={showCode}>
                    <Paper
                      variant="outlined"
                      sx={{ mt: 1, p: 2, bgcolor: 'grey.50', maxHeight: 480, overflow: 'auto' }}
                    >
                      <Box
                        component="pre"
                        sx={{ m: 0, fontSize: '0.75rem', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}
                      >
                        {generatedCode}
                      </Box>
                    </Paper>
                  </Collapse>
                </>
              )}
            </>
          )}
        </Box>

        <Dialog open={saveDialogOpen} onClose={() => setSaveDialogOpen(false)} fullWidth maxWidth="xs">
          <DialogTitle>Save report</DialogTitle>
          <DialogContent>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              This saves the dataset, the date-range criteria, and the view — not the data. Opening it later re-fetches
              fresh data for the criteria and re-renders this report. It appears as a tile under Saved reports for
              everyone with report access.
            </Typography>
            <TextField
              autoFocus
              fullWidth
              size="small"
              label="Report name"
              value={savedName}
              onChange={(e) => setSavedName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && savedName.trim() && !saving) {
                  e.preventDefault();
                  void handleSave(loadedSavedId ? 'update' : 'new');
                }
              }}
            />
            <TextField
              fullWidth
              size="small"
              multiline
              minRows={2}
              label="Description (optional)"
              placeholder="A sentence or two describing what this report shows."
              value={savedDescription}
              onChange={(e) => setSavedDescription(e.target.value)}
              sx={{ mt: 2 }}
            />
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setSaveDialogOpen(false)} disabled={saving}>
              Cancel
            </Button>
            {loadedSavedId && (
              <Button onClick={() => void handleSave('new')} disabled={saving || !savedName.trim()}>
                Save as new
              </Button>
            )}
            <Button
              variant="contained"
              onClick={() => void handleSave(loadedSavedId ? 'update' : 'new')}
              disabled={saving || !savedName.trim()}
            >
              {saving ? <CircularProgress size={18} /> : loadedSavedId ? 'Update' : 'Save'}
            </Button>
          </DialogActions>
        </Dialog>
      </>
    </PageContainer>
  );
}
