import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import SaveIcon from '@mui/icons-material/Save';
import {
  Alert,
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
import React from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AD_HOC_REPORT_LLM_MODELS,
  AD_HOC_REPORT_MODELS,
  AdHocReportModel,
} from 'utils/lib/types/adhoc/generation/generate.types';
import { getLlmModelVariantLabel } from 'utils/lib/types/api/ai-models.constants';
import PageContainer from '../../../layout/PageContainer';
import { ReportFrame } from '../sandbox/ReportFrame';
import { AdHocDateRangePicker } from './AdHocDateRangePicker';
import { AllDatasetsInfo, DatasetLayersInfo } from './DatasetLayersInfo';
import { RawDataGrid } from './RawDataGrid';
import { useReportBuilder } from './useReportBuilder';

export default function ReportBuilderPage(): React.ReactElement {
  const navigate = useNavigate();
  const rb = useReportBuilder();
  const [showRawData, setShowRawData] = React.useState(false);

  if (!rb.canView) {
    return (
      <PageContainer>
        <Box>
          <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
            <IconButton onClick={() => navigate('/reports')} sx={{ mr: 2 }}>
              <ArrowBackIcon />
            </IconButton>
            <Typography variant="h4" component="h1" color="primary.dark" fontWeight={600}>
              Ad-Hoc Report
            </Typography>
          </Box>
          <Typography color="text.secondary">
            You don’t have access to ad-hoc reports. Contact an administrator if you need access.
          </Typography>
        </Box>
      </PageContainer>
    );
  }

  // A dataset report has rows + schema; a plan report has the resources its plan fetched.
  const hasDatasetData = !!rb.schema && !!rb.rows;
  const hasPlanData = !!rb.plan && !!rb.resources && !!rb.planParams;
  const totalResources = rb.fetchStats?.reduce((sum, step) => sum + step.count, 0) ?? 0;
  const fetchSeconds = rb.fetchStats?.length
    ? Math.round(rb.fetchStats.reduce((max, s) => Math.max(max, s.ms), 0) / 100) / 10
    : 0;

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

          <Box sx={{ mb: 3, display: 'flex', gap: 2, alignItems: 'center', flexWrap: 'wrap' }}>
            {/* A report without a date range (one patient's history) does not ask for one. */}
            {rb.needsDateRange && (
              <AdHocDateRangePicker
                dateRange={rb.dateRange}
                customDate={rb.customDate}
                customStartDate={rb.customStartDate}
                customEndDate={rb.customEndDate}
                setDateRange={rb.setDateRange}
                setCustomDate={rb.setCustomDate}
                setCustomStartDate={rb.setCustomStartDate}
                setCustomEndDate={rb.setCustomEndDate}
              />
            )}

            {/* A per-patient plan takes the patient from the screen that opened the builder, or from here. */}
            {rb.needsPatient && !rb.patientFromScreen && (
              <TextField
                size="small"
                label="Patient ID"
                value={rb.patientIdInput}
                onChange={(e) => rb.setPatientIdInput(e.target.value)}
                sx={{ minWidth: 300 }}
              />
            )}

            {rb.canPickModel && (
              <FormControl size="small" sx={{ minWidth: 200 }}>
                <InputLabel id="adhoc-model-label">Model</InputLabel>
                <Select
                  labelId="adhoc-model-label"
                  id="adhoc-model"
                  value={rb.model}
                  label="Model"
                  onChange={(e: SelectChangeEvent<AdHocReportModel>) => rb.setModel(e.target.value as AdHocReportModel)}
                >
                  {AD_HOC_REPORT_MODELS.map((m) => (
                    <MenuItem key={m} value={m}>
                      {getLlmModelVariantLabel(AD_HOC_REPORT_LLM_MODELS[m])}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            )}

            {(rb.schema || rb.plan) && (
              <Button
                variant="contained"
                onClick={() => void rb.handleFetch()}
                disabled={rb.loading || rb.generating || !rb.oystehrZambda}
              >
                {rb.loading ? <CircularProgress size={20} /> : 'Refresh data'}
              </Button>
            )}
          </Box>

          {rb.error && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {rb.error}
            </Alert>
          )}

          {rb.canCreate && (
            <>
              <Typography variant="subtitle1" sx={{ mb: 1 }}>
                Describe the report you want
              </Typography>
              <TextField
                multiline
                minRows={2}
                fullWidth
                placeholder="e.g. Bar chart of visits per provider; or visits last month with a fever, with the diagnosis"
                value={rb.request}
                onChange={(e) => rb.setRequest(e.target.value)}
                sx={{ mb: 1 }}
              />
              {/* No separate refinement: editing the request above and regenerating IS the refinement. */}
              <Box sx={{ mb: 2, display: 'flex', gap: 1 }}>
                <Button
                  variant="contained"
                  onClick={rb.handleGenerate}
                  disabled={rb.generating || rb.loading || !rb.request.trim() || !rb.oystehrZambda}
                >
                  {rb.generating || rb.loading ? (
                    <CircularProgress size={20} />
                  ) : rb.generatedCode ? (
                    'Regenerate report'
                  ) : (
                    'Generate report'
                  )}
                </Button>
                {rb.generatedCode && (
                  <Button variant="outlined" onClick={rb.handleReset} disabled={rb.generating || rb.loading}>
                    Reset
                  </Button>
                )}
              </Box>
            </>
          )}

          {rb.generateError && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {rb.generateError}
            </Alert>
          )}

          {rb.unavailableRequest && (
            <Paper variant="outlined" sx={{ mb: 3, p: 2, borderColor: 'error.main' }}>
              <Typography color="error" variant="subtitle1" fontWeight={600} sx={{ mb: 1 }}>
                This report can&apos;t be built from the available data
              </Typography>
              <Typography variant="body2" sx={{ mb: 1 }}>
                Not found in any dataset: <strong>{rb.unavailableRequest.concepts.join(', ')}</strong>
              </Typography>
              {rb.unavailableRequest.hint && (
                <Typography variant="body2" sx={{ mb: 2, fontStyle: 'italic' }}>
                  {rb.unavailableRequest.hint}
                </Typography>
              )}
              <Typography variant="subtitle2" sx={{ mb: 0.5 }}>
                What you can do
              </Typography>
              <Box component="ul" sx={{ mt: 0, mb: 2, pl: 3 }}>
                <Typography component="li" variant="body2">
                  Remove {rb.unavailableRequest.concepts.length > 1 ? 'those parts' : 'that part'} from your request and
                  generate the rest.
                </Typography>
                <Typography component="li" variant="body2">
                  If you meant a different field, use its exact name from the list below.
                </Typography>
              </Box>
              <Typography variant="subtitle2" sx={{ mb: 1 }}>
                What the datasets do contain
              </Typography>
              <AllDatasetsInfo />
            </Paper>
          )}

          {rb.multiDatasetRequest && (
            <Paper variant="outlined" sx={{ mb: 3, p: 2, borderColor: 'warning.main' }}>
              <Typography color="warning.dark" variant="subtitle1" fontWeight={600} sx={{ mb: 1 }}>
                This request combines data from separate datasets
              </Typography>
              <Typography variant="body2" sx={{ mb: 1 }}>
                Reports are currently built from one dataset at a time. Your request needs:{' '}
                <strong>{rb.multiDatasetRequest.datasets.join(', ')}</strong>
              </Typography>
              {rb.multiDatasetRequest.hint && (
                <Typography variant="body2" sx={{ mb: 1, fontStyle: 'italic' }}>
                  {rb.multiDatasetRequest.hint}
                </Typography>
              )}
              <Typography variant="body2" sx={{ mb: 2 }}>
                Split it into separate reports, one per dataset.
              </Typography>
              <Typography variant="subtitle2" sx={{ mb: 1 }}>
                What the datasets contain
              </Typography>
              <AllDatasetsInfo />
            </Paper>
          )}

          {hasDatasetData && rb.schema && rb.rows && (
            <>
              <Box sx={{ mb: 1, display: 'flex', alignItems: 'center', gap: 1 }}>
                <Typography variant="subtitle1">
                  Data: <strong>{rb.schema.label}</strong> · <strong>{rb.rows.length.toLocaleString()}</strong> rows ·
                  schema: <strong>{rb.schema.fields.length}</strong> fields
                </Typography>
                <Button size="small" onClick={() => rb.setShowSchema(!rb.showSchema)}>
                  {rb.showSchema ? 'Hide schema' : 'Show schema'}
                </Button>
                <Button size="small" onClick={() => setShowRawData(!showRawData)}>
                  {showRawData ? 'Hide response data' : 'Show response data'}
                </Button>
              </Box>

              <Collapse in={showRawData} unmountOnExit>
                <RawDataGrid
                  key={rb.schema.datasetId}
                  rows={rb.rows}
                  schema={rb.schema}
                  loading={rb.loading}
                  fileName={`${rb.schema.label.toLowerCase().replace(/[^\w.-]+/g, '-')}-raw-data`}
                />
              </Collapse>

              <Collapse in={rb.showSchema} unmountOnExit>
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
                      {rb.schema.fields.map((f) => (
                        <TableRow key={f.name}>
                          <TableCell sx={{ fontFamily: 'monospace' }}>{f.name}</TableCell>
                          <TableCell>{f.type}</TableCell>
                          <TableCell>{f.description}</TableCell>
                          <TableCell sx={{ fontSize: '0.75rem', color: 'text.secondary' }}>
                            {f.values
                              ? `${f.values.length} values: ${f.values.slice(0, 8).join(', ')}${
                                  f.values.length > 8 ? '…' : ''
                                }`
                              : '(free value)'}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                  <DatasetLayersInfo schema={rb.schema} />
                </Paper>
              </Collapse>
            </>
          )}

          {hasPlanData && rb.fetchStats && (
            <>
              <Box sx={{ mb: 1, display: 'flex', alignItems: 'center', gap: 1 }}>
                <Typography variant="subtitle1">
                  Data: <strong>{rb.fetchStats.length}</strong> {rb.fetchStats.length === 1 ? 'search' : 'searches'} ·{' '}
                  <strong>{totalResources.toLocaleString()}</strong> records · <strong>{fetchSeconds}</strong> s
                </Typography>
                <Button size="small" onClick={() => rb.setShowSchema(!rb.showSchema)}>
                  {rb.showSchema ? 'Hide fetch plan' : 'Show fetch plan'}
                </Button>
              </Box>

              <Collapse in={rb.showSchema} unmountOnExit>
                <Paper variant="outlined" sx={{ mb: 3, overflow: 'auto' }}>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>Step</TableCell>
                        <TableCell>Resource</TableCell>
                        <TableCell>Search</TableCell>
                        <TableCell align="right">Records</TableCell>
                        <TableCell align="right">Time</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {rb.fetchStats.map((step) => (
                        <TableRow key={step.id}>
                          <TableCell sx={{ fontFamily: 'monospace' }}>{step.id}</TableCell>
                          <TableCell>{step.resourceType}</TableCell>
                          <TableCell sx={{ fontFamily: 'monospace', fontSize: '0.75rem', wordBreak: 'break-all' }}>
                            {step.error
                              ? `Failed: ${step.error}`
                              : step.params.map((p) => `${p.name}=${p.value}`).join('&')}
                          </TableCell>
                          <TableCell align="right">{step.count.toLocaleString()}</TableCell>
                          <TableCell align="right">{(step.ms / 1000).toFixed(1)} s</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </Paper>
              </Collapse>
            </>
          )}

          {(hasDatasetData || hasPlanData) && rb.generatedCode && (
            <>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                <Typography variant="h3" component="h2" sx={{ flexGrow: 1, fontWeight: 700 }}>
                  {rb.generatedTitle ?? 'Generated report'}
                </Typography>
                <Button size="small" onClick={() => rb.setShowCode(!rb.showCode)}>
                  {rb.showCode ? 'Hide generated code' : 'View generated code'}
                </Button>
                {rb.canCreate && (
                  <Button size="small" variant="outlined" startIcon={<SaveIcon />} onClick={rb.openSaveDialog}>
                    {rb.loadedSavedId ? 'Save' : 'Save report'}
                  </Button>
                )}
              </Box>

              <Collapse in={rb.showCode} unmountOnExit>
                <Paper variant="outlined" sx={{ mb: 2, p: 2, maxHeight: 400, overflow: 'auto', bgcolor: 'grey.50' }}>
                  <Box
                    component="pre"
                    sx={{
                      m: 0,
                      fontSize: '0.75rem',
                      fontFamily: 'monospace',
                      whiteSpace: 'pre-wrap',
                      wordBreak: 'break-word',
                    }}
                  >
                    {rb.generatedCode}
                  </Box>
                </Paper>
              </Collapse>

              {rb.loadingLayers.length > 0 && (
                <Alert severity="info" icon={<CircularProgress size={18} />} sx={{ mb: 2 }}>
                  This report is incomplete — it needs {rb.loadingLayers.join(', ')} data that was not loaded. Loading
                  it and rebuilding the report…
                </Alert>
              )}

              {rb.renderError && (
                <Alert severity="warning" sx={{ mb: 2 }}>
                  The report failed to run: {rb.renderError}.{' '}
                  {rb.canCreate ? 'Adjust your request and regenerate.' : 'Ask an administrator to rebuild it.'}
                </Alert>
              )}

              <Box
                sx={{
                  mb: 1,
                  p: 1.5,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 1.25,
                  bgcolor: '#fde5e7',
                  border: '1px solid #ff6c6c',
                  borderRadius: 1,
                }}
              >
                <Box
                  component="span"
                  sx={{
                    px: 0.75,
                    py: 0.25,
                    borderRadius: 0.75,
                    bgcolor: '#ff6c6c',
                    color: 'common.white',
                    fontWeight: 900,
                    fontSize: '0.9rem',
                    letterSpacing: '0.05em',
                    flexShrink: 0,
                  }}
                >
                  AI
                </Box>
                <Typography variant="body2" sx={{ color: 'common.black', fontSize: '0.9rem', fontWeight: 500 }}>
                  This is a beta feature. The report is generated by AI and can be incomplete or wrong. Check the
                  results against the source data before acting on them.
                </Typography>
              </Box>

              {/* The model's code runs here, sandboxed, over the fetched rows or resources. */}
              {hasPlanData && rb.resources && rb.planParams ? (
                <ReportFrame
                  code={rb.generatedCode}
                  resources={rb.resources}
                  params={rb.planParams}
                  onError={rb.handleRenderError}
                  onRendered={rb.handleRendered}
                />
              ) : (
                rb.rows &&
                rb.schema && (
                  <ReportFrame
                    code={rb.generatedCode}
                    data={rb.rows}
                    schema={rb.schema}
                    onError={rb.handleRenderError}
                    onRendered={rb.handleRendered}
                  />
                )
              )}
            </>
          )}
        </Box>

        <Dialog open={rb.saveDialogOpen} onClose={() => rb.setSaveDialogOpen(false)} fullWidth maxWidth="xs">
          <DialogTitle>Save report</DialogTitle>
          <DialogContent>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              This saves what the report fetches, its date-range setting, and the view — not the data. Opening it later
              re-fetches fresh data and re-renders this report. It appears as a tile under Saved reports for everyone
              with report access.
            </Typography>
            <TextField
              autoFocus
              fullWidth
              size="small"
              label="Report name"
              value={rb.savedName}
              onChange={(e) => rb.setSavedName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && rb.savedName.trim() && !rb.saving) {
                  e.preventDefault();
                  void rb.handleSave(rb.loadedSavedId ? 'update' : 'new');
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
              value={rb.savedDescription}
              onChange={(e) => rb.setSavedDescription(e.target.value)}
              sx={{ mt: 2 }}
            />
          </DialogContent>
          <DialogActions>
            <Button onClick={() => rb.setSaveDialogOpen(false)} disabled={rb.saving}>
              Cancel
            </Button>
            {rb.loadedSavedId && (
              <Button onClick={() => void rb.handleSave('new')} disabled={rb.saving || !rb.savedName.trim()}>
                Save as new
              </Button>
            )}
            <Button
              variant="contained"
              onClick={() => void rb.handleSave(rb.loadedSavedId ? 'update' : 'new')}
              disabled={rb.saving || !rb.savedName.trim()}
            >
              {rb.saving ? <CircularProgress size={18} /> : rb.loadedSavedId ? 'Update' : 'Save'}
            </Button>
          </DialogActions>
        </Dialog>
      </>
    </PageContainer>
  );
}
