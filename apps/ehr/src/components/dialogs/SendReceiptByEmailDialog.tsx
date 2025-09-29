import LoadingButton from '@mui/lab/LoadingButton';
import { Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, Grid, TextField } from '@mui/material';
import { ReactElement, useEffect } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { z } from 'zod';

export interface SendReceiptFormData {
  recipientName: string;
  recipientEmail: string;
}

interface SendReceiptByEmailDialogProps {
  title: string;
  modalOpen: boolean;
  handleClose: () => void;
  onSubmit: (sendReceiptFormData: SendReceiptFormData) => Promise<void>;
  submitButtonName: string;
  defaultValues?: Partial<SendReceiptFormData>;
}

export default function SendReceiptByEmailDialog({
  title,
  modalOpen,
  handleClose,
  onSubmit,
  defaultValues,
  submitButtonName,
}: SendReceiptByEmailDialogProps): ReactElement {
  const emailValidator = z.string().email();
  const {
    control,
    handleSubmit,
    setValue,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<SendReceiptFormData>({
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
          <Box component="form" id="send-receipt-form" onSubmit={handleSubmit(onSubmit)} sx={{ mt: 2 }}>
            <Controller
              name="recipientName"
              control={control}
              rules={{
                required: 'Name is required',
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
                required: 'Email is required',
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
          </Box>
        </DialogContent>

        <DialogActions>
          <Button variant="text" onClick={handleClose} size="medium">
            Cancel
          </Button>
          <LoadingButton
            disabled={isSubmitting}
            loading={isSubmitting}
            form="send-receipt-form"
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
