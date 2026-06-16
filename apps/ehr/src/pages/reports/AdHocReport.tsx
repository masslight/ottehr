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
import { generateAdHocReport, listAdHocReports, saveAdHocReport } from '../../api/api';
import { AD_HOC_DATASETS, getDataset } from '../../features/reports/adHoc/datasets';
import { ReportFrame } from '../../features/reports/adHoc/ReportFrame';
import { clearAdHocSeed, peekAdHocSeed } from '../../features/reports/adHoc/seed';
import { AdHocRow, DatasetSchema } from '../../features/reports/adHoc/types';
import { useApiClients } from '../../hooks/useAppClients';
import PageContainer from '../../layout/PageContainer';

type DateRangeFilter = 'today' | 'yesterday' | 'last-7-days' | 'last-30-days' | 'custom' | 'customRange';

// How many times to transparently regenerate after a runtime error before surfacing it to the user.
const MAX_AUTO_RETRIES = 1;

// Pure version of the date-range computation (no component state) so the saved-report loader can
// compute a range directly from stored criteria without waiting for setState to land.
function rangeFromControls(
  filter: DateRangeFilter,
  customDate: string,
  customStartDate: string,
  customEndDate: string
): { start: string; end: string } {
  const now = DateTime.now().setZone('America/New_York');
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

export default function AdHocReport(): React.ReactElement {
  const navigate = useNavigate();
  const { oystehrZambda } = useApiClients();

  // Seeded mode: another report (e.g. Practice KPIs) handed us its already-fetched rows + schema.
  // peek (not consume) so StrictMode's double render is harmless; we clear it in an effect below.
  const [seed] = useState(() => peekAdHocSeed());
  useEffect(() => {
    clearAdHocSeed();
  }, []);

  const [datasetId, setDatasetId] = useState<string>(AD_HOC_DATASETS[0]?.id ?? 'encounters');
  const [dateRange, setDateRange] = useState<DateRangeFilter>('last-30-days');
  const [customDate, setCustomDate] = useState<string>(DateTime.now().toFormat('yyyy-MM-dd'));
  const [customStartDate, setCustomStartDate] = useState<string>(
    DateTime.now().minus({ days: 30 }).toFormat('yyyy-MM-dd')
  );
  const [customEndDate, setCustomEndDate] = useState<string>(DateTime.now().toFormat('yyyy-MM-dd'));

  const [rows, setRows] = useState<AdHocRow[] | null>(seed ? seed.rows : null);
  const [schema, setSchema] = useState<DatasetSchema | null>(seed ? seed.schema : null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const loadAttemptedRef = useRef(false);

  const handleFetch = useCallback(async (): Promise<void> => {
    if (!oystehrZambda) return;
    const dataset = getDataset(datasetId);
    if (!dataset) return;
    setLoading(true);
    setError(null);
    setRows(null);
    setSchema(null);
    try {
      const range = getDateRangeIso(dateRange);
      const fetched = await dataset.fetch({ oystehrZambda, dateRange: range });
      setRows(fetched);
      setSchema(dataset.buildSchema(fetched));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to fetch data');
    } finally {
      setLoading(false);
    }
  }, [oystehrZambda, datasetId, dateRange, getDateRangeIso]);

  // Send schema + request (no rows) to the generate zambda; get back the JS the model wrote and
  // run it in the sandboxed iframe. `conversation` carries prior request/code turns so follow-ups
  // ("now group by month") modify the previous report instead of starting over.
  const runGenerate = useCallback(
    async (message: string, priorConversation: AdHocReportTurn[]): Promise<void> => {
      if (!oystehrZambda || !schema) return;
      setGenerating(true);
      setGenerateError(null);
      setRenderError(null);
      try {
        const result = await generateAdHocReport(oystehrZambda, {
          schema,
          request: message,
          conversation: priorConversation.length ? priorConversation : undefined,
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
      } catch (e) {
        setGenerateError(e instanceof Error ? e.message : 'Failed to generate report');
      } finally {
        setGenerating(false);
      }
    },
    [oystehrZambda, schema]
  );

  // Fresh report: start a new conversation. Each user-initiated request gets a fresh auto-fix budget.
  const handleGenerate = useCallback((): void => {
    if (!request.trim()) return;
    autoRetryRef.current = 0;
    setGeneratedCode(null);
    void runGenerate(request, []);
  }, [request, runGenerate]);

  // Refinement: continue the conversation. If the last attempt threw at runtime, feed the error to
  // the model so it can self-correct even when the user just says "try again".
  const handleRefine = useCallback((): void => {
    if (!refineText.trim()) return;
    autoRetryRef.current = 0;
    const message = renderError
      ? `The previous code failed at runtime with this error: "${renderError}". ${refineText}`
      : refineText;
    void runGenerate(message, conversation);
  }, [refineText, renderError, conversation, runGenerate]);

  // When the generated code throws at runtime, transparently feed the error back and regenerate once
  // (e.g. a missing null-guard). This self-corrects the common runtime bugs instead of dead-ending on
  // the user; after the budget is spent, surface the error and the manual refine bar.
  const handleRenderError = useCallback(
    (message: string): void => {
      if (autoRetryRef.current < MAX_AUTO_RETRIES) {
        autoRetryRef.current += 1;
        const fix =
          `The previous code threw at runtime: "${message}". Return corrected code that fixes this — ` +
          `guard against null/undefined values (some fields are null for some rows) — and otherwise ` +
          `fulfils the same request.`;
        void runGenerate(fix, conversationRef.current);
        return;
      }
      setRenderError(message);
    },
    [runGenerate]
  );

  // Open from a saved tile (?saved=<id>): load the definition, set the controls from its criteria,
  // RE-FETCH live data for that range, and render the stored code. Distinct from the frozen-rows seed
  // path — saved reports always re-fetch, so relative ranges (e.g. "last 30 days") stay live.
  useEffect(() => {
    const savedId = searchParams.get('saved');
    if (!savedId || !oystehrZambda || seed || loadAttemptedRef.current) return;
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
        const filter = saved.criteria.dateRange as DateRangeFilter;
        setDatasetId(saved.datasetId);
        setDateRange(filter);
        if (saved.criteria.customDate) setCustomDate(saved.criteria.customDate);
        if (saved.criteria.customStartDate) setCustomStartDate(saved.criteria.customStartDate);
        if (saved.criteria.customEndDate) setCustomEndDate(saved.criteria.customEndDate);
        setRequest(saved.request);
        setLoadedSavedId(saved.id);
        setSavedName(saved.name);

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
        const fetched = await dataset.fetch({ oystehrZambda, dateRange: range });
        setRows(fetched);
        setSchema(dataset.buildSchema(fetched));
        setGeneratedCode(saved.code);
        setGeneratedTitle(saved.title);
        const conv: AdHocReportTurn[] = [
          { role: 'user', content: saved.request },
          { role: 'assistant', content: saved.code },
        ];
        conversationRef.current = conv;
        setConversation(conv);
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
      datasetId,
      criteria: { dateRange, customDate, customStartDate, customEndDate },
      request,
      code: generatedCode ?? '',
      title: generatedTitle,
    }),
    [datasetId, dateRange, customDate, customStartDate, customEndDate, request, generatedCode, generatedTitle]
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

          {/* Seeded mode: the dataset arrived from another report — show its provenance instead of the
            dataset/date/fetch controls. Everything below this is identical to the normal flow. */}
          {seed && (
            <Box
              sx={{
                mb: 3,
                p: 2,
                bgcolor: '#eef4ff',
                border: '1px solid',
                borderColor: 'primary.light',
                borderRadius: 1,
              }}
            >
              <Typography variant="body2">
                Exploring <strong>{seed.sourceLabel}</strong> — {seed.rows.length.toLocaleString()} rows handed off from
                another report. Describe the report you want below, or{' '}
                <Button
                  size="small"
                  variant="text"
                  sx={{ p: 0, minWidth: 0, verticalAlign: 'baseline' }}
                  onClick={() => navigate(-1)}
                >
                  go back
                </Button>
                .
              </Typography>
            </Box>
          )}

          {/* Dataset + date range + fetch (hidden in seeded mode) */}
          {!seed && (
            <Box sx={{ mb: 3, display: 'flex', gap: 2, alignItems: 'center', flexWrap: 'wrap' }}>
              <FormControl size="small" sx={{ minWidth: 180 }}>
                <InputLabel>Dataset</InputLabel>
                <Select
                  value={datasetId}
                  label="Dataset"
                  onChange={(e: SelectChangeEvent) => setDatasetId(e.target.value)}
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
          )}

          {error && (
            <Box sx={{ mb: 2, p: 2, bgcolor: 'error.light', borderRadius: 1 }}>
              <Typography color="error">{error}</Typography>
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

              {/* Report request → generate. The model gets schema + request only (no rows). Phase 3 will
                execute the returned code on the fetched rows inside a sandboxed iframe. */}
              <Typography variant="subtitle1" sx={{ mb: 1 }}>
                Describe the report you want
              </Typography>
              <TextField
                multiline
                minRows={2}
                fullWidth
                placeholder="e.g. Bar chart of visits per provider; or a table of visit counts by location and month"
                value={request}
                onChange={(e) => setRequest(e.target.value)}
                sx={{ mb: 1 }}
              />
              <Button
                variant="contained"
                onClick={handleGenerate}
                disabled={generating || !request.trim()}
                sx={{ mb: 2 }}
              >
                {generating ? <CircularProgress size={20} /> : 'Generate report'}
              </Button>

              {generateError && (
                <Box sx={{ mb: 2, p: 2, bgcolor: 'error.light', borderRadius: 1 }}>
                  <Typography color="error">{generateError}</Typography>
                </Box>
              )}

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
                    reportTitle={generatedTitle}
                  />

                  {/* Refine: follow-up requests continue the conversation so the model modifies the
                    current report ("now group by month", "make it a pie chart"). */}
                  <Box sx={{ mt: 2, display: 'flex', gap: 1, alignItems: 'flex-start' }}>
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
