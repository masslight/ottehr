import CloseIcon from '@mui/icons-material/Close';
import {
  Alert,
  Box,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Grid,
  IconButton,
  Skeleton,
  TextField,
  Typography,
} from '@mui/material';
import { useEditor } from '@tiptap/react';
import { DateTime } from 'luxon';
import { enqueueSnackbar } from 'notistack';
import { ReactElement, useEffect, useMemo, useRef, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { TemplateEditorField, textToTiptapContent } from 'src/components/template-editor-field/TemplateEditorField';
import { useGetInvoiceConfigQuery } from 'src/rcm/state/invoice-config/invoice-config.queries';
import {
  BRANDING_CONFIG,
  buildInvoicePlaceholders,
  InvoiceablePatientReport,
  InvoiceTaskInput,
  parseInvoiceConfigFromQR,
  parseInvoiceTaskInput,
  REQUIRED_FIELD_ERROR_MESSAGE,
} from 'utils';
import { BasicDatePicker } from '../form';
import { RoundedButton } from '../RoundedButton';

// ---------------------------------------------------------------------------
// Form types
// ---------------------------------------------------------------------------

export interface SendInvoiceFormData {
  amount: number;
  dueDate: string;
  memo: string;
  smsTextMessage: string;
}

interface SendInvoiceToPatientDialogProps {
  title: string;
  modalOpen: boolean;
  handleClose: () => void;
  onSubmit: (taskId: string, prefilledInvoiceInfo: InvoiceTaskInput) => Promise<void>;
  submitButtonName: string;
  report?: InvoiceablePatientReport;
}

// ---------------------------------------------------------------------------
// Main dialog
// ---------------------------------------------------------------------------

export default function SendInvoiceToPatientDialog({
  title,
  modalOpen,
  handleClose,
  onSubmit,
  submitButtonName,
  report,
}: SendInvoiceToPatientDialogProps): ReactElement {
  const [disableAllFields, setDisableAllFields] = useState(true);
  const { data: configData } = useGetInvoiceConfigQuery();

  const {
    control,
    watch,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<SendInvoiceFormData>({
    mode: 'onBlur',
  });

  const { visitDate, location, patient, task, responsibleParty } = report ?? {};

  const smsEditorRef = useRef<ReturnType<typeof useEditor> | null>(null);
  const memoEditorRef = useRef<ReturnType<typeof useEditor> | null>(null);

  // Build preview values from real report data + current form values
  const previewValues = useMemo<Record<string, string>>(() => {
    const amount = watch('amount');
    const dueDate = watch('dueDate');
    const PLACEHOLDER_FALLBACKS: Record<string, string> = {
      'patient-full-name': '[Patient Name]',
      location: '[Location]',
      'visit-date': '[Visit Date]',
      'due-date': '[Due Date]',
      amount: '[Amount]',
      'invoice-link': 'https://example.com/invoice-link',
      'patient-portal-link': 'https://example.com/patient-portal',
    };
    return buildInvoicePlaceholders(
      {
        patientFullName: patient?.fullName,
        clinic: BRANDING_CONFIG.projectName,
        location: location ?? undefined,
        visitDate: visitDate ?? undefined,
        dueDate: dueDate ?? undefined,
        amountCents: amount ? Math.round(Number(amount) * 100) : undefined,
      },
      PLACEHOLDER_FALLBACKS
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [patient?.fullName, location, visitDate, watch('amount'), watch('dueDate')]);

  // Pre-fill form when task data + config arrive
  useEffect(() => {
    if (!task) return;
    try {
      const invoiceTaskInput = parseInvoiceTaskInput(task);
      if (!invoiceTaskInput) return;

      const config = parseInvoiceConfigFromQR(configData?.questionnaireResponse);

      const { amountCents } = invoiceTaskInput;
      const dueDays = config.dueDaysFromGeneration;
      const dueDate = DateTime.now().plus({ days: dueDays }).toISODate();
      const smsTemplate = config.defaultSmsTemplate;
      const memoTemplate = config.defaultInvoiceMemo;

      reset({
        amount: (amountCents ?? 0) / 100,
        dueDate: dueDate,
        memo: memoTemplate,
        smsTextMessage: smsTemplate,
      });

      // Sync Tiptap editors
      smsEditorRef.current?.commands.setContent(textToTiptapContent(smsTemplate));
      memoEditorRef.current?.commands.setContent(textToTiptapContent(memoTemplate));

      setDisableAllFields(false);
    } catch {
      /* empty */
    }
  }, [task, reset, configData]);

  const handleSubmitWrapped = (data: SendInvoiceFormData): void => {
    if (task && task?.id) {
      setDisableAllFields(true);
      void onSubmit(task.id, {
        dueDate: data.dueDate,
        memo: data.memo,
        smsTextMessage: data.smsTextMessage,
        amountCents: Math.round(data.amount * 100),
      });
    } else enqueueSnackbar('Error sending invoice', { variant: 'error' });
  };

  return (
    <Dialog open={modalOpen} maxWidth="md" fullWidth>
      <IconButton onClick={() => handleClose()} size="medium" sx={{ position: 'absolute', right: 12, top: 12 }}>
        <CloseIcon fontSize="medium" sx={{ color: '#938B7D' }} />
      </IconButton>

      <Grid container direction="column" sx={{ padding: 1 }} spacing={0.5}>
        <DialogTitle variant="h4" color="primary.dark">
          {title}
        </DialogTitle>

        <DialogContent>
          {report !== undefined ? (
            <Box>
              <Box>
                <Typography variant="subtitle2" color="text.secondary">
                  Patient
                </Typography>
                <Typography sx={{ fontWeight: 600, mb: 0.5 }}>{patient?.fullName}</Typography>
                <Box sx={{ flexDirection: 'row', display: 'flex' }}>
                  <Typography variant="body2">{patient?.dob}</Typography>
                  <Typography variant="body2" sx={{ pl: 2 }}>
                    {patient?.gender}
                  </Typography>
                  <Typography variant="body2" sx={{ pl: 2 }}>
                    {patient?.phoneNumber}
                  </Typography>
                </Box>
              </Box>

              <Box sx={{ mt: 2, mb: 3 }}>
                <Typography variant="subtitle2" color="text.secondary">
                  Responsible party name
                </Typography>
                <Typography sx={{ fontWeight: 600, mb: 0.5 }}>{responsibleParty?.fullName}</Typography>
                <Box sx={{ flexDirection: 'row', display: 'flex' }}>
                  {responsibleParty?.email ? (
                    <Typography variant="body2">{responsibleParty.email}</Typography>
                  ) : (
                    <Typography variant="body2" color="text.disabled">
                      Doesn&apos;t have email
                    </Typography>
                  )}
                  <Typography variant="body2" sx={{ pl: 2 }}>
                    {responsibleParty?.phoneNumber}
                  </Typography>
                </Box>
              </Box>
            </Box>
          ) : (
            <Skeleton variant="rectangular" animation="wave" />
          )}

          <Grid
            component="form"
            id="send-invoice-form"
            container
            spacing={2}
            onSubmit={handleSubmit(handleSubmitWrapped)}
          >
            <Grid item xs={12} sm={6}>
              <Controller
                name="amount"
                control={control}
                rules={{
                  required: REQUIRED_FIELD_ERROR_MESSAGE,
                  min: { value: 0.01, message: 'Amount must be greater than 0' },
                }}
                render={({ field }) => (
                  <TextField
                    {...field}
                    fullWidth
                    type="number"
                    label="Amount, $"
                    error={!!errors.amount}
                    helperText={errors.amount?.message}
                    required
                    disabled={disableAllFields}
                  />
                )}
              />
            </Grid>

            <Grid item xs={12} sm={6}>
              <BasicDatePicker
                name="dueDate"
                label="Due date"
                variant="outlined"
                control={control}
                rules={{ required: REQUIRED_FIELD_ERROR_MESSAGE }}
                component="Picker"
                disabled={disableAllFields}
                disablePast={true}
              />
            </Grid>

            <Grid item xs={12}>
              <Controller
                name="smsTextMessage"
                control={control}
                rules={{ required: REQUIRED_FIELD_ERROR_MESSAGE }}
                disabled={disableAllFields}
                render={({ field, fieldState }) => (
                  <TemplateEditorField
                    label="SMS message"
                    value={field.value ?? ''}
                    onChange={field.onChange}
                    editorRef={smsEditorRef}
                    previewValues={previewValues}
                    disabled={disableAllFields}
                    required
                    error={!!fieldState.error}
                    helperText={fieldState.error?.message}
                  />
                )}
              />
            </Grid>

            <Grid item xs={12}>
              <Controller
                name="memo"
                control={control}
                rules={{ required: REQUIRED_FIELD_ERROR_MESSAGE }}
                disabled={disableAllFields}
                render={({ field, fieldState }) => (
                  <TemplateEditorField
                    label="Invoice memo"
                    value={field.value ?? ''}
                    onChange={field.onChange}
                    editorRef={memoEditorRef}
                    previewValues={previewValues}
                    disabled={disableAllFields}
                    required
                    error={!!fieldState.error}
                    helperText={fieldState.error?.message}
                  />
                )}
              />
            </Grid>
          </Grid>
        </DialogContent>

        {!responsibleParty?.email && (
          <Alert severity="error" sx={{ mx: 3, mb: 1 }}>
            Invoice cannot be sent — the responsible party does not have an email address on file.
          </Alert>
        )}

        <DialogActions>
          <Box
            sx={{
              display: 'flex',
              flexDirection: 'row',
              justifyContent: 'space-between',
              width: '100%',
              marginX: 2,
              mb: 1,
            }}
          >
            <RoundedButton variant="outlined" onClick={handleClose} size="medium">
              Cancel
            </RoundedButton>
            <RoundedButton
              disabled={disableAllFields || !responsibleParty?.email}
              loading={isSubmitting}
              form="send-invoice-form"
              type="submit"
              variant="contained"
              color="primary"
            >
              {submitButtonName}
            </RoundedButton>
          </Box>
        </DialogActions>
      </Grid>
    </Dialog>
  );
}
