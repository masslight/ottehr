import { Alert, Box, Button, CircularProgress, Stack, TextField, Typography } from '@mui/material';
import { enqueueSnackbar } from 'notistack';
import { ReactElement, useEffect, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { getApiError } from 'utils/lib/helpers/oystehrApi';
import { parseInvoiceConfigFromQR } from 'utils/lib/helpers/rcm/invoice-config';
import { otherColors } from 'utils/lib/theme/billing-palette';
import { SaveInvoiceConfigBodySchema, SaveInvoiceConfigInput } from 'utils/lib/types/api/invoice-config.types';
import { getInvoiceConfig, saveInvoiceConfig } from '../api/api';
import { InvoiceTemplateField } from '../components/InvoiceTemplateField';
import { useApiClients } from '../hooks/useAppClients';

export default function InvoicingConfiguration(): ReactElement {
  const { oystehrZambda } = useApiClients();
  const [loaded, setLoaded] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [saveError, setSaveError] = useState<string | null>(null);
  const {
    control,
    register,
    handleSubmit,
    reset,
    formState: { errors, isDirty, isSubmitting },
  } = useForm<SaveInvoiceConfigInput>();

  useEffect(() => {
    if (!oystehrZambda || loaded) return;
    let active = true;
    setLoadError(null);
    void getInvoiceConfig(oystehrZambda)
      .then((config) => {
        if (!active) return;
        reset(parseInvoiceConfigFromQR(config.questionnaireResponse));
        setLoaded(true);
      })
      .catch((error) => {
        if (active) setLoadError(getApiError({ error, defaultError: 'Failed to load invoicing settings' }));
      });
    return () => {
      active = false;
    };
  }, [oystehrZambda, loaded, loadAttempt, reset]);

  const onSubmit = async (values: SaveInvoiceConfigInput): Promise<void> => {
    if (!oystehrZambda) return;
    setSaveError(null);
    try {
      const config = await saveInvoiceConfig(oystehrZambda, values);
      reset(parseInvoiceConfigFromQR(config.questionnaireResponse));
      enqueueSnackbar('Invoicing settings saved', { variant: 'success' });
    } catch (error) {
      setSaveError(getApiError({ error, defaultError: 'Failed to save invoicing settings' }));
    }
  };
  const { ref: dueDaysRef, ...dueDaysField } = register('dueDaysFromGeneration', {
    valueAsNumber: true,
    validate: (value) => SaveInvoiceConfigBodySchema.shape.dueDaysFromGeneration.safeParse(value).success,
  });

  return (
    <Stack spacing={3}>
      <Box>
        <Typography variant="h4" color="primary.dark" fontWeight={600}>
          Invoicing Configuration
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
          Due date and default message templates for patient invoices.
        </Typography>
      </Box>
      {loadError ? (
        <Alert severity="error" action={<Button onClick={() => setLoadAttempt((value) => value + 1)}>Retry</Button>}>
          {loadError}
        </Alert>
      ) : !loaded ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
          <CircularProgress size={28} aria-label="Loading invoicing settings" />
        </Box>
      ) : (
        <Box
          component="form"
          noValidate
          onSubmit={handleSubmit(onSubmit)}
          sx={{
            bgcolor: 'background.paper',
            border: `1px solid ${otherColors.lightDivider}`,
            borderRadius: 2,
            p: 3,
          }}
        >
          <Stack component="fieldset" disabled={isSubmitting} spacing={3} sx={{ border: 0, p: 0, m: 0, minWidth: 0 }}>
            {saveError && <Alert severity="error">{saveError}</Alert>}
            <TextField
              {...dueDaysField}
              inputRef={dueDaysRef}
              label="Invoice Due Days"
              size="small"
              type="number"
              inputProps={{ min: 1, max: 365, step: 1 }}
              error={!!errors.dueDaysFromGeneration}
              helperText={
                errors.dueDaysFromGeneration
                  ? 'Enter a whole number from 1 to 365'
                  : 'Days until the invoice becomes due'
              }
              sx={{ width: 280, maxWidth: '100%' }}
              InputLabelProps={{ shrink: true }}
            />
            {(
              [
                ['defaultSmsTemplate', 'Default SMS Message Template'],
                ['defaultInvoiceMemo', 'Default Invoice Memo Template'],
              ] as const
            ).map(([name, label]) => (
              <Controller
                key={name}
                name={name}
                control={control}
                rules={{ validate: (value) => SaveInvoiceConfigBodySchema.shape[name].safeParse(value).success }}
                render={({ field, fieldState }) => (
                  <InvoiceTemplateField
                    label={label}
                    value={field.value}
                    onChange={field.onChange}
                    onBlur={field.onBlur}
                    inputRef={field.ref}
                    error={!!fieldState.error}
                    disabled={isSubmitting}
                    isSms={name === 'defaultSmsTemplate'}
                  />
                )}
              />
            ))}
            <Stack direction="row" spacing={1}>
              <Button type="submit" variant="contained" disabled={!isDirty || isSubmitting}>
                {isSubmitting ? 'Saving...' : 'Save changes'}
              </Button>
              <Button
                disabled={!isDirty || isSubmitting}
                onClick={() => {
                  reset();
                  setSaveError(null);
                }}
              >
                Reset
              </Button>
            </Stack>
          </Stack>
        </Box>
      )}
    </Stack>
  );
}
