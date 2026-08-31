import { LoadingButton } from '@mui/lab';
import { Button, Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle, useTheme } from '@mui/material';
import { MouseEventHandler, ReactElement } from 'react';

interface DeleteDialogProps {
  closeButtonText: string;
  handleClose: MouseEventHandler<HTMLButtonElement>;
  description: string | ReactElement;
  deleteButtonText: string;
  handleDelete: MouseEventHandler<HTMLButtonElement>;
  open: boolean;
  title: string;
  loadingDelete?: boolean;
}

export default function DeleteDialog({
  closeButtonText,
  handleClose,
  description,
  deleteButtonText,
  handleDelete,
  open,
  title,
  loadingDelete,
}: DeleteDialogProps): ReactElement {
  const theme = useTheme();
  const buttonSx = {
    fontWeight: 500,
    textTransform: 'none',
    borderRadius: 6,
  };

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      disableScrollLock
      sx={{
        '.MuiPaper-root': {
          padding: 2,
        },
      }}
    >
      <DialogTitle variant="h4" color="primary.dark" sx={{ width: '80%' }}>
        {title}
      </DialogTitle>
      <DialogContent>
        <DialogContentText
          sx={{
            color: theme.palette.text.primary,
          }}
        >
          {description}
        </DialogContentText>
      </DialogContent>
      <DialogActions>
        <Button variant="outlined" onClick={handleClose} size="medium" sx={buttonSx}>
          {closeButtonText}
        </Button>
        <LoadingButton
          variant="contained"
          onClick={handleDelete}
          size="medium"
          color="error"
          sx={buttonSx}
          loading={loadingDelete}
        >
          {deleteButtonText}
        </LoadingButton>
      </DialogActions>
    </Dialog>
  );
}
