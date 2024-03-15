import { ReactElement } from 'react';
import { Box, Dialog, IconButton, Paper, Typography } from '@mui/material';
import { Close } from '@mui/icons-material';
import { LoadingButton } from '@mui/lab';

interface EditPatientInfoDialogProps {
  title: string;
  modalOpen: boolean;
  onClose: () => void;
  input: ReactElement;
  onSubmit: (e: React.FormEvent<HTMLFormElement>) => Promise<void>;
  submitButtonName: string;
  loading: boolean;
  error?: boolean;
  errorMessage?: string;
}

export default function EditPatientInfoDialog({
  title,
  modalOpen,
  onClose,
  input,
  onSubmit,
  submitButtonName,
  loading,
  error,
  errorMessage,
}: EditPatientInfoDialogProps): ReactElement {
  return (
    <Dialog open={modalOpen} onClose={onClose}>
      <Paper>
        <Box maxWidth="sm">
          <Box sx={{ display: 'flex', justifyContent: 'flex-end', paddingTop: '16px', paddingRight: '16px' }}>
            <IconButton aria-label="Close" onClick={onClose}>
              <Close />
            </IconButton>
          </Box>
          <Box margin={'0 40px 40px 40px'}>
            <form onSubmit={onSubmit}>
              <Typography sx={{ width: '100%' }} variant="h4" color="primary.main">
                {title}
              </Typography>
              <Box sx={{ my: '24px' }}>{input}</Box>
              <Box
                sx={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'flex-end',
                }}
              >
                {error && (
                  <Typography color="error" variant="body2" mb={2}>
                    {errorMessage}
                  </Typography>
                )}
                <LoadingButton
                  sx={{
                    borderRadius: 100,
                    textTransform: 'none',
                    fontWeight: 600,
                  }}
                  variant="contained"
                  type="submit"
                  loading={loading}
                >
                  {submitButtonName}
                </LoadingButton>
              </Box>
            </form>
          </Box>
        </Box>
      </Paper>
    </Dialog>
  );
}
