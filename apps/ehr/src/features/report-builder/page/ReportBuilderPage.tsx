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
import React from 'react';
import { useNavigate } from 'react-router-dom';
import { AdHocDateRangeFilter } from 'utils/lib/types/adhoc/query/date-range';
import PageContainer from '../../../layout/PageContainer';
import { AD_HOC_DATASETS } from '../datasets/registry';
import { ReportFrame } from '../sandbox/ReportFrame';
import { AllDatasetsInfo, DatasetLayersInfo } from './DatasetLayersInfo';
import { useReportBuilder } from './useReportBuilder';

export default function ReportBuilderPage(): React.ReactElement {
  const navigate = useNavigate();
  const rb = useReportBuilder();

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
            <FormControl size="small" sx={{ minWidth: 180 }}>
              <InputLabel>Dataset</InputLabel>
              <Select
                value={rb.datasetId}
                label="Dataset"
                onChange={(e: SelectChangeEvent) => rb.onDatasetChange(e.target.value)}
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
                value={rb.dateRange}
                label="Date Range"
                onChange={(e: SelectChangeEvent<AdHocDateRangeFilter>) =>
                  rb.setDateRange(e.target.value as AdHocDateRangeFilter)
                }
              >
                <MenuItem value="today">Today</MenuItem>
                <MenuItem value="yesterday">Yesterday</MenuItem>
                <MenuItem value="last-7-days">Last 7 Days</MenuItem>
                <MenuItem value="last-30-days">Last 30 Days</MenuItem>
                <MenuItem value="custom">Custom Date</MenuItem>
                <MenuItem value="customRange">Custom Date Range</MenuItem>
              </Select>
            </FormControl>

            {rb.dateRange === 'custom' && (
              <TextField
                type="date"
                size="small"
                value={rb.customDate}
                onChange={(e) => rb.setCustomDate(e.target.value)}
                sx={{ minWidth: 160 }}
                InputLabelProps={{ shrink: true }}
              />
            )}
            {rb.dateRange === 'customRange' && (
              <>
                <TextField
                  type="date"
                  size="small"
                  label="Start"
                  value={rb.customStartDate}
                  onChange={(e) => rb.setCustomStartDate(e.target.value)}
                  sx={{ minWidth: 160 }}
                  InputLabelProps={{ shrink: true }}
                />
                <TextField
                  type="date"
                  size="small"
                  label="End"
                  value={rb.customEndDate}
                  onChange={(e) => rb.setCustomEndDate(e.target.value)}
                  sx={{ minWidth: 160 }}
                  InputLabelProps={{ shrink: true }}
                />
              </>
            )}

            <Button
              variant="contained"
              onClick={() => void rb.handleFetch()}
              disabled={rb.loading || !rb.oystehrZambda}
            >
              {rb.loading ? <CircularProgress size={20} /> : 'Fetch data'}
            </Button>
          </Box>

          {rb.error && (
            <Box sx={{ mb: 2, p: 2, bgcolor: 'error.light', borderRadius: 1 }}>
              <Typography color="error">{rb.error}</Typography>
            </Box>
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
                placeholder="e.g. Bar chart of visits per provider; or average time from check-in to exam room by location"
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
            <Box sx={{ mb: 2, p: 2, bgcolor: 'error.light', borderRadius: 1 }}>
              <Typography color="error">{rb.generateError}</Typography>
            </Box>
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
                <Typography component="li" variant="body2">
                  Another dataset may hold what you need — check the list below.
                </Typography>
              </Box>
              <Typography variant="subtitle2" sx={{ mb: 1 }}>
                What the datasets do contain
              </Typography>
              <AllDatasetsInfo />
            </Paper>
          )}

          {rb.schema && rb.rows && (
            <>
              <Box sx={{ mb: 1, display: 'flex', alignItems: 'center', gap: 1 }}>
                <Typography variant="subtitle1">
                  Fetched <strong>{rb.rows.length.toLocaleString()}</strong> rows · schema:{' '}
                  <strong>{rb.schema.fields.length}</strong> fields
                </Typography>
                <Button size="small" onClick={() => rb.setShowSchema(!rb.showSchema)}>
                  {rb.showSchema ? 'Hide fields' : 'Show fields'}
                </Button>
              </Box>

              <Collapse in={rb.showSchema}>
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
                  <DatasetLayersInfo datasetId={rb.datasetId} datasetOptions={rb.datasetOptions} />
                </Paper>
              </Collapse>

              {rb.generatedCode && (
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

                  <Collapse in={rb.showCode}>
                    <Paper
                      variant="outlined"
                      sx={{ mb: 2, p: 2, maxHeight: 400, overflow: 'auto', bgcolor: 'grey.50' }}
                    >
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

                  {rb.renderError && (
                    <Box sx={{ mb: 2, p: 2, bgcolor: 'warning.light', borderRadius: 1 }}>
                      <Typography variant="body2">
                        The report failed to run: {rb.renderError}.{' '}
                        {rb.canCreate ? 'Adjust your request and regenerate.' : 'Ask an administrator to rebuild it.'}
                      </Typography>
                    </Box>
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

                  {/* The model's code runs here, sandboxed, over the fetched rows. */}
                  <ReportFrame
                    code={rb.generatedCode}
                    data={rb.rows}
                    schema={rb.schema}
                    onError={rb.handleRenderError}
                    onRendered={rb.handleRendered}
                  />
                </>
              )}
            </>
          )}
        </Box>

        <Dialog open={rb.saveDialogOpen} onClose={() => rb.setSaveDialogOpen(false)} fullWidth maxWidth="xs">
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
