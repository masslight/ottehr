import { Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, Grid, TextField } from '@mui/material';
import { ReactElement } from 'react';
import { Controller, useForm } from 'react-hook-form';

interface SendReceiptByEmailDialogProps {
  title: string;
  modalOpen: boolean;
  onClose: () => void;
  onSubmit: () => Promise<void>;
  submitButtonName: string;
  // loading: boolean;
}

interface SendReceiptFormData {
  recipientName: string;
  recipientEmail: string;
  subject: string;
}

export default function SendReceiptByEmailDialog({
  title,
  modalOpen,
  onClose,
  onSubmit: inputOnSubmit,
}: SendReceiptByEmailDialogProps): ReactElement {
  const {
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<SendReceiptFormData>({
    defaultValues: {
      recipientName: '',
      recipientEmail: '',
      subject: '',
    },
    mode: 'onBlur',
  });

  const onSubmit = async (data: SendReceiptFormData): Promise<void> => {
    try {
      console.log('Form data:', data);
      await inputOnSubmit();
    } catch (error) {
      console.error('Error submitting form:', error);
    }
  };

  return (
    <Dialog open={modalOpen} onClose={onClose}>
      <Grid container direction="column" sx={{ marginBottom: 2 }} spacing={0.5}>
        <DialogTitle variant="h4" color="primary.dark">
          ${title}
        </DialogTitle>

        <DialogContent sx={{ overflow: 'auto' }}>
          <Box component="form" onSubmit={handleSubmit(onSubmit)} sx={{ mt: 2 }}>
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
                required: 'Email is required',
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
          </Box>
        </DialogContent>

        <DialogActions>
          <Button type="submit" variant="contained" fullWidth disabled={isSubmitting} sx={{ mt: 2 }}>
            {isSubmitting ? 'Submitting...' : 'Submit'}
          </Button>
        </DialogActions>
      </Grid>
    </Dialog>
  );
}
