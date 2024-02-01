import { FC, ReactElement } from 'react';
import { Close } from '@mui/icons-material';
import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  IconButton,
  useTheme,
} from '@mui/material';

interface ErrorDialogProps {
  open: boolean;
  handleClose: any;
  title: string;
  description: string | ReactElement;
  closeButtonText: string;
}

export const ErrorDialog: FC<ErrorDialogProps> = ({ open, handleClose, title, description, closeButtonText }) => {
  const theme = useTheme();

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
      <DialogTitle variant="h2" color="secondary.main" sx={{ width: '80%' }}>
        {title}
        <IconButton
          aria-label="Close"
          onClick={handleClose}
          sx={{
            position: 'absolute',
            right: 8,
            top: 8,
          }}
        >
          <Close />
        </IconButton>
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
        <Button
          variant="contained"
          onClick={handleClose}
          size="large"
          sx={{
            fontWeight: '700',
          }}
        >
          {closeButtonText}
        </Button>
      </DialogActions>
    </Dialog>
  );
};
