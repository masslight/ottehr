import { LoadingButton } from '@mui/lab';
import { Button, Dialog, DialogActions, DialogContent, DialogTitle, Typography } from '@mui/material';
import React, { ReactElement, useState } from 'react';

interface CancelExternalLabDialogProps {
  open: boolean;
  externalLabOrderTestType: string;
  onClose: () => void;
}

const CancelExternalLabDialog = ({
  open,
  onClose,
  externalLabOrderTestType,
}: CancelExternalLabDialogProps): ReactElement => {
  const [error, setError] = useState<boolean>(false);
  const [isCancelling, setIsCancelling] = useState(false);

  const handleCancelExternalLab = async (event: React.FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    setError(false);
    setIsCancelling(true);
    try {
      const response = await cancelExternalLab();
      console.log('Appointment cancelled successfully', response);
      onClose();
    } catch (error) {
      setError(true);
      console.error('Failed to cancel appointment', error);
    } finally {
      setIsCancelling(false);
    }
  };

  const buttonSx = {
    fontWeight: 500,
    textTransform: 'none',
    borderRadius: 6,
    mb: 2,
    ml: 1,
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      fullWidth
      disableScrollLock
      sx={{
        '.MuiPaper-root': {
          padding: 1,
          width: '444px',
          maxWidth: 'initial',
        },
      }}
    >
      <form onSubmit={(e) => handleCancelExternalLab(e)}>
        <DialogTitle variant="h4" color="primary.dark" sx={{ width: '100%' }}>
          Delete Send Out Labs Order
        </DialogTitle>
        <DialogContent>
          Are you sure you want to delete this order{' '}
          <Typography component="span" fontWeight="bold">
            "{externalLabOrderTestType}"
          </Typography>
          ?
        </DialogContent>
        <DialogActions sx={{ justifyContent: 'space-between', marginLeft: 1 }}>
          <Button onClick={onClose} variant="outlined" color="primary" size="medium" sx={buttonSx}>
            Keep
          </Button>
          <LoadingButton
            loading={isCancelling}
            type="submit"
            variant="contained"
            color="error"
            size="medium"
            sx={buttonSx}
          >
            Delete Order
          </LoadingButton>
        </DialogActions>
        {error && (
          <Typography color="error" variant="body2" my={1} mx={2}>
            There was an error cancelling this external lab order, please try again.
          </Typography>
        )}
      </form>
    </Dialog>
  );
};

// Replace with import to real cancel labs operation
export default CancelExternalLabDialog;
function cancelExternalLab(): Promise<void> {
  console.log('cancelExternalLab');
  return Promise.resolve();
}
