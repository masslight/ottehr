import { FC, useState, ReactNode } from 'react';
import { Dialog, DialogTitle, DialogContent, DialogContentText, DialogActions, Typography } from '@mui/material';
import { RoundedButton } from './RoundedButton';

type ConfirmationDialogProps = {
  response: () => void;
  title: string;
  description?: string;
  children: (showDialog: () => void) => ReactNode;
  actionButtons?: {
    proceed?: {
      text?: string;
      color?: 'inherit' | 'primary' | 'secondary' | 'success' | 'error' | 'info' | 'warning';
    };
    back?: {
      text?: string;
      color?: 'inherit' | 'primary' | 'secondary' | 'success' | 'error' | 'info' | 'warning';
    };
  };
};

export const ConfirmationDialog: FC<ConfirmationDialogProps> = (props) => {
  const [open, setOpen] = useState(false);

  const showDialog = (): void => {
    setOpen(true);
  };

  const hideDialog = (): void => {
    setOpen(false);
  };

  const confirmRequest = (): void => {
    props.response();
    hideDialog();
  };

  return (
    <>
      {props.children(showDialog)}
      {open && (
        <Dialog open={open} onClose={hideDialog} maxWidth="xs" fullWidth>
          <DialogTitle component={Typography} variant="h5" color="primary.dark" sx={{ pb: 1 }}>
            {props.title}
          </DialogTitle>
          {props.description && (
            <DialogContent sx={{ pb: 2 }}>
              <DialogContentText>{props.description}</DialogContentText>
            </DialogContent>
          )}
          <DialogActions sx={{ display: 'flex', justifyContent: 'start', gap: 2, p: 3 }}>
            <RoundedButton
              onClick={confirmRequest}
              variant="contained"
              color={props?.actionButtons?.proceed?.color || 'primary'}
            >
              {props?.actionButtons?.proceed?.text || 'Proceed'}
            </RoundedButton>
            <RoundedButton onClick={hideDialog} color={props?.actionButtons?.back?.color || 'primary'}>
              {props?.actionButtons?.back?.text || 'Back'}
            </RoundedButton>
          </DialogActions>
        </Dialog>
      )}
    </>
  );
};
