import { Box, Button, Dialog, Paper, TextField, Typography } from '@mui/material';
import { ReactElement } from 'react';
import { Controller, useForm } from 'react-hook-form';

interface SendReceiptByEmailDialogProps {
  title: string;
  modalOpen: boolean;
  onClose: () => void;
  onSubmit: () => Promise<void>;
  submitButtonName: string;
  loading: boolean;
}

export default function EditPatientInfoDialog({
  modalOpen,
  onClose,
  onSubmit: inputOnSubmit,
}: SendReceiptByEmailDialogProps): ReactElement {
  const {
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({
    defaultValues: {
      recipientName: '',
      recipientEmail: '',
      subject: '',
    },
    mode: 'onBlur',
  });

  const onSubmit = async (data: FormData): Promise<void> => {
    try {
      console.log('Form data:', data);
      // Your submit logic here

      await inputOnSubmit();
    } catch (error) {
      console.error('Error submitting form:', error);
    }
  };

  return (
    <Dialog open={modalOpen} onClose={onClose}>
      <Paper>
        <Typography variant="h5" gutterBottom>
          Controlled Form
        </Typography>

        <Box component="form" onSubmit={handleSubmit(onSubmit)} sx={{ mt: 2 }}>
          <Controller
            name="recipientName"
            control={control}
            rules={{
              required: 'First name is required',
            }}
            render={({ field }) => (
              <TextField
                {...field}
                fullWidth
                label="First Name"
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
              required: 'Last name is required',
            }}
            render={({ field }) => (
              <TextField
                {...field}
                fullWidth
                label="Last Name"
                error={!!errors.recipientEmail}
                helperText={errors.recipientEmail?.message}
                required
                sx={{ mb: 2 }}
              />
            )}
          />

          <Controller
            name="subject"
            control={control}
            rules={{
              required: 'Email is required',
              pattern: {
                value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
                message: 'Please enter a valid email address',
              },
            }}
            render={({ field }) => (
              <TextField
                {...field}
                fullWidth
                label="Email"
                type="email"
                error={!!errors.subject}
                helperText={errors.subject?.message}
                required
                sx={{ mb: 3 }}
              />
            )}
          />

          <Button type="submit" variant="contained" fullWidth disabled={isSubmitting} sx={{ mt: 2 }}>
            {isSubmitting ? 'Submitting...' : 'Submit'}
          </Button>
        </Box>
      </Paper>
    </Dialog>
  );
}
