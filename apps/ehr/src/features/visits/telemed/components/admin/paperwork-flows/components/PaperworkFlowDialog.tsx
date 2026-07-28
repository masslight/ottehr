import {
  Box,
  Button,
  Checkbox,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  FormControlLabel,
  FormGroup,
  FormLabel,
  InputLabel,
  ListItemText,
  MenuItem,
  OutlinedInput,
  Select,
  Stack,
  TextField,
} from '@mui/material';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { enqueueSnackbar } from 'notistack';
import { FC, useState } from 'react';
import { createPaperworkFlow, updatePaperworkFlow } from 'src/api/api';
import { useApiClients } from 'src/hooks/useAppClients';
import { FlowForm, FlowService, SERVICE_MODE_LABEL, ServiceMode } from 'utils';
import { OrderedFormEditor } from './OrderedFormEditor';

const ALL_MODES: ServiceMode[] = Object.values(ServiceMode);

const SELECT_ALL = '__all__';

export type DraftFlow = {
  name: string;
  formsSelected: FlowForm[];
  modes: ServiceMode[];
  services: FlowService[];
};

interface PaperworkFlowDialogProps {
  open: boolean;
  initial: DraftFlow;
  editingFlowId?: string;
  formOptions: FlowForm[];
  serviceCategories: FlowService[];
  onClose: () => void;
}

export const PaperworkFlowDialog: FC<PaperworkFlowDialogProps> = ({
  open,
  initial,
  editingFlowId,
  formOptions,
  serviceCategories,
  onClose,
}) => {
  const [value, setValue] = useState<DraftFlow>(initial);

  const { oystehrZambda } = useApiClients();
  const queryClient = useQueryClient();

  const serviceIds = serviceCategories.map((s) => s.id);
  const selectedServiceIds = value.services.map((s) => s.id);
  const selected = serviceIds.length > 0 && selectedServiceIds.length === serviceIds.length;

  const { isPending: saving, mutate: onSave } = useMutation({
    mutationFn: async ({ draft }: { draft: DraftFlow }) => {
      if (!oystehrZambda) throw new Error('Not connected');
      const flow = { name: draft.name, forms: draft.formsSelected, modes: draft.modes };
      if (editingFlowId) {
        console.log('wat', editingFlowId);
        await updatePaperworkFlow(oystehrZambda, { flow, flowServices: draft.services, flowId: editingFlowId });
      } else {
        await createPaperworkFlow(oystehrZambda, { flow, flowServices: draft.services });
      }
    },
    onSuccess: async (_data, { draft }) => {
      enqueueSnackbar(`Saved "${draft.name}"`, { variant: 'success' });
      onClose();
      await queryClient.invalidateQueries({ queryKey: ['paperwork-flow-list'] });
      await queryClient.invalidateQueries({ queryKey: ['service-categories'] });
    },
    onError: (err: unknown) => {
      enqueueSnackbar(`Could not save flow: ${err instanceof Error ? err.message : 'unknown error'}`, {
        variant: 'error',
      });
    },
  });

  const dialogTitle = editingFlowId ? 'Edit paperwork flow' : 'New paperwork flow';

  const toggleMode = (mode: ServiceMode): void =>
    setValue((v) => ({
      ...v,
      modes: v.modes.includes(mode) ? v.modes.filter((m) => m !== mode) : [...v.modes, mode],
    }));

  return (
    <Dialog open={open} onClose={saving ? undefined : onClose} fullWidth maxWidth="sm">
      <DialogTitle>{dialogTitle}</DialogTitle>
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
                  label={SERVICE_MODE_LABEL[mode]}
                />
              ))}
            </FormGroup>
          </FormControl>

          <Box>
            <FormLabel sx={{ mb: 0.5, display: 'block' }}>Forms (in order)</FormLabel>
            <OrderedFormEditor
              formsSelected={value.formsSelected}
              formOptions={formOptions}
              onChange={(next) => setValue((v) => ({ ...v, formsSelected: next }))}
            />
          </Box>

          <FormControl fullWidth>
            <InputLabel id="applies-services-label">Applies to services</InputLabel>
            <Select
              labelId="applies-services-label"
              multiple
              value={selectedServiceIds}
              onChange={(e) => {
                const val = typeof e.target.value === 'string' ? e.target.value.split(',') : e.target.value;
                if (val.includes(SELECT_ALL)) {
                  setValue((v) => ({ ...v, services: selected ? [] : serviceCategories }));
                } else {
                  const nextServices = val
                    .map((id) => serviceCategories.find((s) => s.id === id))
                    .filter((s): s is FlowService => !!s);
                  setValue((v) => ({ ...v, services: nextServices }));
                }
              }}
              input={<OutlinedInput label="Applies to services" />}
              renderValue={() => value.services.map((s) => s.label).join(', ')}
            >
              <MenuItem value={SELECT_ALL}>
                <Checkbox checked={selected} indeterminate={selectedServiceIds.length > 0 && !selected} />
                <ListItemText primary="Select all" />
              </MenuItem>
              {serviceCategories.map((opt) => (
                <MenuItem key={opt.id} value={opt.id}>
                  <Checkbox checked={selectedServiceIds.includes(opt.id)} />
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
          onClick={() => onSave({ draft: value })}
          disabled={saving || !value.name.trim() || value.modes.length === 0}
          startIcon={saving ? <CircularProgress size={16} color="inherit" /> : undefined}
        >
          Save
        </Button>
      </DialogActions>
    </Dialog>
  );
};
