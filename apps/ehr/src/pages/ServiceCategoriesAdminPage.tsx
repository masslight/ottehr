import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import EditIcon from '@mui/icons-material/Edit';
import {
  Box,
  Button,
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
import { FC, useCallback, useEffect, useState } from 'react';
import {
  createServiceCategory,
  deleteServiceCategory,
  listServiceCategories,
  ServiceCategoryRecord,
  updateServiceCategory,
} from '../api/api';
import { useApiClients } from '../hooks/useAppClients';

const QUERY_KEY = ['service-categories'];

const DEFAULT_NEW_SERVICE_CATEGORY: ServiceCategoryRecord = {
  name: '',
  code: '',
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
  initial?: ServiceCategoryRecord;
  onClose: () => void;
  onSubmit: (value: ServiceCategoryRecord) => Promise<void>;
}> = ({ open, initial, onClose, onSubmit }) => {
  const [value, setValue] = useState<ServiceCategoryRecord>(initial || DEFAULT_NEW_SERVICE_CATEGORY);
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

  const handleSave = useCallback(async () => {
    const missing: string[] = [];
    if (!value.name.trim()) missing.push('name');
    if (!value.code.trim()) missing.push('code');
    if (value.config.durationMinutes < 1) missing.push('duration');
    if (missing.length > 0) {
      enqueueSnackbar(`Missing required field(s): ${missing.join(', ')}`, { variant: 'warning' });
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
  }, [onSubmit, value, reasonsText]);

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>{initial?.id ? 'Edit Service Category' : 'New Service Category'}</DialogTitle>
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
            helperText="URL-safe identifier — e.g., 'urgent-care', 'workers-comp'"
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
            helperText={value.config.durationMinutes < 1 ? 'Must be at least 1 minute' : ' '}
            size="small"
            fullWidth
          />
          <FormControl size="small" fullWidth>
            <InputLabel>Cadence (start interval)</InputLabel>
            <Select
              value={value.config.cadenceMinutes ?? ''}
              input={<OutlinedInput label="Cadence (start interval)" />}
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
              renderValue={(selected) => (selected === '' ? 'Default (15 min)' : `${selected} min`)}
              displayEmpty
            >
              <MenuItem value="">Default (15 min)</MenuItem>
              <MenuItem value={15}>15 min</MenuItem>
              <MenuItem value={30}>30 min</MenuItem>
              <MenuItem value={60}>60 min</MenuItem>
            </Select>
          </FormControl>
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
              renderValue={(selected) => (selected as string[]).join(', ')}
            >
              <MenuItem value="in-person">In-Person</MenuItem>
              <MenuItem value="virtual">Virtual</MenuItem>
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
              renderValue={(selected) => (selected as string[]).join(', ')}
            >
              <MenuItem value="prebook">Prebook</MenuItem>
              <MenuItem value="walk-in">Walk-in</MenuItem>
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
          disabled={saving}
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
  const [editing, setEditing] = useState<ServiceCategoryRecord | undefined>(undefined);

  const { data, isLoading } = useQuery({
    queryKey: QUERY_KEY,
    queryFn: async () => {
      if (!oystehrZambda) return { serviceCategories: [] as ServiceCategoryRecord[] };
      return await listServiceCategories(oystehrZambda);
    },
    enabled: !!oystehrZambda,
  });

  const handleSubmit = useCallback(
    async (value: ServiceCategoryRecord) => {
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
        enqueueSnackbar('Failed to save service category', { variant: 'error' });
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

  const serviceCategories = data?.serviceCategories || [];

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
        <Typography variant="h5">Service Categories</Typography>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => {
            setEditing(undefined);
            setDialogOpen(true);
          }}
        >
          New Service Category
        </Button>
      </Box>

      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Service categories define the bookable appointment categories a patient can choose — each with its own duration,
        service modes, and reasons for visit. Managed here as FHIR <code>HealthcareService</code> resources. When no
        categories have been created here, the system falls back to the deployment's compiled-in{' '}
        <code>BOOKING_CONFIG.SERVICE_CATEGORIES_AVAILABLE</code>.
      </Typography>

      {isLoading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
          <CircularProgress />
        </Box>
      ) : serviceCategories.length === 0 ? (
        <Paper sx={{ p: 4, textAlign: 'center' }}>
          <Typography variant="body1" color="text.secondary">
            No service categories defined in FHIR yet. Click "New Service Category" to create one, or rely on the
            deployment's default <code>BOOKING_CONFIG</code> until you're ready to manage these at runtime.
          </Typography>
        </Paper>
      ) : (
        <TableContainer component={Paper}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell sx={{ fontWeight: 600 }}>Name</TableCell>
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
                  sx={{ cursor: 'pointer' }}
                  onClick={() => {
                    setEditing(sc);
                    setDialogOpen(true);
                  }}
                >
                  <TableCell>{sc.name}</TableCell>
                  <TableCell sx={{ fontFamily: 'monospace' }}>{sc.code}</TableCell>
                  <TableCell align="center">{sc.config.durationMinutes} min</TableCell>
                  <TableCell align="center">
                    {sc.config.cadenceMinutes ? `${sc.config.cadenceMinutes} min` : 'default'}
                  </TableCell>
                  <TableCell>
                    {sc.config.serviceModes.map((m) => (
                      <Chip key={m} label={m} size="small" sx={{ mr: 0.5 }} />
                    ))}
                  </TableCell>
                  <TableCell>
                    {sc.config.visitTypes.map((t) => (
                      <Chip key={t} label={t} size="small" sx={{ mr: 0.5 }} />
                    ))}
                  </TableCell>
                  <TableCell align="center">
                    <Chip
                      label={sc.active ? 'active' : 'inactive'}
                      size="small"
                      color={sc.active ? 'success' : 'default'}
                    />
                  </TableCell>
                  <TableCell align="right" onClick={(e) => e.stopPropagation()}>
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
    </Box>
  );
};

export default ServiceCategoriesAdminPage;
