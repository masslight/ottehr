import React, { MouseEventHandler, ReactElement } from 'react';
import { Button, Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle, useTheme } from '@mui/material';

interface DeleteDialogProps {
  closeButtonText: string;
  handleClose: MouseEventHandler<HTMLButtonElement>;
  description: string | ReactElement;
  deleteButtonText: string;
  handleDelete: MouseEventHandler<HTMLButtonElement>;
  open: boolean;
  title: string;
}

export default function DeleteDialog({
  closeButtonText,
  handleClose,
  description,
  deleteButtonText,
  handleDelete,
  open,
  title,
}: DeleteDialogProps): ReactElement {
  const theme = useTheme();
  const buttonSx = {
    fontWeight: '700',
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
        <Button variant="contained" onClick={handleDelete} size="medium" color="error" sx={buttonSx}>
          {deleteButtonText}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
