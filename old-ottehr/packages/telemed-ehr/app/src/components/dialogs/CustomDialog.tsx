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
  Typography,
} from '@mui/material';
import { LoadingButton } from '@mui/lab';

interface CustomDialogProps {
  open: boolean;
  handleClose: any;
  title: string;
  description: string | ReactElement;
  closeButtonText: string;
  closeButton?: boolean;
  handleConfirm?: any;
  confirmText?: string;
  confirmLoading?: boolean;
  error?: string;
}

export const CustomDialog: FC<CustomDialogProps> = ({
  open,
  handleClose,
  title,
  description,
  closeButton = true,
  closeButtonText,
  handleConfirm,
  confirmText,
  confirmLoading,
  error,
}) => {
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
      <DialogTitle
        variant="h5"
        color="secondary.main"
        sx={{ width: '80%', fontSize: '20px', color: theme.palette.primary.dark, fontWeight: '600 !important' }}
      >
        {title}
        {closeButton && (
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
        )}
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
      <DialogActions sx={{ justifyContent: 'start', px: 2 }}>
        {handleConfirm && (
          <LoadingButton
            loading={confirmLoading}
            variant="contained"
            onClick={handleConfirm}
            sx={{
              fontWeight: '700',
              borderRadius: '100px',
              mr: '8px',
              textTransform: 'none',
            }}
          >
            {confirmText}
          </LoadingButton>
        )}
        <Button
          variant={handleConfirm ? 'text' : 'contained'}
          onClick={handleClose}
          sx={{
            fontWeight: '700',
            borderRadius: '100px',
            textTransform: 'none',
          }}
        >
          {closeButtonText}
        </Button>
      </DialogActions>
      {error && (
        <Typography color="error" variant="body2" my={1} mx={2}>
          {error}
        </Typography>
      )}
    </Dialog>
  );
};
