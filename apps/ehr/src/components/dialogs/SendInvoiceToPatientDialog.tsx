import LoadingButton from '@mui/lab/LoadingButton';
import { Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, Grid, TextField } from '@mui/material';
import { useQuery } from '@tanstack/react-query';
import { ReactElement, useEffect } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { REQUIRED_FIELD_ERROR_MESSAGE } from 'utils';
import { z } from 'zod';
import { getPrefilledInvoiceInfo } from '../../api/api';
import { useApiClients } from '../../hooks/useAppClients';
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
  patientId?: string;
}

export default function SendInvoiceToPatientDialog({
  title,
  modalOpen,
  handleClose,
  onSubmit,
  submitButtonName,
  patientId,
}: SendInvoiceToPatientDialogProps): ReactElement {
  const { oystehrZambda } = useApiClients();
  const emailValidator = z.string().email();
  const phoneNumberValidator = z.string().regex(/^[0-9]{10}$/);
  // const [fieldsDisabled, setFieldsDisabled] = useState();

  const {
    control,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<SendInvoiceFormData>({
    mode: 'onBlur',
  });

  const { data: prefilledInvoice } = useQuery({
    queryKey: ['get-prefilled-invoice-info', patientId],
    queryFn: () => {
      if (oystehrZambda && patientId) return getPrefilledInvoiceInfo(oystehrZambda, { patientId });
      return undefined;
    },
    enabled: !!oystehrZambda && !!patientId,
  });

  useEffect(() => {
    if (prefilledInvoice) {
      reset({
        recipientName: prefilledInvoice.responsiblePartyName,
        recipientEmail: prefilledInvoice.responsiblePartyEmail,
        recipientPhoneNumber: prefilledInvoice.responsiblePartyPhoneNumber,
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
