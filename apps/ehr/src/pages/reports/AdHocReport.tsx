import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import {
  Box,
  Button,
  CircularProgress,
  Collapse,
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
import React, { useCallback, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { generateAdHocReport } from '../../api/api';
import { AD_HOC_DATASETS, getDataset } from '../../features/reports/adHoc/datasets';
import { ReportFrame } from '../../features/reports/adHoc/ReportFrame';
import { AdHocRow, DatasetSchema } from '../../features/reports/adHoc/types';
import { useApiClients } from '../../hooks/useAppClients';
import PageContainer from '../../layout/PageContainer';

type DateRangeFilter = 'today' | 'yesterday' | 'last-7-days' | 'last-30-days' | 'custom' | 'customRange';

export default function AdHocReport(): React.ReactElement {
  const navigate = useNavigate();
  const { oystehrZambda } = useApiClients();

  const [datasetId, setDatasetId] = useState<string>(AD_HOC_DATASETS[0]?.id ?? 'encounters');
  const [dateRange, setDateRange] = useState<DateRangeFilter>('last-30-days');
  const [customDate, setCustomDate] = useState<string>(DateTime.now().toFormat('yyyy-MM-dd'));
  const [customStartDate, setCustomStartDate] = useState<string>(
    DateTime.now().minus({ days: 30 }).toFormat('yyyy-MM-dd')
  );
  const [customEndDate, setCustomEndDate] = useState<string>(DateTime.now().toFormat('yyyy-MM-dd'));

  const [rows, setRows] = useState<AdHocRow[] | null>(null);
  const [schema, setSchema] = useState<DatasetSchema | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [request, setRequest] = useState('');
  const [generating, setGenerating] = useState(false);
  const [generatedCode, setGeneratedCode] = useState<string | null>(null);
  const [generatedTitle, setGeneratedTitle] = useState<string | undefined>(undefined);
  const [generateError, setGenerateError] = useState<string | null>(null);
  const [renderError, setRenderError] = useState<string | null>(null);
  const [showCode, setShowCode] = useState(false);

  const getDateRangeIso = useCallback(
    (filter: DateRangeFilter): { start: string; end: string } => {
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
    },
    [customDate, customStartDate, customEndDate]
  );

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

  // Send schema + request (no rows) to the generate zambda; get back the JS the model wrote.
  // Phase 3 will execute that code on the fetched rows inside a sandboxed iframe.
  const handleGenerate = useCallback(async (): Promise<void> => {
    if (!oystehrZambda || !schema || !request.trim()) return;
    setGenerating(true);
    setGenerateError(null);
    setRenderError(null);
    setGeneratedCode(null);
    try {
      const result = await generateAdHocReport(oystehrZambda, { schema, request });
      setGeneratedCode(result.code);
      setGeneratedTitle(result.title);
    } catch (e) {
      setGenerateError(e instanceof Error ? e.message : 'Failed to generate report');
    } finally {
      setGenerating(false);
    }
  }, [oystehrZambda, schema, request]);

  return (
    <PageContainer>
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
            <Select value={datasetId} label="Dataset" onChange={(e: SelectChangeEvent) => setDatasetId(e.target.value)}>
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

        {schema && rows && (
          <>
            <Typography variant="subtitle1" sx={{ mb: 1 }}>
              Fetched <strong>{rows.length.toLocaleString()}</strong> rows · schema:{' '}
              <strong>{schema.fields.length}</strong> fields
            </Typography>

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
              onClick={() => void handleGenerate()}
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
                <Typography variant="h6" sx={{ mb: 1 }}>
                  {generatedTitle ?? 'Generated report'}
                </Typography>

                {renderError && (
                  <Box sx={{ mb: 2, p: 2, bgcolor: 'warning.light', borderRadius: 1 }}>
                    <Typography variant="body2">
                      The generated report failed to run: {renderError}. Try refining your request or regenerating.
                    </Typography>
                  </Box>
                )}

                {/* The model's code runs here, sandboxed, over the fetched rows. */}
                <ReportFrame code={generatedCode} data={rows} schema={schema} onError={setRenderError} />

                <Button size="small" sx={{ mt: 1 }} onClick={() => setShowCode((v) => !v)}>
                  {showCode ? 'Hide generated code' : 'View generated code'}
                </Button>
                <Collapse in={showCode}>
                  <Paper variant="outlined" sx={{ mt: 1, p: 2, bgcolor: 'grey.50', maxHeight: 480, overflow: 'auto' }}>
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
    </PageContainer>
  );
}
