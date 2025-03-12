import { LoadingButton } from '@mui/lab';
import { Button, Dialog, DialogActions, DialogContent, DialogTitle, Typography } from '@mui/material';
import { ReactElement } from 'react';

const buttonSx = {
  fontWeight: '700',
  textTransform: 'none',
  borderRadius: 6,
  mb: 2,
  ml: 1,
};

interface CancelExternalLabDialogProps {
  open: boolean;
  labOrderId: string;
  onClose: () => void;
  onConfirm: () => Promise<void>;
  isDeleting?: boolean;
  error?: string | null;
}

export const CancelExternalLabDialog = ({
  open,
  onClose,
  labOrderId,
  onConfirm,
  isDeleting = false,
  error = null,
}: CancelExternalLabDialogProps): ReactElement => {
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
      <form onSubmit={(e) => onConfirm(e)}>
        <DialogTitle variant="h4" color="primary.dark" sx={{ width: '100%' }}>
          Delete Send Out Labs Order
        </DialogTitle>
        <DialogContent>
          Are you sure you want to delete this order{' '}
          <Typography component="span" fontWeight="bold">
            "{labOrderId}"
          </Typography>
          ?
        </DialogContent>
        <DialogActions sx={{ justifyContent: 'space-between', marginLeft: 1 }}>
          <Button onClick={onClose} variant="outlined" color="primary" size="medium" sx={buttonSx}>
            Keep
          </Button>
          <LoadingButton
            loading={isDeleting}
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
            {error || 'There was an error deleting this external lab order, please try again.'}
          </Typography>
        )}
      </form>
    </Dialog>
  );
};
