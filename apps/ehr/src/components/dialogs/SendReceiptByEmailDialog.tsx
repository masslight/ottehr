import { Box, TextField } from '@mui/material';
import { ReactElement, useEffect } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { z } from 'zod';
import { AppDialog } from './AppDialog';

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
    <AppDialog
      variant="form"
      size="s"
      open={modalOpen}
      onClose={handleClose}
      // This dialog never closed on Esc or a backdrop click, which would discard what was entered.
      disableOutsideClose
      title={title}
      onSubmit={(e) => {
        // The shell's form is `noValidate`; keep the browser's own check of the required fields.
        if (!e.currentTarget.reportValidity()) {
          e.preventDefault();
          return;
        }
        void handleSubmit(onSubmit)(e);
      }}
      primary={{ label: submitButtonName, loading: isSubmitting, disabled: isSubmitting }}
    >
      <Box sx={{ mt: 2 }}>
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
    </AppDialog>
  );
}
