// Admin surface for Practice Paperwork Flows (OTR-2309).
//
// A *paperwork flow* is a reusable, ordered bundle of practice-managed forms assigned to service
// categories by visit mode. Each flow is one FHIR Questionnaire; assigning it stamps the flow's
// canonical onto each service's per-mode extension. Flows are authored in a dialog (name, visit
// modes, ordered forms, applied services) and can be edited, duplicated, or deleted.
//
// Backed by the paperwork-flow-{list,create,update} zambdas via the api.ts client wrappers.
import AddIcon from '@mui/icons-material/Add';
import CloseIcon from '@mui/icons-material/Close';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
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
  FormGroup,
  FormLabel,
  IconButton,
  InputLabel,
  ListItemText,
  MenuItem,
  OutlinedInput,
  Paper,
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
import { FC, useMemo, useState } from 'react';
import {
  createPaperworkFlow,
  listPaperworkFlows,
  listServiceCategories,
  practiceManagedQuestionnaireList,
  updatePaperworkFlow,
} from 'src/api/api';
import { useApiClients } from 'src/hooks/useAppClients';
import { PaperworkFlowMode, ServiceFlowWithServices } from 'utils';

const FLOWS_QUERY_KEY = ['paperwork-flows'];
const FORMS_QUERY_KEY = ['paperwork-flows', 'practice-forms'];
const SERVICES_QUERY_KEY = ['paperwork-flows', 'service-categories'];

const SELECT_ALL = '__all__';

type FlowsData = { flows: ServiceFlowWithServices[] };

const MODE_LABEL: Record<PaperworkFlowMode, string> = { 'in-person': 'In person', virtual: 'Virtual' };
const ALL_MODES: PaperworkFlowMode[] = ['in-person', 'virtual'];

interface FormOption {
  id: string;
  label: string;
}
interface ServiceOption {
  id: string;
  label: string;
}

type DraftFlow = {
  name: string;
  formIds: string[];
  modes: PaperworkFlowMode[];
  serviceIds: string[];
};

const BLANK_DRAFT: DraftFlow = { name: '', formIds: [], modes: [], serviceIds: [] };

// ── Ordered form list ──────────────────────────────────────────────────────────

const OrderedFormEditor: FC<{
  formIds: string[];
  formOptions: FormOption[];
  onChange: (next: string[]) => void;
}> = ({ formIds, formOptions, onChange }) => {
  const labelFor = (id: string): string => formOptions.find((f) => f.id === id)?.label ?? id;
  const available = formOptions.filter((f) => !formIds.includes(f.id));

  const move = (i: number, dir: -1 | 1): void => {
    const j = i + dir;
    if (j < 0 || j >= formIds.length) return;
    const next = [...formIds];
    [next[i], next[j]] = [next[j], next[i]];
    onChange(next);
  };

  return (
    <>
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
              <IconButton size="small" onClick={() => onChange(formIds.filter((f) => f !== id))}>
                <CloseIcon fontSize="small" />
              </IconButton>
            </Stack>
          ))
        )}
      </Stack>
      <FormControl fullWidth size="small">
        <InputLabel id="add-flow-form">Add form</InputLabel>
        <Select
          labelId="add-flow-form"
          label="Add form"
          value=""
          onChange={(e) => {
            const id = e.target.value as string;
            if (id && !formIds.includes(id)) onChange([...formIds, id]);
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
    </>
  );
};

// ── Create / edit dialog ─────────────────────────────────────────────────────────

const FlowDialog: FC<{
  open: boolean;
  initial: DraftFlow;
  isNew: boolean;
  formOptions: FormOption[];
  serviceOptions: ServiceOption[];
  saving: boolean;
  onClose: () => void;
  onSave: (value: DraftFlow) => void;
}> = ({ open, initial, isNew, formOptions, serviceOptions, saving, onClose, onSave }) => {
  const [value, setValue] = useState<DraftFlow>(initial);

  const labelForService = (id: string): string => serviceOptions.find((s) => s.id === id)?.label ?? id;
  const allServiceIds = serviceOptions.map((s) => s.id);
  const allSelected = allServiceIds.length > 0 && value.serviceIds.length === allServiceIds.length;

  const toggleMode = (mode: PaperworkFlowMode): void =>
    setValue((v) => ({
      ...v,
      modes: v.modes.includes(mode) ? v.modes.filter((m) => m !== mode) : [...v.modes, mode],
    }));

  return (
    <Dialog open={open} onClose={saving ? undefined : onClose} fullWidth maxWidth="sm">
      <DialogTitle>{isNew ? 'New paperwork flow' : 'Edit paperwork flow'}</DialogTitle>
      <DialogContent>
        <Stack spacing={2.5} sx={{ mt: 1 }}>
          <TextField
            label="Name"
            placeholder="e.g. Dermatology intake"
            value={value.name}
            onChange={(e) => setValue((v) => ({ ...v, name: e.target.value }))}
            fullWidth
          />

          <FormControl>
            <FormLabel sx={{ mb: 0.5 }}>Visit modes</FormLabel>
            <FormGroup row>
              {ALL_MODES.map((mode) => (
                <FormControlLabel
                  key={mode}
                  control={<Checkbox checked={value.modes.includes(mode)} onChange={() => toggleMode(mode)} />}
                  label={MODE_LABEL[mode]}
                />
              ))}
            </FormGroup>
          </FormControl>

          <Box>
            <FormLabel sx={{ mb: 0.5, display: 'block' }}>Forms (in order)</FormLabel>
            <OrderedFormEditor
              formIds={value.formIds}
              formOptions={formOptions}
              onChange={(next) => setValue((v) => ({ ...v, formIds: next }))}
            />
          </Box>

          <FormControl fullWidth>
            <InputLabel id="applies-services-label">Applies to services</InputLabel>
            <Select
              labelId="applies-services-label"
              multiple
              value={value.serviceIds}
              onChange={(e) => {
                const val = typeof e.target.value === 'string' ? e.target.value.split(',') : e.target.value;
                if (val.includes(SELECT_ALL)) {
                  setValue((v) => ({ ...v, serviceIds: allSelected ? [] : allServiceIds }));
                } else {
                  setValue((v) => ({ ...v, serviceIds: val }));
                }
              }}
              input={<OutlinedInput label="Applies to services" />}
              renderValue={(selected) => (selected as string[]).map(labelForService).join(', ')}
            >
              <MenuItem value={SELECT_ALL}>
                <Checkbox checked={allSelected} indeterminate={value.serviceIds.length > 0 && !allSelected} />
                <ListItemText primary="Select all" />
              </MenuItem>
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
          disabled={saving || !value.name.trim() || value.modes.length === 0}
          startIcon={saving ? <CircularProgress size={16} color="inherit" /> : undefined}
        >
          Save
        </Button>
      </DialogActions>
    </Dialog>
  );
};

// ── List page ───────────────────────────────────────────────────────────────────

const PaperworkFlowsAdminPage: FC = () => {
  const { oystehrZambda } = useApiClients();
  const queryClient = useQueryClient();

  const [dialog, setDialog] = useState<{ open: boolean; seed: DraftFlow; editingSlug?: string; nonce: number }>({
    open: false,
    seed: BLANK_DRAFT,
    nonce: 0,
  });

  const { data: flowsData, isLoading: flowsLoading } = useQuery({
    queryKey: FLOWS_QUERY_KEY,
    queryFn: async (): Promise<FlowsData> => {
      if (!oystehrZambda) return { flows: [] };
      return listPaperworkFlows(oystehrZambda);
    },
    enabled: !!oystehrZambda,
  });

  const { data: formsData } = useQuery({
    queryKey: FORMS_QUERY_KEY,
    queryFn: async () => {
      if (!oystehrZambda) return { practiceManagedQuestionnaires: [] };
      return practiceManagedQuestionnaireList(oystehrZambda);
    },
    enabled: !!oystehrZambda,
  });

  const { data: servicesData } = useQuery({
    queryKey: SERVICES_QUERY_KEY,
    queryFn: async () => {
      if (!oystehrZambda) return { serviceCategories: [] };
      return listServiceCategories(oystehrZambda);
    },
    enabled: !!oystehrZambda,
  });

  const flows = flowsData?.flows ?? [];

  const formOptions: FormOption[] = useMemo(
    () =>
      (formsData?.practiceManagedQuestionnaires ?? [])
        .filter((q) => !!q.id && q.status !== 'retired')
        .map((q) => ({ id: q.id, label: q.title || q.id }))
        .sort((a, b) => a.label.localeCompare(b.label)),
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
    mutationFn: async ({ draft, editingSlug }: { draft: DraftFlow; editingSlug?: string }) => {
      if (!oystehrZambda) throw new Error('Not connected');
      const flow = { name: draft.name, formIds: draft.formIds, modes: draft.modes };
      if (editingSlug) {
        return updatePaperworkFlow(oystehrZambda, {
          updateType: 'service-flow',
          slug: editingSlug,
          flow,
          serviceIds: draft.serviceIds,
        });
      }
      return createPaperworkFlow(oystehrZambda, { flow, serviceIds: draft.serviceIds });
    },
    onSuccess: async (_data, { draft }) => {
      enqueueSnackbar(`Saved "${draft.name}"`, { variant: 'success' });
      setDialog((d) => ({ ...d, open: false }));
      await queryClient.invalidateQueries({ queryKey: FLOWS_QUERY_KEY });
      await queryClient.invalidateQueries({ queryKey: SERVICES_QUERY_KEY });
    },
    onError: (err: unknown) => {
      enqueueSnackbar(`Could not save flow: ${err instanceof Error ? err.message : 'unknown error'}`, {
        variant: 'error',
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (slug: string) => {
      if (!oystehrZambda) throw new Error('Not connected');
      return updatePaperworkFlow(oystehrZambda, { updateType: 'retire', slug });
    },
    onSuccess: async () => {
      enqueueSnackbar('Flow deleted', { variant: 'success' });
      await queryClient.invalidateQueries({ queryKey: FLOWS_QUERY_KEY });
      await queryClient.invalidateQueries({ queryKey: SERVICES_QUERY_KEY });
    },
    onError: (err: unknown) => {
      enqueueSnackbar(`Could not delete flow: ${err instanceof Error ? err.message : 'unknown error'}`, {
        variant: 'error',
      });
    },
  });

  const openNew = (): void =>
    setDialog((d) => ({ open: true, seed: BLANK_DRAFT, editingSlug: undefined, nonce: d.nonce + 1 }));

  const openEdit = (flow: ServiceFlowWithServices): void =>
    setDialog((d) => ({
      open: true,
      seed: { name: flow.name, formIds: flow.formIds, modes: flow.modes, serviceIds: flow.serviceIds },
      editingSlug: flow.slug,
      nonce: d.nonce + 1,
    }));

  // Duplicate: pre-fill a NEW flow with the source's forms/modes/services; name is cleared so the
  // admin gives it a distinct identity, then tweaks (e.g. drop a form for a specific service).
  const openDuplicate = (flow: ServiceFlowWithServices): void =>
    setDialog((d) => ({
      open: true,
      seed: { name: '', formIds: flow.formIds, modes: flow.modes, serviceIds: flow.serviceIds },
      editingSlug: undefined,
      nonce: d.nonce + 1,
    }));

  const handleDelete = (flow: ServiceFlowWithServices): void => {
    if (!window.confirm(`Delete the "${flow.name}" paperwork flow? Services using it will fall back to the default.`)) {
      return;
    }
    deleteMutation.mutate(flow.slug);
  };

  return (
    <Box sx={{ p: 3 }}>
      <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1 }}>
        <Typography variant="h4">Paperwork Flows</Typography>
        <Button variant="contained" startIcon={<AddIcon />} onClick={openNew} disabled={!oystehrZambda}>
          New flow
        </Button>
      </Stack>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3, maxWidth: 720 }}>
        A paperwork flow is an ordered bundle of forms applied to a set of service categories for the selected visit
        modes. A patient booking one of those services sees the flow’s forms.
      </Typography>

      <TableContainer component={Paper} variant="outlined">
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell sx={{ fontWeight: 600 }}>Flow</TableCell>
              <TableCell sx={{ fontWeight: 600 }}>Forms</TableCell>
              <TableCell sx={{ fontWeight: 600 }}>Applied to Services</TableCell>
              <TableCell sx={{ fontWeight: 600 }}>Modes</TableCell>
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
              <TableRow key={flow.slug} hover>
                <TableCell>
                  <Typography variant="body2" fontWeight={500}>
                    {flow.name}
                  </Typography>
                </TableCell>
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
                <TableCell>
                  <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap>
                    {flow.modes.map((m) => (
                      <Chip key={m} size="small" variant="outlined" label={MODE_LABEL[m]} sx={{ mb: 0.5 }} />
                    ))}
                  </Stack>
                </TableCell>
                <TableCell align="right">
                  <Tooltip title="Edit">
                    <IconButton size="small" onClick={() => openEdit(flow)}>
                      <EditIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                  <Tooltip title="Duplicate">
                    <IconButton size="small" onClick={() => openDuplicate(flow)}>
                      <ContentCopyIcon fontSize="small" />
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
        key={dialog.nonce}
        open={dialog.open}
        initial={dialog.seed}
        isNew={!dialog.editingSlug}
        formOptions={formOptions}
        serviceOptions={serviceOptions}
        saving={saveMutation.isPending}
        onClose={() => setDialog((d) => ({ ...d, open: false }))}
        onSave={(value) => saveMutation.mutate({ draft: value, editingSlug: dialog.editingSlug })}
      />
    </Box>
  );
};

export default PaperworkFlowsAdminPage;
