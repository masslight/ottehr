import LoadingButton from '@mui/lab/LoadingButton';
import { Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, Grid, TextField } from '@mui/material';
import { Task } from 'fhir/r4b';
import { enqueueSnackbar } from 'notistack';
import { ReactElement, useEffect } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { isPhoneNumberValid, parseInvoiceTaskInput, PrefilledInvoiceInfo, REQUIRED_FIELD_ERROR_MESSAGE } from 'utils';
import { z } from 'zod';
import { BasicDatePicker } from '../form';
import InputMask from '../InputMask';

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
  onSubmit: (taskId: string, prefilledInvoiceInfo: PrefilledInvoiceInfo) => Promise<void>;
  submitButtonName: string;
  invoiceTask?: Task;
}

export default function SendInvoiceToPatientDialog({
  title,
  modalOpen,
  handleClose,
  onSubmit,
  submitButtonName,
  invoiceTask,
}: SendInvoiceToPatientDialogProps): ReactElement {
  const emailValidator = z.string().email();

  const handleSubmitWrapped = (data: SendInvoiceFormData): void => {
    if (invoiceTask) {
      if (invoiceTask?.id) {
        void onSubmit(invoiceTask?.id, {
          recipientName: data.recipientName,
          recipientEmail: data.recipientEmail,
          recipientPhoneNumber: data.recipientPhoneNumber,
          dueDate: data.dueDate,
          memo: data.memo,
          smsTextMessage: data.smsTextMessage,
        });
      }
    } else enqueueSnackbar('Error sending invoice', { variant: 'error' });
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
    if (invoiceTask) {
      const invoiceTaskInput = parseInvoiceTaskInput(invoiceTask);
      if (invoiceTaskInput) {
        reset({
          recipientName: invoiceTaskInput.recipientName,
          recipientEmail: invoiceTaskInput.recipientEmail,
          recipientPhoneNumber: invoiceTaskInput.recipientPhoneNumber,
          dueDate: invoiceTaskInput.dueDate,
          memo: invoiceTaskInput.memo,
          smsTextMessage: invoiceTaskInput.smsTextMessage,
        });
      }
    }
  }, [invoiceTask, reset]);

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
              disabled
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
              disabled
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
              disabled
              rules={{
                validate: (value: string) => {
                  if (!value) return true;
                  return (
                    isPhoneNumberValid(value) ||
                    'Phone number must be 10 digits in the format (xxx) xxx-xxxx and a valid number'
                  );
                },
                required: REQUIRED_FIELD_ERROR_MESSAGE,
              }}
              render={({ field }) => (
                <TextField
                  {...field}
                  fullWidth
                  inputProps={{ mask: '(000) 000-0000' }}
                  InputProps={{
                    inputComponent: InputMask as any,
                  }}
                  label="Phone number"
                  error={!!errors.recipientPhoneNumber}
                  helperText={errors.recipientPhoneNumber?.message}
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
