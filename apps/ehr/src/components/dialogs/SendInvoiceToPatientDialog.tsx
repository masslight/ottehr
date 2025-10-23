import LoadingButton from '@mui/lab/LoadingButton';
import { Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, Grid, TextField } from '@mui/material';
import { enqueueSnackbar } from 'notistack';
import { ReactElement, useEffect } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { GetPrefilledInvoiceInfoZambdaOutput, REQUIRED_FIELD_ERROR_MESSAGE } from 'utils';
import { z } from 'zod';
import { BasicDatePicker } from '../form';

export interface SendInvoiceFormData {
  recipientName: string;
  recipientEmail: string;
  recipientPhoneNumber: string;
  dueDate: string;
  memo: string;
  smsTextMessage: string;
}

export interface SendPatientInvoiceOnSubmitProps {
  prefilledInfo: GetPrefilledInvoiceInfoZambdaOutput;
  oystEncounterId: string;
  patientId: string;
}

interface SendInvoiceToPatientDialogProps {
  title: string;
  modalOpen: boolean;
  handleClose: () => void;
  onSubmit: (props: SendPatientInvoiceOnSubmitProps) => Promise<void>;
  submitButtonName: string;
  patientId?: string;
  encounterId?: string;
  prefilledInvoice?: Partial<GetPrefilledInvoiceInfoZambdaOutput>;
}

export default function SendInvoiceToPatientDialog({
  title,
  modalOpen,
  handleClose,
  onSubmit,
  submitButtonName,
  patientId,
  encounterId,
  prefilledInvoice,
}: SendInvoiceToPatientDialogProps): ReactElement {
  const emailValidator = z.string().email();
  // const phoneNumberValidator = z.string().regex(/^[0-9]{10}$/);
  // const [fieldsDisabled, setFieldsDisabled] = useState();

  const handleSubmitWrapped = (data: SendInvoiceFormData): void => {
    console.log('submit here');
    if (!patientId) {
      enqueueSnackbar("Can't create invoice, patient id is required", { variant: 'error' });
      return;
    }
    if (!encounterId) {
      enqueueSnackbar("Can't create invoice, encounterId is required", { variant: 'error' });
      return;
    }
    const { recipientName, recipientEmail, recipientPhoneNumber, dueDate, memo, smsTextMessage } = data;
    void onSubmit({
      patientId,
      oystEncounterId: encounterId,
      prefilledInfo: {
        recipientName,
        recipientEmail,
        recipientPhoneNumber,
        dueDate,
        memo,
        smsTextMessage,
      },
    });
  };

  const {
    control,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<SendInvoiceFormData>({
    mode: 'onBlur',
  });

  useEffect(() => {
    if (prefilledInvoice) {
      reset({
        recipientName: prefilledInvoice.recipientName,
        recipientEmail: prefilledInvoice.recipientEmail,
        recipientPhoneNumber: prefilledInvoice.recipientPhoneNumber,
        dueDate: prefilledInvoice.dueDate,
        memo: prefilledInvoice.memo,
        smsTextMessage: prefilledInvoice.smsTextMessage,
      });
    }
  }, [prefilledInvoice, reset]);

  return (
    <Dialog open={modalOpen}>
      <Grid container direction="column" sx={{ marginBottom: 2 }} spacing={0.5}>
        <DialogTitle variant="h4" color="primary.dark">
          {title}
        </DialogTitle>

        <DialogContent sx={{ overflow: 'auto' }}>
          <Box component="form" id="send-invoice-form" onSubmit={handleSubmit(handleSubmitWrapped)} sx={{ mt: 2 }}>
            <Controller
              name="recipientName"
              control={control}
              rules={{
                required: REQUIRED_FIELD_ERROR_MESSAGE,
              }}
              render={({ field }) => (
                <TextField
                  {...field}
                  fullWidth
                  label="Recipient full name"
                  error={!!errors.recipientName}
                  helperText={errors.recipientName?.message}
                  required
                  sx={{ mb: 2 }}
                />
              )}
            />

            <Controller
              name="recipientEmail"
              control={control}
              rules={{
                required: REQUIRED_FIELD_ERROR_MESSAGE,
                validate: (value) => {
                  const result = emailValidator.safeParse(value);
                  return result.success || 'Invalid email format';
                },
              }}
              render={({ field }) => (
                <TextField
                  {...field}
                  fullWidth
                  label="Email address"
                  type="email"
                  error={!!errors.recipientEmail}
                  helperText={errors.recipientEmail?.message}
                  required
                  sx={{ mb: 2 }}
                />
              )}
            />

            <Controller
              name="recipientPhoneNumber"
              control={control}
              rules={{
                required: REQUIRED_FIELD_ERROR_MESSAGE,
                // validate: (value) => {
                //   const result = phoneNumberValidator.safeParse(value);
                //   return result.success || 'Invalid phone format';
                // },
              }}
              render={({ field }) => (
                <TextField
                  {...field}
                  fullWidth
                  label="Phone number"
                  error={!!errors.recipientPhoneNumber}
                  helperText={errors.recipientPhoneNumber?.message}
                  required
                  sx={{ mb: 2 }}
                />
              )}
            />

            <Box sx={{ mb: 2 }}>
              <BasicDatePicker
                name="dueDate"
                label="Due date"
                variant="outlined"
                control={control}
                rules={{ required: REQUIRED_FIELD_ERROR_MESSAGE }}
                component="Picker"
              />
            </Box>

            <Controller
              name="memo"
              control={control}
              rules={{
                required: REQUIRED_FIELD_ERROR_MESSAGE,
              }}
              render={({ field }) => (
                <TextField
                  {...field}
                  fullWidth
                  label="Memo"
                  error={!!errors.memo}
                  helperText={errors.memo?.message}
                  required
                  sx={{ mb: 2 }}
                />
              )}
            />

            <Controller
              name="smsTextMessage"
              control={control}
              rules={{
                required: REQUIRED_FIELD_ERROR_MESSAGE,
              }}
              render={({ field }) => (
                <TextField
                  {...field}
                  fullWidth
                  label="Sms text"
                  error={!!errors.smsTextMessage}
                  helperText={errors.smsTextMessage?.message}
                  required
                  sx={{ mb: 2 }}
                />
              )}
            />
          </Box>
        </DialogContent>

        <DialogActions>
          <Button variant="text" onClick={handleClose} size="medium">
            Cancel
          </Button>
          <LoadingButton
            disabled={isSubmitting}
            loading={isSubmitting}
            form="send-invoice-form"
            type="submit"
            variant="contained"
            color="primary"
          >
            {submitButtonName}
          </LoadingButton>
        </DialogActions>
      </Grid>
    </Dialog>
  );
}
