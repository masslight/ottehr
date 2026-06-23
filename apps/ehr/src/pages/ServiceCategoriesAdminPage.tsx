import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import EditIcon from '@mui/icons-material/Edit';
import {
  Box,
  Button,
  Checkbox,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  FormControlLabel,
  IconButton,
  InputLabel,
  ListItemText,
  MenuItem,
  OutlinedInput,
  Paper,
  Select,
  Switch,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { enqueueSnackbar } from 'notistack';
import { FC, useCallback, useEffect, useMemo, useState } from 'react';
import { BOOKING_CONFIG, getDefaultCadenceMinutes, makeAbbreviation } from 'utils';
import {
  createServiceCategory,
  deleteServiceCategory,
  listServiceCategories,
  ServiceCategory,
  updateServiceCategory,
} from '../api/api';
import { useApiClients } from '../hooks/useAppClients';

const QUERY_KEY = ['service-categories'];

/** Set of service codes that are defined in the compiled-in BOOKING_CONFIG.
 *  These are non-overridable from this UI; preventing creation of colliding
 *  codes here avoids the "saved but does nothing" failure mode. */
const COMPILED_SERVICE_CODES: ReadonlySet<string> = new Set(
  BOOKING_CONFIG.serviceCategories.map((sc) => sc.category.code).filter((c): c is string => !!c)
);

const DEFAULT_NEW_SERVICE_CATEGORY: ServiceCategory = {
  name: '',
  code: '',
  abbreviation: '',
  active: true,
  config: {
    durationMinutes: 15,
    serviceModes: ['in-person'],
    visitTypes: ['prebook'],
    reasonsForVisit: [],
  },
};

const ServiceCategoryDialog: FC<{
  open: boolean;
  initial?: ServiceCategory;
  onClose: () => void;
  onSubmit: (value: ServiceCategory) => Promise<void>;
}> = ({ open, initial, onClose, onSubmit }) => {
  const [value, setValue] = useState<ServiceCategory>(initial || DEFAULT_NEW_SERVICE_CATEGORY);
  // Keep the reasons textarea as raw text while the user is editing so partial
  // whitespace (e.g. typing "back pain") isn't stripped on every keystroke.
  // Parse to the structured array only on save.
  const [reasonsText, setReasonsText] = useState<string>('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      const seed = initial || DEFAULT_NEW_SERVICE_CATEGORY;
      setValue(seed);
      setReasonsText((seed.config.reasonsForVisit || []).map((r) => r.label).join('\n'));
    }
  }, [open, initial]);

  const codeIsTaken = useMemo(() => !!value.code.trim() && COMPILED_SERVICE_CODES.has(value.code.trim()), [value.code]);

  const handleSave = useCallback(async () => {
    const missing: string[] = [];
    if (!value.name.trim()) missing.push('name');
    if (!value.abbreviation?.trim()) missing.push('abbreviation');
    if (!value.code.trim()) missing.push('code');
    if (value.config.durationMinutes < 1) missing.push('duration');
    if (missing.length > 0) {
      enqueueSnackbar(`Missing required field(s): ${missing.join(', ')}`, { variant: 'warning' });
      return;
    }
    if (codeIsTaken) {
      enqueueSnackbar(`A service with the code "${value.code}" already exists. Choose a different code.`, {
        variant: 'warning',
      });
      return;
    }
    setSaving(true);
    try {
      const reasons = reasonsText
        .split('\n')
        .map((l) => l.trim())
        .filter(Boolean)
        .map((label) => ({ label, value: label }));
      await onSubmit({
        ...value,
        config: { ...value.config, reasonsForVisit: reasons },
      });
    } finally {
      setSaving(false);
    }
  }, [onSubmit, value, reasonsText, codeIsTaken]);

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>
        <Typography variant="h4" color="primary.dark">
          {initial?.id ? 'Edit Service' : 'New Service'}
        </Typography>
      </DialogTitle>
      <DialogContent>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
          <TextField
            label="Display Name"
            value={value.name}
            onChange={(e) => setValue((v) => ({ ...v, name: e.target.value }))}
            required
            size="small"
            fullWidth
            helperText="Shown to patients — e.g., 'Urgent Care', 'Workers Comp'"
          />
          <TextField
            label="Abbreviation/Short Name (2-3 symbols)"
            value={value.abbreviation ?? ''}
            onChange={(e) => setValue((v) => ({ ...v, abbreviation: e.target.value }))}
            required
            size="small"
            fullWidth
            error={!value.abbreviation?.trim()}
            helperText="Shown on the Tracking Board and patients' visits list - e.g., 'UC', 'WC'"
          />
          <TextField
            label="Code"
            value={value.code}
            onChange={(e) =>
              setValue((v) => ({
                ...v,
                code: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-'),
              }))
            }
            required
            size="small"
            fullWidth
            error={codeIsTaken}
            helperText={
              codeIsTaken
                ? `A service with the code "${value.code}" already exists. Choose a different code.`
                : "URL-safe identifier — e.g., 'urgent-care', 'workers-comp'"
            }
          />
          <TextField
            label="Duration (minutes)"
            type="number"
            value={value.config.durationMinutes === 0 ? '' : value.config.durationMinutes}
            onChange={(e) => {
              const raw = e.target.value;
              const n = parseInt(raw, 10);
              setValue((v) => ({
                ...v,
                config: { ...v.config, durationMinutes: isNaN(n) ? 0 : n },
              }));
            }}
            error={value.config.durationMinutes < 1}
            helperText={value.config.durationMinutes < 1 ? 'Must be at least 1 minute' : undefined}
            size="small"
            fullWidth
          />
          {(() => {
            // The slot generator's no-explicit-cadence fallback depends on
            // duration — shared helper so the picker's "Default (X min)"
            // label always matches what the admin will actually get.
            const defaultLabel = `Default (${getDefaultCadenceMinutes(value.config.durationMinutes)} min)`;
            return (
              <FormControl size="small" fullWidth>
                <InputLabel shrink>Cadence (start interval)</InputLabel>
                <Select
                  value={value.config.cadenceMinutes ?? ''}
                  input={<OutlinedInput notched label="Cadence (start interval)" />}
                  onChange={(e) => {
                    const raw = e.target.value;
                    const parsed = raw === '' ? undefined : Number(raw);
                    setValue((v) => ({
                      ...v,
                      config: {
                        ...v.config,
                        cadenceMinutes: parsed === undefined || Number.isNaN(parsed) ? undefined : parsed,
                      },
                    }));
                  }}
                  renderValue={(selected) => (selected ? `${selected as number} min` : defaultLabel)}
                  displayEmpty
                >
                  <MenuItem value="">{defaultLabel}</MenuItem>
                  <MenuItem value={15}>15 min</MenuItem>
                  <MenuItem value={30}>30 min</MenuItem>
                  <MenuItem value={60}>60 min</MenuItem>
                </Select>
              </FormControl>
            );
          })()}
          <FormControl size="small" fullWidth>
            <InputLabel>Service Modes</InputLabel>
            <Select
              multiple
              value={value.config.serviceModes}
              input={<OutlinedInput label="Service Modes" />}
              onChange={(e) =>
                setValue((v) => ({
                  ...v,
                  config: {
                    ...v.config,
                    serviceModes: (typeof e.target.value === 'string'
                      ? e.target.value.split(',')
                      : e.target.value) as Array<'in-person' | 'virtual'>,
                  },
                }))
              }
              renderValue={(selected) =>
                (selected as string[]).map((s) => (s === 'in-person' ? 'In-Person' : 'Virtual')).join(', ')
              }
            >
              <MenuItem value="in-person">
                <Checkbox checked={value.config.serviceModes.includes('in-person')} />
                <ListItemText primary="In-Person" />
              </MenuItem>
              <MenuItem value="virtual">
                <Checkbox checked={value.config.serviceModes.includes('virtual')} />
                <ListItemText primary="Virtual" />
              </MenuItem>
            </Select>
          </FormControl>
          <FormControl size="small" fullWidth>
            <InputLabel>Booking Flows</InputLabel>
            <Select
              multiple
              value={value.config.visitTypes}
              input={<OutlinedInput label="Booking Flows" />}
              onChange={(e) =>
                setValue((v) => ({
                  ...v,
                  config: {
                    ...v.config,
                    visitTypes: (typeof e.target.value === 'string'
                      ? e.target.value.split(',')
                      : e.target.value) as Array<'prebook' | 'walk-in'>,
                  },
                }))
              }
              renderValue={(selected) =>
                (selected as string[]).map((s) => (s === 'prebook' ? 'Prebook' : 'Walk-in')).join(', ')
              }
            >
              <MenuItem value="prebook">
                <Checkbox checked={value.config.visitTypes.includes('prebook')} />
                <ListItemText primary="Prebook" />
              </MenuItem>
              <MenuItem value="walk-in">
                <Checkbox checked={value.config.visitTypes.includes('walk-in')} />
                <ListItemText primary="Walk-in" />
              </MenuItem>
            </Select>
          </FormControl>
          <TextField
            label="Reasons for Visit"
            multiline
            minRows={4}
            value={reasonsText}
            onChange={(e) => setReasonsText(e.target.value)}
            size="small"
            fullWidth
            helperText="One reason per line. Shown to patient during booking."
          />
          <FormControlLabel
            control={
              <Switch checked={value.active} onChange={(e) => setValue((v) => ({ ...v, active: e.target.checked }))} />
            }
            label={value.active ? 'Active' : 'Inactive'}
          />
        </Box>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose} disabled={saving}>
          Cancel
        </Button>
        <Button
          variant="contained"
          onClick={handleSave}
          disabled={saving || codeIsTaken}
          startIcon={saving ? <CircularProgress size={16} /> : null}
        >
          Save
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export const ServiceCategoriesAdminPage: FC = () => {
  const { oystehrZambda } = useApiClients();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<ServiceCategory | undefined>(undefined);

  const { data, isLoading } = useQuery({
    queryKey: QUERY_KEY,
    queryFn: async () => {
      if (!oystehrZambda) return { serviceCategories: [] as ServiceCategory[] };
      return await listServiceCategories(oystehrZambda);
    },
    enabled: !!oystehrZambda,
  });

  const handleSubmit = useCallback(
    async (value: ServiceCategory) => {
      if (!oystehrZambda) return;
      try {
        if (value.id) {
          await updateServiceCategory(oystehrZambda, value);
          enqueueSnackbar('Service category updated', { variant: 'success' });
        } else {
          await createServiceCategory(oystehrZambda, value);
          enqueueSnackbar('Service category created', { variant: 'success' });
        }
        void queryClient.invalidateQueries({ queryKey: QUERY_KEY });
        setDialogOpen(false);
        setEditing(undefined);
      } catch (err) {
        console.error('Failed to save service category:', err);
        // Try to surface a friendly message from the server (e.g. the
        // SERVICE_CATEGORY_CODE_TAKEN response). The Oystehr SDK throws on
        // non-2xx with the response body attached in various shapes; check
        // the common ones before falling back to the generic message.
        const friendly = (err as any)?.response?.data?.message ?? (err as any)?.body?.message ?? (err as any)?.message;
        const isCodeTakenError = typeof friendly === 'string' && friendly.startsWith('A service with the code');
        enqueueSnackbar(isCodeTakenError ? friendly : 'Failed to save service category', { variant: 'error' });
      }
    },
    [oystehrZambda, queryClient]
  );

  const handleDeactivate = useCallback(
    async (id: string) => {
      if (!oystehrZambda) return;
      if (!window.confirm('Deactivate this service category? Existing appointments stay intact; new bookings stop.'))
        return;
      try {
        await deleteServiceCategory(oystehrZambda, id);
        void queryClient.invalidateQueries({ queryKey: QUERY_KEY });
        enqueueSnackbar('Service category deactivated', { variant: 'success' });
      } catch (err) {
        console.error('Failed to deactivate service category:', err);
        enqueueSnackbar('Failed to deactivate service category', { variant: 'error' });
      }
    },
    [oystehrZambda, queryClient]
  );

  // The FHIR registry returns admin-managed categories. Merge in the
  // compiled-in BOOKING_CONFIG entries so the admin can see *every* service
  // that's bookable in the system, not just the ones they can edit. System
  // rows are flagged so the table can render them read-only.
  const serviceCategories = useMemo<Array<ServiceCategory & { systemManaged?: boolean }>>(() => {
    const fhirRows = data?.serviceCategories || [];
    const fhirCodes = new Set(fhirRows.map((sc) => sc.code));
    const systemRows: Array<ServiceCategory & { systemManaged: boolean }> = BOOKING_CONFIG.serviceCategories
      .filter((sc) => sc.category.code && !fhirCodes.has(sc.category.code))
      .map((sc) => ({
        name: sc.category.display ?? sc.category.code ?? '',
        code: sc.category.code ?? '',
        active: true,
        config: {
          durationMinutes: 0,
          serviceModes: sc.serviceModes,
          visitTypes: sc.visitTypes,
          reasonsForVisit: sc.reasonsForVisit?.default ?? [],
        },
        systemManaged: true,
      }));
    return [...fhirRows, ...systemRows].sort((a, b) => a.name.localeCompare(b.name));
  }, [data?.serviceCategories]);

  return (
    <Paper sx={{ padding: 2, marginTop: 2 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: '8px' }}>
        <Typography variant="h4" color="primary.dark">
          Services
        </Typography>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => {
            setEditing(undefined);
            setDialogOpen(true);
          }}
        >
          New Service
        </Button>
      </Box>

      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Services are the appointment types patients can book. Add a service here, then attach it to a provider's
        schedule from their employee page or to a group from the group admin page.
      </Typography>

      {isLoading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
          <CircularProgress />
        </Box>
      ) : serviceCategories.length === 0 ? (
        <Paper sx={{ p: 4, textAlign: 'center' }}>
          <Typography variant="body1" color="text.secondary">
            No services defined in FHIR yet. Click "New Service" to create one, or rely on the deployment's default{' '}
            <code>BOOKING_CONFIG</code> until you're ready to manage these at runtime.
          </Typography>
        </Paper>
      ) : (
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell sx={{ fontWeight: 600 }}>Name</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>Abbreviation</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>Code</TableCell>
                <TableCell sx={{ fontWeight: 600 }} align="center">
                  Duration
                </TableCell>
                <TableCell sx={{ fontWeight: 600 }} align="center">
                  Cadence
                </TableCell>
                <TableCell sx={{ fontWeight: 600 }}>Service Modes</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>Booking Flows</TableCell>
                <TableCell sx={{ fontWeight: 600 }} align="center">
                  Status
                </TableCell>
                <TableCell sx={{ fontWeight: 600 }} align="right">
                  Actions
                </TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {serviceCategories.map((sc) => (
                <TableRow
                  key={sc.id || sc.code}
                  hover
                  sx={{ cursor: sc.systemManaged ? 'default' : 'pointer' }}
                  onClick={() => {
                    if (sc.systemManaged) return;
                    setEditing(sc);
                    setDialogOpen(true);
                  }}
                >
                  <TableCell>{sc.name}</TableCell>
                  <TableCell>{sc.abbreviation?.trim() || makeAbbreviation(sc.name)}</TableCell>
                  <TableCell sx={{ fontFamily: 'monospace' }}>{sc.code}</TableCell>
                  <TableCell align="center">{sc.systemManaged ? '—' : `${sc.config.durationMinutes} min`}</TableCell>
                  <TableCell align="center">
                    {sc.systemManaged ? '—' : sc.config.cadenceMinutes ? `${sc.config.cadenceMinutes} min` : 'default'}
                  </TableCell>
                  <TableCell>
                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                      {sc.config.serviceModes.map((m) => (
                        <Chip key={m} label={m} size="small" sx={{ textTransform: 'capitalize' }} />
                      ))}
                    </Box>
                  </TableCell>
                  <TableCell>
                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                      {sc.config.visitTypes.map((t) => (
                        <Chip key={t} label={t} size="small" sx={{ textTransform: 'capitalize' }} />
                      ))}
                    </Box>
                  </TableCell>
                  <TableCell align="center">
                    {sc.systemManaged ? (
                      <Tooltip title="Defined in compiled config; not editable from this page.">
                        <Chip label="System" size="small" />
                      </Tooltip>
                    ) : (
                      <Chip
                        label={sc.active ? 'Active' : 'Inactive'}
                        size="small"
                        color={sc.active ? 'success' : 'error'}
                      />
                    )}
                  </TableCell>
                  <TableCell align="right" onClick={(e) => e.stopPropagation()}>
                    {!sc.systemManaged && (
                      <>
                        <Tooltip title="Edit">
                          <IconButton
                            size="small"
                            onClick={() => {
                              setEditing(sc);
                              setDialogOpen(true);
                            }}
                          >
                            <EditIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                        {sc.active && (
                          <Tooltip title="Deactivate">
                            <IconButton size="small" color="error" onClick={() => sc.id && handleDeactivate(sc.id)}>
                              <DeleteIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        )}
                      </>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      <ServiceCategoryDialog
        open={dialogOpen}
        initial={editing}
        onClose={() => {
          setDialogOpen(false);
          setEditing(undefined);
        }}
        onSubmit={handleSubmit}
      />
    </Paper>
  );
};

export default ServiceCategoriesAdminPage;
