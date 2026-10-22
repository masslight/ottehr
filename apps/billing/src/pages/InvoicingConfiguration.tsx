import { Alert, Box, Button, CircularProgress, Stack, TextField, Typography } from '@mui/material';
import { enqueueSnackbar } from 'notistack';
import { ReactElement, useEffect, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { parseInvoiceConfigFromQR } from 'utils/lib/helpers/rcm/invoice-config';
import { SaveInvoiceConfigBodySchema, SaveInvoiceConfigInput } from 'utils/lib/types/api/invoice-config.types';
import { getInvoiceConfig, saveInvoiceConfig } from '../api/api';
import { InvoiceTemplateField } from '../components/InvoiceTemplateField';
import { useApiClients } from '../hooks/useAppClients';

export default function InvoicingConfiguration(): ReactElement {
  const { oystehrZambda } = useApiClients();
  const [loaded, setLoaded] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [saveError, setSaveError] = useState(false);
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
    setLoadError(false);
    void getInvoiceConfig(oystehrZambda)
      .then((config) => {
        if (!active) return;
        reset(parseInvoiceConfigFromQR(config.questionnaireResponse));
        setLoaded(true);
      })
      .catch(() => {
        if (active) setLoadError(true);
      });
    return () => {
      active = false;
    };
  }, [oystehrZambda, loaded, loadAttempt, reset]);

  const onSubmit = async (values: SaveInvoiceConfigInput): Promise<void> => {
    if (!oystehrZambda) return;
    setSaveError(false);
    try {
      const config = await saveInvoiceConfig(oystehrZambda, values);
      reset(parseInvoiceConfigFromQR(config.questionnaireResponse));
      enqueueSnackbar('Invoicing settings saved', { variant: 'success' });
    } catch {
      setSaveError(true);
    }
  };
  const { ref: dueDaysRef, ...dueDaysField } = register('dueDaysFromGeneration', {
    valueAsNumber: true,
    validate: (value) => SaveInvoiceConfigBodySchema.shape.dueDaysFromGeneration.safeParse(value).success,
  });

  return (
    <Stack spacing={3}>
      <Typography variant="h4" color="primary.dark">
        Invoicing Configuration
      </Typography>
      {loadError ? (
        <Alert severity="error" action={<Button onClick={() => setLoadAttempt((value) => value + 1)}>Retry</Button>}>
          Failed to load invoicing settings.
        </Alert>
      ) : !loaded ? (
        <CircularProgress aria-label="Loading invoicing settings" />
      ) : (
        <Box
          component="form"
          noValidate
          onSubmit={handleSubmit(onSubmit)}
          sx={{ bgcolor: 'background.paper', p: 3, borderRadius: 2 }}
        >
          <Stack component="fieldset" disabled={isSubmitting} spacing={3} sx={{ border: 0, p: 0, m: 0, minWidth: 0 }}>
            {saveError && <Alert severity="error">Failed to save invoicing settings. Try again.</Alert>}
            <TextField
              {...dueDaysField}
              inputRef={dueDaysRef}
              label="Invoice Due Days"
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
                  setSaveError(false);
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
