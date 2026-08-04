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
  FormHelperText,
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
import { FC } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { createPaperworkFlow, updatePaperworkFlow } from 'src/api/api';
import { useApiClients } from 'src/hooks/useAppClients';
import { APIError, FlowForm, FlowService, isApiError, SERVICE_MODE_LABEL, ServiceMode } from 'utils';
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
  const { control, handleSubmit } = useForm<DraftFlow>({ defaultValues: initial, mode: 'onChange' });

  const { oystehrZambda } = useApiClients();
  const queryClient = useQueryClient();

  const serviceIds = serviceCategories.map((s) => s.id);

  const { isPending: saving, mutate: onSave } = useMutation({
    mutationFn: async ({ draft }: { draft: DraftFlow }) => {
      if (!oystehrZambda) throw new Error('Not connected');
      const flow = { name: draft.name, forms: draft.formsSelected, modes: draft.modes };
      if (editingFlowId) {
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
    onError: (error: unknown) => {
      let message = error instanceof Error ? error.message : 'unknown error';
      if (isApiError(error)) message = (error as APIError).message;
      enqueueSnackbar(`Could not save flow: ${message}`, {
        variant: 'error',
      });
    },
  });

  const dialogTitle = editingFlowId ? 'Edit paperwork flow' : 'New paperwork flow';

  const handleSave = handleSubmit((draft) => onSave({ draft }));

  return (
    <Dialog open={open} onClose={saving ? undefined : onClose} fullWidth maxWidth="sm">
      <DialogTitle>{dialogTitle}</DialogTitle>
      <DialogContent>
        <Stack spacing={2.5} sx={{ mt: 1 }}>
          <Controller
            name="name"
            control={control}
            rules={{ validate: (value) => value.trim().length > 0 || 'A name is required.' }}
            render={({ field, fieldState: { error } }) => (
              <TextField
                {...field}
                error={!!error}
                helperText={error?.message}
                required
                label="Name"
                placeholder="e.g. Dermatology intake"
                fullWidth
              />
            )}
          />

          <Controller
            name="modes"
            control={control}
            rules={{ validate: (value) => value.length > 0 || 'At least one modality is required.' }}
            render={({ field, fieldState: { error } }) => (
              <FormControl error={!!error}>
                <FormLabel sx={{ mb: 0.5 }}>Visit modality</FormLabel>
                <FormGroup row>
                  {ALL_MODES.map((mode) => (
                    <FormControlLabel
                      key={mode}
                      control={
                        <Checkbox
                          checked={field.value.includes(mode)}
                          onChange={() =>
                            field.onChange(
                              field.value.includes(mode)
                                ? field.value.filter((m) => m !== mode)
                                : [...field.value, mode]
                            )
                          }
                        />
                      }
                      label={SERVICE_MODE_LABEL[mode]}
                    />
                  ))}
                </FormGroup>
                {error && <FormHelperText error>{error.message}</FormHelperText>}
              </FormControl>
            )}
          />

          <Controller
            name="formsSelected"
            control={control}
            rules={{ validate: (value) => value.length > 0 || 'At least one form is required.' }}
            render={({ field, fieldState: { error } }) => (
              <Box>
                <FormLabel sx={{ mb: 0.5, display: 'block' }} error={!!error}>
                  Forms (in order)
                </FormLabel>
                <OrderedFormEditor
                  formsSelected={field.value}
                  formOptions={formOptions}
                  error={!!error}
                  onChange={field.onChange}
                />
                {error && <FormHelperText error>{error.message}</FormHelperText>}
              </Box>
            )}
          />

          <Controller
            name="services"
            control={control}
            rules={{ validate: (value) => value.length > 0 || 'At least one service is required.' }}
            render={({ field, fieldState: { error } }) => {
              const selectedServiceIds = field.value.map((s) => s.id);
              const allSelected = serviceIds.length > 0 && selectedServiceIds.length === serviceIds.length;

              return (
                <FormControl fullWidth error={!!error}>
                  <InputLabel id="applies-services-label">Applies to services</InputLabel>
                  <Select
                    labelId="applies-services-label"
                    multiple
                    value={selectedServiceIds}
                    onChange={(e) => {
                      const val = typeof e.target.value === 'string' ? e.target.value.split(',') : e.target.value;
                      if (val.includes(SELECT_ALL)) {
                        field.onChange(allSelected ? [] : serviceCategories);
                      } else {
                        field.onChange(
                          val
                            .map((id) => serviceCategories.find((s) => s.id === id))
                            .filter((s): s is FlowService => !!s)
                        );
                      }
                    }}
                    input={<OutlinedInput label="Applies to services" />}
                    renderValue={() => field.value.map((s) => s.label).join(', ')}
                  >
                    <MenuItem value={SELECT_ALL}>
                      <Checkbox checked={allSelected} indeterminate={selectedServiceIds.length > 0 && !allSelected} />
                      <ListItemText primary="Select all" />
                    </MenuItem>
                    {serviceCategories.map((opt) => (
                      <MenuItem key={opt.id} value={opt.id}>
                        <Checkbox checked={selectedServiceIds.includes(opt.id)} />
                        <ListItemText primary={opt.label} />
                      </MenuItem>
                    ))}
                  </Select>
                  {error && <FormHelperText error>{error.message}</FormHelperText>}
                </FormControl>
              );
            }}
          />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={saving}>
          Cancel
        </Button>
        <Button
          variant="contained"
          onClick={() => handleSave()}
          disabled={saving}
          startIcon={saving ? <CircularProgress size={16} color="inherit" /> : undefined}
        >
          Save
        </Button>
      </DialogActions>
    </Dialog>
  );
};
