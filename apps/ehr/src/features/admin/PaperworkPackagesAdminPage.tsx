// Admin surface for Practice Paperwork Flows (OTR-2309).
//
// A *paperwork flow* is a reusable bundle of a base intake (standard, resolved
// by visit mode — or consent-only lite) plus an ordered set of practice-managed
// forms. Service categories reference a flow; patients booking a service see
// that service's flow. This page authors flows and assigns them to services.
//
// Backed by the admin-{list,create,update,delete}-paperwork-flow zambdas via
// the api.ts client wrappers; flows persist as FHIR List resources and service
// assignments live on each ServiceCategory HealthcareService.
import AddIcon from '@mui/icons-material/Add';
import CloseIcon from '@mui/icons-material/Close';
import DeleteIcon from '@mui/icons-material/Delete';
import EditIcon from '@mui/icons-material/Edit';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import KeyboardArrowUpIcon from '@mui/icons-material/KeyboardArrowUp';
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
  FormLabel,
  IconButton,
  InputLabel,
  ListItemText,
  MenuItem,
  OutlinedInput,
  Paper,
  Radio,
  RadioGroup,
  Select,
  Stack,
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
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { enqueueSnackbar } from 'notistack';
import { FC, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  createPaperworkFlow,
  deletePaperworkFlow,
  listPaperworkFlows,
  listServiceCategories,
  PaperworkFlowWithServices,
  updatePaperworkFlow,
} from 'src/api/api';
import { useApiClients } from 'src/hooks/useAppClients';
import { PaperworkFlow, PaperworkFlowBase, slugify } from 'utils';
import { useManagedQuestionnaireList } from '../visits/telemed/components/admin/admin.queries';

const FLOWS_QUERY_KEY = ['paperwork-flows'];
// const FORMS_QUERY_KEY = ['paperwork-flows', 'practice-forms'];
const SERVICES_QUERY_KEY = ['paperwork-flows', 'service-categories'];

const BASE_OPTIONS: Array<{ value: PaperworkFlowBase; label: string; helper: string }> = [
  {
    value: 'standard',
    label: 'Standard intake',
    helper: 'Full intake, resolved by visit mode (in-person or virtual).',
  },
  {
    value: 'consent-only',
    label: 'Consent only (lite)',
    helper: 'Just the consent forms — no demographics/insurance intake.',
  },
];

const baseLabel = (b: PaperworkFlowBase): string => BASE_OPTIONS.find((o) => o.value === b)?.label ?? b;

interface FormOption {
  id: string;
  label: string;
}
interface ServiceOption {
  id: string;
  label: string;
}

type DraftFlow = {
  id?: string;
  slug: string;
  name: string;
  base: PaperworkFlowBase;
  formIds: string[];
  serviceIds: string[];
};

const BLANK_DRAFT: DraftFlow = {
  slug: '',
  name: '',
  base: 'consent-only',
  formIds: [],
  serviceIds: [],
};

// ── Edit dialog ──────────────────────────────────────────────────────────────

const FlowDialog: FC<{
  open: boolean;
  initial?: DraftFlow;
  formOptions: FormOption[];
  serviceOptions: ServiceOption[];
  saving: boolean;
  onClose: () => void;
  onSave: (value: DraftFlow) => void;
}> = ({ open, initial, formOptions, serviceOptions, saving, onClose, onSave }) => {
  const [value, setValue] = useState<DraftFlow>(initial ?? BLANK_DRAFT);
  // Track whether the user has hand-edited the slug; until then keep it synced
  // to the name so most flows never need to think about slugs.
  const [slugTouched, setSlugTouched] = useState(!!initial?.id);

  useEffect(() => {
    setValue(initial ?? BLANK_DRAFT);
    setSlugTouched(!!initial?.id);
  }, [initial]);

  const setName = (name: string): void => setValue((v) => ({ ...v, name, slug: slugTouched ? v.slug : slugify(name) }));

  const labelForForm = (id: string): string => formOptions.find((f) => f.id === id)?.label ?? id;
  const labelForService = (id: string): string => serviceOptions.find((s) => s.id === id)?.label ?? id;

  return (
    <Dialog open={open} onClose={saving ? undefined : onClose} fullWidth maxWidth="sm">
      <DialogTitle>{initial?.id ? 'Edit paperwork flow' : 'New paperwork flow'}</DialogTitle>
      <DialogContent>
        <Stack spacing={2.5} sx={{ mt: 1 }}>
          <TextField
            label="Name"
            placeholder="e.g. Massage intake"
            value={value.name}
            onChange={(e) => setName(e.target.value)}
            fullWidth
          />
          <TextField
            label="Slug"
            placeholder="kebab-case, e.g. massage-intake"
            value={value.slug}
            onChange={(e) => {
              setSlugTouched(true);
              setValue({ ...value, slug: e.target.value });
            }}
            helperText="Stable identifier for this flow. Auto-derived from the name; edit if needed."
            fullWidth
          />

          <FormControl>
            <FormLabel sx={{ mb: 0.5 }}>Base paperwork</FormLabel>
            <RadioGroup
              value={value.base}
              onChange={(e) => setValue({ ...value, base: e.target.value as PaperworkFlowBase })}
            >
              {BASE_OPTIONS.map((opt) => (
                <FormControlLabel
                  key={opt.value}
                  value={opt.value}
                  control={<Radio />}
                  label={
                    <Box>
                      <Typography variant="body2">{opt.label}</Typography>
                      <Typography variant="caption" color="text.secondary">
                        {opt.helper}
                      </Typography>
                    </Box>
                  }
                />
              ))}
            </RadioGroup>
          </FormControl>

          <FormControl fullWidth>
            <InputLabel id="practice-forms-label">Practice forms</InputLabel>
            <Select
              labelId="practice-forms-label"
              multiple
              value={value.formIds}
              onChange={(e) =>
                setValue({
                  ...value,
                  formIds: typeof e.target.value === 'string' ? e.target.value.split(',') : e.target.value,
                })
              }
              input={<OutlinedInput label="Practice forms" />}
              renderValue={(selected) => (selected as string[]).map(labelForForm).join(', ')}
            >
              {formOptions.length === 0 && (
                <MenuItem disabled>
                  <ListItemText primary="No practice-managed forms found" />
                </MenuItem>
              )}
              {formOptions.map((opt) => (
                <MenuItem key={opt.id} value={opt.id}>
                  <Checkbox checked={value.formIds.includes(opt.id)} />
                  <ListItemText primary={opt.label} />
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          <FormControl fullWidth>
            <InputLabel id="applies-services-label">Applies to services</InputLabel>
            <Select
              labelId="applies-services-label"
              multiple
              value={value.serviceIds}
              onChange={(e) =>
                setValue({
                  ...value,
                  serviceIds: typeof e.target.value === 'string' ? e.target.value.split(',') : e.target.value,
                })
              }
              input={<OutlinedInput label="Applies to services" />}
              renderValue={(selected) => (selected as string[]).map(labelForService).join(', ')}
            >
              {serviceOptions.length === 0 && (
                <MenuItem disabled>
                  <ListItemText primary="No service categories found" />
                </MenuItem>
              )}
              {serviceOptions.map((opt) => (
                <MenuItem key={opt.id} value={opt.id}>
                  <Checkbox checked={value.serviceIds.includes(opt.id)} />
                  <ListItemText primary={opt.label} />
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={saving}>
          Cancel
        </Button>
        <Button
          variant="contained"
          onClick={() => onSave(value)}
          disabled={saving || !value.name.trim() || !value.slug.trim()}
          startIcon={saving ? <CircularProgress size={16} color="inherit" /> : undefined}
        >
          Save
        </Button>
      </DialogActions>
    </Dialog>
  );
};

// ── Base intake form editor ──────────────────────────────────────────────────

const sameIds = (a: string[], b: string[]): boolean => a.length === b.length && a.every((x, i) => x === b[i]);

// One card per base intake (In-person / Virtual / Consent-only). Its forms compose
// onto every booking on that base intake. Order matters (List.entry order). Edits
// auto-save: add/remove persist immediately, reorder is debounced (coalesces rapid
// up/down clicks); saves are sequenced per card so a later edit can't lose to an
// earlier one's response.
const BaseFlowCard: FC<{
  baseFlow: PaperworkFlow;
  formOptions: FormOption[];
  onPersist: (formIds: string[]) => Promise<void>;
  onError: () => void;
}> = ({ baseFlow, formOptions, onPersist, onError }) => {
  const [formIds, setFormIds] = useState<string[]>(baseFlow.formIds);
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');

  const latestRef = useRef<string[]>(baseFlow.formIds);
  const lastSavedRef = useRef<string[]>(baseFlow.formIds);
  const inFlightRef = useRef(false);
  const failedRef = useRef(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  // Callbacks live in refs so the unmount-flush effect can have [] deps — the parent passes
  // inline arrows, and depending on them would run the "unmount" cleanup on every render,
  // firing unsequenced saves mid-debounce.
  const onPersistRef = useRef(onPersist);
  onPersistRef.current = onPersist;
  const onErrorRef = useRef(onError);
  onErrorRef.current = onError;

  // Accept an external update (e.g. a refetch) when there's no unsaved local divergence —
  // OR after a failed save, where the server is the only trustworthy state (server wins;
  // the user re-applies their edit).
  useEffect(() => {
    if (sameIds(latestRef.current, lastSavedRef.current) || failedRef.current) {
      setFormIds(baseFlow.formIds);
      latestRef.current = baseFlow.formIds;
      lastSavedRef.current = baseFlow.formIds;
      failedRef.current = false;
    }
  }, [baseFlow.formIds]);

  const save = useCallback(async (): Promise<void> => {
    if (inFlightRef.current) return; // a save is running; it re-checks latestRef on completion
    if (sameIds(latestRef.current, lastSavedRef.current)) return;
    inFlightRef.current = true;
    setStatus('saving');
    const ids = latestRef.current;
    try {
      await onPersistRef.current(ids);
      lastSavedRef.current = ids;
      failedRef.current = false;
    } catch {
      inFlightRef.current = false;
      failedRef.current = true; // let the refetch reconcile this card to server state
      setStatus('error');
      onErrorRef.current(); // snackbar + refetch
      return;
    }
    inFlightRef.current = false;
    if (!sameIds(latestRef.current, lastSavedRef.current)) {
      void save(); // edits arrived during the save — persist the latest
    } else {
      setStatus('saved');
    }
  }, []);

  const apply = useCallback(
    (next: string[], debounce: boolean): void => {
      latestRef.current = next;
      setFormIds(next);
      if (debounceRef.current) clearTimeout(debounceRef.current);
      if (debounce) debounceRef.current = setTimeout(() => void save(), 500);
      else void save();
    },
    [save]
  );

  // Flush a pending debounced reorder if the card unmounts (e.g. navigation). [] deps —
  // this must run ONLY at unmount, and it flushes through save() so it can never race a
  // save already in flight.
  useEffect(
    () => () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      void save();
    },
    [save]
  );

  const labelFor = (id: string): string => formOptions.find((f) => f.id === id)?.label ?? id;
  const available = formOptions.filter((f) => !formIds.includes(f.id));

  const move = (i: number, dir: -1 | 1): void => {
    const j = i + dir;
    if (j < 0 || j >= formIds.length) return;
    const next = [...formIds];
    [next[i], next[j]] = [next[j], next[i]];
    apply(next, true); // debounce — coalesce rapid reorder clicks
  };

  return (
    <Paper variant="outlined" sx={{ p: 2, flex: 1, minWidth: 300 }}>
      <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1, minHeight: 24 }}>
        <Typography variant="subtitle1" fontWeight={600}>
          {baseFlow.name}
        </Typography>
        {status === 'saving' && <CircularProgress size={14} />}
        {status === 'saved' && (
          <Typography variant="caption" color="success.main">
            Saved
          </Typography>
        )}
        {status === 'error' && (
          <Typography variant="caption" color="error.main">
            Save failed — list reloaded
          </Typography>
        )}
      </Stack>
      <Stack spacing={0.5} sx={{ mb: 1.5 }}>
        {formIds.length === 0 ? (
          <Typography variant="body2" color="text.disabled">
            No forms attached.
          </Typography>
        ) : (
          formIds.map((id, i) => (
            <Stack key={id} direction="row" alignItems="center" spacing={0.25}>
              <IconButton size="small" disabled={i === 0} onClick={() => move(i, -1)}>
                <KeyboardArrowUpIcon fontSize="small" />
              </IconButton>
              <IconButton size="small" disabled={i === formIds.length - 1} onClick={() => move(i, 1)}>
                <KeyboardArrowDownIcon fontSize="small" />
              </IconButton>
              <Typography variant="body2" sx={{ flex: 1 }}>
                {labelFor(id)}
              </Typography>
              <IconButton
                size="small"
                onClick={() =>
                  apply(
                    formIds.filter((f) => f !== id),
                    false
                  )
                }
              >
                <CloseIcon fontSize="small" />
              </IconButton>
            </Stack>
          ))
        )}
      </Stack>
      <FormControl fullWidth size="small">
        <InputLabel id={`add-${baseFlow.slug}`}>Add form</InputLabel>
        <Select
          labelId={`add-${baseFlow.slug}`}
          label="Add form"
          value=""
          onChange={(e) => {
            const id = e.target.value as string;
            if (id && !formIds.includes(id)) apply([...formIds, id], false);
          }}
        >
          {available.length === 0 && <MenuItem disabled>All forms added</MenuItem>}
          {available.map((o) => (
            <MenuItem key={o.id} value={o.id}>
              {o.label}
            </MenuItem>
          ))}
        </Select>
      </FormControl>
    </Paper>
  );
};

// ── List page ────────────────────────────────────────────────────────────────

const PaperworkPackagesAdminPage: FC = () => {
  const { oystehrZambda } = useApiClients();
  const queryClient = useQueryClient();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<DraftFlow | undefined>(undefined);

  const { data: flowsData, isLoading: flowsLoading } = useQuery({
    queryKey: FLOWS_QUERY_KEY,
    queryFn: async () => {
      if (!oystehrZambda) return { flows: [] as PaperworkFlowWithServices[], baseFlows: [] as PaperworkFlow[] };
      return listPaperworkFlows(oystehrZambda);
    },
    enabled: !!oystehrZambda,
  });

  const { data: formsData } = useManagedQuestionnaireList();

  const { data: servicesData } = useQuery({
    queryKey: SERVICES_QUERY_KEY,
    queryFn: async () => {
      if (!oystehrZambda) return { serviceCategories: [] };
      return listServiceCategories(oystehrZambda);
    },
    enabled: !!oystehrZambda,
  });

  const flows = flowsData?.flows ?? [];
  const baseFlows = flowsData?.baseFlows ?? [];

  const formOptions: FormOption[] = useMemo(
    () =>
      (formsData?.managedQuestionnaires ?? [])
        .map((q: any) => ({ id: q.id as string, label: (q.title || q.name || q.id) as string }))
        .filter((o: FormOption) => !!o.id)
        .sort((a: FormOption, b: FormOption) => a.label.localeCompare(b.label)),
    [formsData]
  );

  const serviceOptions: ServiceOption[] = useMemo(
    () =>
      (servicesData?.serviceCategories ?? [])
        .filter((s) => !!s.id)
        .map((s) => ({ id: s.id as string, label: s.name || s.code }))
        .sort((a, b) => a.label.localeCompare(b.label)),
    [servicesData]
  );

  const saveMutation = useMutation({
    mutationFn: async (draft: DraftFlow) => {
      if (!oystehrZambda) throw new Error('Not connected');
      const { id, serviceIds, ...flow } = draft;
      if (id) {
        return updatePaperworkFlow(oystehrZambda, { flow: { id, ...flow }, serviceIds });
      }
      return createPaperworkFlow(oystehrZambda, { flow, serviceIds });
    },
    onSuccess: async (_data, draft) => {
      enqueueSnackbar(`Saved "${draft.name}"`, { variant: 'success' });
      setDialogOpen(false);
      await queryClient.invalidateQueries({ queryKey: FLOWS_QUERY_KEY });
      await queryClient.invalidateQueries({ queryKey: SERVICES_QUERY_KEY });
    },
    onError: (err: any) => {
      enqueueSnackbar(`Could not save flow: ${err?.message ?? 'unknown error'}`, { variant: 'error' });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (flowId: string) => {
      if (!oystehrZambda) throw new Error('Not connected');
      return deletePaperworkFlow(oystehrZambda, flowId);
    },
    onSuccess: async () => {
      enqueueSnackbar('Flow deleted', { variant: 'success' });
      await queryClient.invalidateQueries({ queryKey: FLOWS_QUERY_KEY });
      await queryClient.invalidateQueries({ queryKey: SERVICES_QUERY_KEY });
    },
    onError: (err: any) => {
      enqueueSnackbar(`Could not delete flow: ${err?.message ?? 'unknown error'}`, { variant: 'error' });
    },
  });

  // Base intake cards auto-save each edit. Persist then patch the FLOWS cache in place
  // (no refetch — a refetch could clobber an in-progress edit; BaseFlowCard reconciles).
  const persistBaseFlow = useCallback(
    async (flow: PaperworkFlow, formIds: string[]): Promise<void> => {
      if (!oystehrZambda) throw new Error('Not connected');
      await updatePaperworkFlow(oystehrZambda, { flow: { ...flow, formIds }, serviceIds: [] });
      queryClient.setQueryData<{ flows: PaperworkFlowWithServices[]; baseFlows: PaperworkFlow[] }>(
        FLOWS_QUERY_KEY,
        (old) =>
          old ? { ...old, baseFlows: old.baseFlows.map((b) => (b.id === flow.id ? { ...b, formIds } : b)) } : old
      );
    },
    [oystehrZambda, queryClient]
  );

  const handleBaseFlowError = useCallback((): void => {
    enqueueSnackbar('Could not save base intake forms', { variant: 'error' });
    void queryClient.invalidateQueries({ queryKey: FLOWS_QUERY_KEY });
  }, [queryClient]);

  const openNew = (): void => {
    setEditing(undefined);
    setDialogOpen(true);
  };

  const openEdit = (flow: PaperworkFlowWithServices): void => {
    setEditing({
      id: flow.id,
      slug: flow.slug,
      name: flow.name,
      base: flow.base,
      formIds: flow.formIds,
      serviceIds: flow.serviceIds,
    });
    setDialogOpen(true);
  };

  const handleDelete = (flow: PaperworkFlowWithServices): void => {
    if (!flow.id) return;
    if (!window.confirm(`Delete the "${flow.name}" paperwork flow? Services using it will fall back to the default.`))
      return;
    deleteMutation.mutate(flow.id);
  };

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" sx={{ mb: 1 }}>
        Paperwork Flows
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3, maxWidth: 720 }}>
        A booking's paperwork is composed from its <b>base intake</b> forms (below — applied to every booking on that
        intake) plus any <b>service flow</b> forms (further down — applied only to that flow's service categories).
      </Typography>

      <Typography variant="h6" sx={{ mb: 0.5 }}>
        Base intake forms
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2, maxWidth: 720 }}>
        Forms attached here appear on every booking that uses the base intake. Attach a form to both In-person and
        Virtual for all standard visits, or to one for that mode only.
      </Typography>
      <Stack direction="row" spacing={2} flexWrap="wrap" useFlexGap sx={{ mb: 4 }}>
        {flowsLoading && <CircularProgress size={24} />}
        {baseFlows.map((bf) => (
          <BaseFlowCard
            key={bf.id ?? bf.slug}
            baseFlow={bf}
            formOptions={formOptions}
            onPersist={(formIds) => persistBaseFlow(bf, formIds)}
            onError={handleBaseFlowError}
          />
        ))}
      </Stack>

      <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1 }}>
        <Typography variant="h6">Service flows</Typography>
        <Button variant="contained" startIcon={<AddIcon />} onClick={openNew} disabled={!oystehrZambda}>
          New flow
        </Button>
      </Stack>

      <TableContainer component={Paper} variant="outlined">
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell sx={{ fontWeight: 600 }}>Flow</TableCell>
              <TableCell sx={{ fontWeight: 600 }}>Base paperwork</TableCell>
              <TableCell sx={{ fontWeight: 600 }}>Practice forms</TableCell>
              <TableCell sx={{ fontWeight: 600 }}>Applies to services</TableCell>
              <TableCell sx={{ fontWeight: 600, width: 1 }} align="right">
                Actions
              </TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {flowsLoading && (
              <TableRow>
                <TableCell colSpan={5} align="center" sx={{ py: 4 }}>
                  <CircularProgress size={24} />
                </TableCell>
              </TableRow>
            )}
            {!flowsLoading && flows.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} align="center" sx={{ py: 4, color: 'text.disabled' }}>
                  No paperwork flows yet. Click "New flow" to create one.
                </TableCell>
              </TableRow>
            )}
            {flows.map((flow) => (
              <TableRow key={flow.id} hover>
                <TableCell>
                  <Typography variant="body2" fontWeight={500}>
                    {flow.name}
                  </Typography>
                  <Box component="code" sx={{ fontFamily: 'monospace', fontSize: 12, color: 'text.secondary' }}>
                    {flow.slug}
                  </Box>
                </TableCell>
                <TableCell>{baseLabel(flow.base)}</TableCell>
                <TableCell>
                  <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap>
                    {flow.formIds.length === 0 ? (
                      <Typography variant="body2" color="text.disabled">
                        —
                      </Typography>
                    ) : (
                      flow.formIds.map((id) => (
                        <Chip
                          key={id}
                          size="small"
                          label={formOptions.find((f) => f.id === id)?.label ?? id}
                          sx={{ mb: 0.5 }}
                        />
                      ))
                    )}
                  </Stack>
                </TableCell>
                <TableCell>
                  <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap>
                    {flow.serviceIds.length === 0 ? (
                      <Typography variant="body2" color="text.disabled">
                        —
                      </Typography>
                    ) : (
                      flow.serviceIds.map((id) => (
                        <Chip
                          key={id}
                          size="small"
                          variant="outlined"
                          label={serviceOptions.find((s) => s.id === id)?.label ?? id}
                          sx={{ mb: 0.5 }}
                        />
                      ))
                    )}
                  </Stack>
                </TableCell>
                <TableCell align="right">
                  <Tooltip title="Edit">
                    <IconButton size="small" onClick={() => openEdit(flow)}>
                      <EditIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                  <Tooltip title="Delete">
                    <IconButton size="small" onClick={() => handleDelete(flow)} disabled={deleteMutation.isPending}>
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      <FlowDialog
        key={editing?.id ?? 'new'}
        open={dialogOpen}
        initial={editing}
        formOptions={formOptions}
        serviceOptions={serviceOptions}
        saving={saveMutation.isPending}
        onClose={() => setDialogOpen(false)}
        onSave={(value) => saveMutation.mutate(value)}
      />
    </Box>
  );
};

export default PaperworkPackagesAdminPage;
