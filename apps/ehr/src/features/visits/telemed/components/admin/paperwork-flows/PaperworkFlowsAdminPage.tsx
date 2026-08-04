import AddIcon from '@mui/icons-material/Add';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import DeleteIcon from '@mui/icons-material/Delete';
import EditIcon from '@mui/icons-material/Edit';
import {
  Box,
  Button,
  Chip,
  CircularProgress,
  IconButton,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tooltip,
  Typography,
} from '@mui/material';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { enqueueSnackbar } from 'notistack';
import { FC, useMemo, useState } from 'react';
import { deletePaperworkFlow, listPaperworkFlows, listServiceCategories } from 'src/api/api';
import { AdminHeaderActionSlot } from 'src/features/admin/AdminPageHeader';
import { useApiClients } from 'src/hooks/useAppClients';
import { BOOKING_CONFIG, FlowForm, PaperworkFlow, PaperworkFlowListOutput, SERVICE_MODE_LABEL } from 'utils';
import { usePracticeManagedQuestionnaires } from '../../../hooks/usePracticeManagedQuestionnaires';
import { DraftFlow, PaperworkFlowDialog } from './components/PaperworkFlowDialog';

const BLANK_DRAFT: DraftFlow = { name: '', formsSelected: [], modes: [], services: [] };

const PaperworkFlowsAdminPage: FC = () => {
  const { oystehrZambda } = useApiClients();
  const queryClient = useQueryClient();

  const [flowDialog, setFlowDialog] = useState<{
    open: boolean;
    seed: DraftFlow;
    editingFlowId?: string;
    nonce: number;
  }>({
    open: false,
    seed: BLANK_DRAFT,
    nonce: 0,
  });

  // action helpers
  const openNewFlowDialog = (): void =>
    setFlowDialog((d) => ({ open: true, seed: BLANK_DRAFT, editingFlowId: undefined, nonce: d.nonce + 1 }));

  const openEdit = (flow: PaperworkFlow): void =>
    setFlowDialog((d) => ({
      open: true,
      seed: { name: flow.name, formsSelected: flow.forms, modes: flow.modes, services: flow.services },
      editingFlowId: flow.qId,
      nonce: d.nonce + 1,
    }));

  const handleDelete = (flow: PaperworkFlow): void => {
    if (!window.confirm(`Delete the "${flow.name}" paperwork flow? Services using it will fall back to the default.`)) {
      return;
    }
    deleteMutation.mutate(flow.qId);
  };

  const deleteMutation = useMutation({
    mutationFn: async (flowId: string) => {
      if (!oystehrZambda) throw new Error('Not connected');
      return deletePaperworkFlow(oystehrZambda, { flowId });
    },
    onSuccess: async () => {
      enqueueSnackbar('Flow deleted', { variant: 'success' });
      await queryClient.invalidateQueries({ queryKey: ['paperwork-flow-list'] });
      await queryClient.invalidateQueries({ queryKey: ['service-categories'] });
    },
    onError: (err: unknown) => {
      enqueueSnackbar(`Could not delete flow: ${err instanceof Error ? err.message : 'unknown error'}`, {
        variant: 'error',
      });
    },
  });

  const openDuplicate = (flow: PaperworkFlow): void =>
    setFlowDialog((d) => ({
      open: true,
      seed: { name: '', formsSelected: flow.forms, modes: flow.modes, services: [] },
      editingFlowId: undefined,
      nonce: d.nonce + 1,
    }));

  // existing flows
  const { data: flowsData, isLoading: flowsLoading } = useQuery({
    queryKey: ['paperwork-flow-list'],
    queryFn: async (): Promise<PaperworkFlowListOutput> => {
      if (!oystehrZambda) return { flows: [], ottehrManagedQuestionnaires: [] };
      return listPaperworkFlows(oystehrZambda);
    },
    enabled: !!oystehrZambda,
  });
  const flows = flowsData?.flows ?? [];

  // ottehr managed forms (intake pre-visit, consent only)
  const ottehrManagedQuestionnaires = useMemo(
    () => flowsData?.ottehrManagedQuestionnaires ?? [],
    [flowsData?.ottehrManagedQuestionnaires]
  );

  // all forms available to bundle into a form
  const { active: formsData } = usePracticeManagedQuestionnaires();
  const formOptions: FlowForm[] = useMemo(() => {
    const practiceManagedForms = (formsData ?? [])
      .filter((q) => !!q.id && q.status !== 'retired')
      .map((q) => ({ id: q.id, label: q.title || q.id }))
      .sort((a, b) => a.label.localeCompare(b.label));

    return [...ottehrManagedQuestionnaires, ...practiceManagedForms];
  }, [formsData, ottehrManagedQuestionnaires]);

  // admin services
  const { data: servicesData } = useQuery({
    queryKey: ['service-categories'],
    queryFn: async () => {
      if (!oystehrZambda) return { serviceCategories: [] };
      return listServiceCategories(oystehrZambda);
    },
    enabled: !!oystehrZambda,
  });
  const adminCodes = new Set((servicesData?.serviceCategories ?? []).map((sc) => sc.code));
  const adminServices = (servicesData?.serviceCategories ?? [])
    .filter((s) => !!s.id)
    .map((s) => ({ id: s.id as string, label: s.name || s.code, ottehrManagedService: false }))
    .sort((a, b) => a.label.localeCompare(b.label));

  // services living in the BOOKING CONFIG (ex: Urgent Care)
  const ottehrServices = BOOKING_CONFIG.serviceCategories
    .filter((sc) => sc.category.code && !adminCodes.has(sc.category.code))
    .map((sc) => ({
      id: sc.category.code,
      label: sc.category.display,
      ottehrManagedService: true,
    }));

  const allServiceOptions = [...ottehrServices, ...adminServices];

  return (
    <Box>
      <AdminHeaderActionSlot>
        <Button variant="contained" startIcon={<AddIcon />} onClick={openNewFlowDialog} disabled={!oystehrZambda}>
          New flow
        </Button>
      </AdminHeaderActionSlot>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3, maxWidth: 720 }}>
        A paperwork flow is an ordered bundle of forms applied to a set of service categories for the selected visit
        modality. A patient booking one of those services sees the flow’s forms.
      </Typography>

      <TableContainer component={Paper} variant="outlined">
        <Table size="small" sx={{ tableLayout: 'fixed' }}>
          <TableHead>
            <TableRow>
              <TableCell sx={{ fontWeight: 600, whiteSpace: 'nowrap', width: '15%' }}>Flow</TableCell>
              <TableCell sx={{ fontWeight: 600, whiteSpace: 'nowrap', width: '25%' }}>Forms</TableCell>
              <TableCell sx={{ fontWeight: 600, whiteSpace: 'nowrap', width: '35%' }}>Applied to Services</TableCell>
              <TableCell sx={{ fontWeight: 600, whiteSpace: 'nowrap', width: '18%' }}>Visit Modality</TableCell>
              <TableCell sx={{ fontWeight: 600, whiteSpace: 'nowrap', width: '10%' }} align="right">
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
              <TableRow key={flow.qId} hover>
                <TableCell>
                  <Typography variant="body2" fontWeight={500}>
                    {flow.name}
                  </Typography>
                </TableCell>
                <TableCell>
                  <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap>
                    {flow.forms.length === 0 ? (
                      <Typography variant="body2" color="text.disabled">
                        —
                      </Typography>
                    ) : (
                      flow.forms.map((form) => <Chip key={form.id} size="small" label={form.label} sx={{ mb: 0.5 }} />)
                    )}
                  </Stack>
                </TableCell>
                <TableCell>
                  <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap>
                    {flow.services.map((service) => (
                      <Chip key={service.id} size="small" variant="outlined" label={service.label} sx={{ mb: 0.5 }} />
                    ))}
                  </Stack>
                </TableCell>
                <TableCell>
                  <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap>
                    {flow.modes.map((m) => (
                      <Chip key={m} size="small" variant="outlined" label={SERVICE_MODE_LABEL[m]} sx={{ mb: 0.5 }} />
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
      <PaperworkFlowDialog
        key={flowDialog.nonce}
        open={flowDialog.open}
        initial={flowDialog.seed}
        editingFlowId={flowDialog.editingFlowId}
        formOptions={formOptions}
        serviceCategories={allServiceOptions}
        onClose={() => setFlowDialog((d) => ({ ...d, open: false }))}
      />
    </Box>
  );
};

export default PaperworkFlowsAdminPage;
