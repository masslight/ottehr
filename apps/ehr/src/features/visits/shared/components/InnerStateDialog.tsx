import CloseIcon from '@mui/icons-material/Close';
import { Dialog, DialogActions, DialogContent, DialogProps, DialogTitle, IconButton, Typography } from '@mui/material';
import React, { FC, ReactNode, useState } from 'react';

type InnerStateDialogProps = {
  children: (showDialog: () => void) => ReactNode;
  title?: ReactNode | string;
  actions?: ((hideDialog: () => void) => ReactNode) | ReactNode;
  content?: ReactNode;
  DialogProps?: Omit<DialogProps, 'open' | 'onClose'>;
  showCloseButton?: boolean;
};

export const InnerStateDialog: FC<InnerStateDialogProps> = (props) => {
  const { children, title, actions, content, DialogProps, showCloseButton } = props;

  const [open, setOpen] = useState(false);

  const showDialog = (): void => {
    setOpen(true);
  };

  const hideDialog = (): void => {
    setOpen(false);
  };

  return (
    <>
      {children(showDialog)}
      {open && (
        <Dialog fullWidth {...DialogProps} open={open} onClose={hideDialog}>
          {showCloseButton && (
            <IconButton
              onClick={hideDialog}
              size="small"
              sx={{
                position: 'absolute',
                right: 16,
                top: 16,
              }}
            >
              <CloseIcon fontSize="small" />
            </IconButton>
          )}

          {title ? (
            typeof title === 'string' ? (
              <DialogTitle component={Typography} variant="h5" color="primary.dark" sx={{ pb: 1 }}>
                {title}
              </DialogTitle>
            ) : (
              title
            )
          ) : null}

          {content && <DialogContent sx={{ pb: 2 }}>{content}</DialogContent>}

          {actions && (
            <DialogActions sx={{ p: 3 }}>{typeof actions === 'function' ? actions(hideDialog) : actions}</DialogActions>
          )}
        </Dialog>
      )}
    </>
  );
};
