import LoadingButton from '@mui/lab/LoadingButton';
import { Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, Grid, TextField } from '@mui/material';
import { ReactElement, useEffect } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { REQUIRED_FIELD_ERROR_MESSAGE } from 'utils';
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

interface SendInvoiceToPatientDialogProps {
  title: string;
  modalOpen: boolean;
  handleClose: () => void;
  onSubmit: (sendReceiptFormData: SendInvoiceFormData) => Promise<void>;
  submitButtonName: string;
  defaultValues?: Partial<SendInvoiceFormData>;
}

export default function SendInvoiceToPatientDialog({
  title,
  modalOpen,
  handleClose,
  onSubmit,
  defaultValues,
  submitButtonName,
}: SendInvoiceToPatientDialogProps): ReactElement {
  const emailValidator = z.string().email();
  const phoneNumberValidator = z.string().regex(/^[0-9]{10}$/);
  const {
    control,
    handleSubmit,
    setValue,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<SendInvoiceFormData>({
    defaultValues: {
      recipientName: defaultValues?.recipientName ?? '',
      recipientEmail: defaultValues?.recipientEmail ?? '',
    },
    mode: 'onBlur',
  });
  useEffect(() => {
    if (!isDirty) {
      if (defaultValues?.recipientName) {
        setValue('recipientName', defaultValues.recipientName);
      }
      if (defaultValues?.recipientEmail) {
        setValue('recipientEmail', defaultValues.recipientEmail);
      }
    }
  }, [defaultValues, setValue, isDirty]);

  return (
    <Dialog open={modalOpen}>
      <Grid container direction="column" sx={{ marginBottom: 2 }} spacing={0.5}>
        <DialogTitle variant="h4" color="primary.dark">
          {title}
        </DialogTitle>

        <DialogContent sx={{ overflow: 'auto' }}>
          <Box component="form" id="send-invoice-form" onSubmit={handleSubmit(onSubmit)} sx={{ mt: 2 }}>
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
                validate: (value) => {
                  const result = phoneNumberValidator.safeParse(value);
                  return result.success || 'Invalid phone format';
                },
              }}
              render={({ field }) => (
                <TextField
                  {...field}
                  fullWidth
                  label="Phone number"
                  error={!!errors.recipientEmail}
                  helperText={errors.recipientEmail?.message}
                  required
                  sx={{ mb: 2 }}
                />
              )}
            />

            <Controller
              name="dueDate"
              control={control}
              rules={{
                required: 'Due date is required',
              }}
              render={({ field }) => (
                <BasicDatePicker
                  {...field}
                  name="Due date"
                  variant="outlined"
                  control={control}
                  rules={{ required: REQUIRED_FIELD_ERROR_MESSAGE }}
                  component="Field"
                />
              )}
            />

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
