import { Close as CloseIcon, Save as SaveIcon } from '@mui/icons-material';
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  FormHelperText,
  IconButton,
  InputLabel,
  MenuItem,
  Select,
  TextField,
  Typography,
} from '@mui/material';
import { ReactElement, useEffect, useState } from 'react';
import { Controller, FormProvider, useForm } from 'react-hook-form';
import {
  ChargeItemDefinitionDefault,
  ChargeItemDefinitionType,
  CreateChargeItemDefinitionInputSchema,
  getApiError,
  REQUIRED_FIELD_ERROR_MESSAGE,
} from 'utils';
import z from 'zod';
import { createChargeItemDefinition } from '../api/api';
import { ChargeItemDefinitionLabels } from '../constants/chargeItemDefinition';
import { useApiClients } from '../hooks/useAppClients';

interface AddChargeItemDefinitionForm {
  name: string | null;
  description: string | null;
  effectiveDate: string | null;
  default: ChargeItemDefinitionDefault | null;
}

const defaultValues: AddChargeItemDefinitionForm = {
  name: null,
  description: null,
  effectiveDate: null,
  default: null,
};

interface AddChargeItemDefinitionDialogProps {
  type: ChargeItemDefinitionType;
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
}

export function AddChargeItemDefinitionDialog({
  type,
  open,
  onClose,
  onCreated,
}: AddChargeItemDefinitionDialogProps): ReactElement {
  const { oystehrZambda } = useApiClients();
  const methods = useForm<AddChargeItemDefinitionForm>({ defaultValues });
  const {
    control,
    handleSubmit,
    reset,
    formState: { isSubmitting },
  } = methods;

  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setError(null);
    reset();
  }, [open, reset]);

  const handleSave = async (data: AddChargeItemDefinitionForm): Promise<void> => {
    if (!oystehrZambda) return;
    setError(null);
    try {
      const payload: z.input<typeof CreateChargeItemDefinitionInputSchema> = {
        type: type,
        name: data.name!.trim(),
        description: data.description?.trim(),
        effectiveDate: data.effectiveDate?.trim(),
        default: data.default || undefined,
      };
      const result = await createChargeItemDefinition(oystehrZambda, payload);
      if (!result.id) throw new Error(`${ChargeItemDefinitionLabels[type].singularTitle} was not created`);
      onCreated();
      onClose();
    } catch (err) {
      setError(
        getApiError({ error: err, defaultError: `Failed to create ${ChargeItemDefinitionLabels[type].singularText}` })
      );
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth={false} PaperProps={{ sx: { width: 980, maxWidth: '95vw' } }}>
      <DialogTitle sx={{ px: 3, pt: 3, pb: 2, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Typography variant="h5">Add {ChargeItemDefinitionLabels[type].singularTitle}</Typography>
        <IconButton size="small" onClick={onClose} aria-label="Close">
          <CloseIcon fontSize="small" />
        </IconButton>
      </DialogTitle>
      <DialogContent>
        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}
        <FormProvider {...methods}>
          <Box sx={{ display: 'flex', gap: 5, mt: 1 }}>
            <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 2.5 }}>
              <Controller
                name="name"
                control={control}
                rules={{ required: REQUIRED_FIELD_ERROR_MESSAGE }}
                render={({ field, fieldState: { error: fieldError } }) => (
                  <TextField
                    label="Name *"
                    size="small"
                    fullWidth
                    value={field.value}
                    onChange={(e) => field.onChange(e.target.value)}
                    error={!!fieldError}
                    helperText={fieldError?.message}
                  />
                )}
              />
              <Controller
                name="description"
                control={control}
                render={({ field, fieldState: { error: fieldError } }) => (
                  <TextField
                    label="Description"
                    size="small"
                    fullWidth
                    value={field.value}
                    onChange={(e) => field.onChange(e.target.value)}
                    error={!!fieldError}
                    helperText={fieldError?.message}
                  />
                )}
              />
              <Controller
                name="effectiveDate"
                control={control}
                render={({ field, fieldState: { error: fieldError } }) => (
                  <TextField
                    label="Effective Date"
                    size="small"
                    fullWidth
                    type="date"
                    value={field.value}
                    onChange={(e) => field.onChange(e.target.value)}
                    InputLabelProps={{ shrink: true }}
                    error={!!fieldError}
                    helperText={fieldError?.message}
                  />
                )}
              />
              <Controller
                name="default"
                control={control}
                render={({ field, fieldState: { error: fieldError } }) => (
                  <FormControl size="small" fullWidth>
                    <InputLabel id="default-select-label" error={!!fieldError}>
                      Is Default For
                    </InputLabel>
                    <Select
                      aria-describedby={fieldError ? 'default-helper-text' : undefined}
                      label="Is Default For"
                      labelId="default-select-label"
                      size="small"
                      fullWidth
                      value={field.value}
                      onChange={(e) => field.onChange(e.target.value)}
                    >
                      <MenuItem value="">None</MenuItem>
                      <MenuItem value="insurance">Insurance</MenuItem>
                      <MenuItem value="self-pay">Self-Pay</MenuItem>
                    </Select>
                    {fieldError ? (
                      <FormHelperText id={`default-helper-text`} error={true}>
                        {fieldError?.message}
                      </FormHelperText>
                    ) : (
                      <></>
                    )}
                  </FormControl>
                )}
              />
            </Box>
          </Box>
        </FormProvider>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose}>Cancel</Button>
        <Button
          variant="contained"
          startIcon={isSubmitting ? <CircularProgress size={14} /> : <SaveIcon fontSize="small" />}
          onClick={handleSubmit(handleSave)}
          disabled={isSubmitting}
        >
          {isSubmitting ? 'Saving...' : 'Save'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
