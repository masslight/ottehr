import { Close } from '@mui/icons-material';
import { LoadingButton } from '@mui/lab';
import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  IconButton,
  Typography,
  useTheme,
} from '@mui/material';
import { FC, ReactElement } from 'react';
import { dataTestIds } from '../../constants/data-test-ids';

export interface CustomDialogProps {
  open: boolean;
  handleClose: (...args: any[]) => any;
  title: string | ReactElement;
  description: string | ReactElement;
  closeButtonText: string;
  closeButton?: boolean;
  handleConfirm?: any;
  confirmText?: string;
  confirmLoading?: boolean;
  error?: string;
  disabled?: boolean;
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
  disabled,
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
        sx={{ width: '100%', fontSize: '20px', color: theme.palette.primary.dark, fontWeight: '600 !important' }}
        data-testid={dataTestIds.dialog.title}
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
            data-testid={dataTestIds.dialog.closeButton}
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
            disabled={disabled}
            loading={confirmLoading}
            variant="contained"
            onClick={handleConfirm}
            sx={{
              fontWeight: 500,
              borderRadius: '100px',
              mr: '8px',
              textTransform: 'none',
            }}
            data-testid={dataTestIds.dialog.proceedButton}
          >
            {confirmText}
          </LoadingButton>
        )}
        <Button
          variant={handleConfirm ? 'text' : 'contained'}
          onClick={handleClose}
          sx={{
            fontWeight: 500,
            borderRadius: '100px',
            textTransform: 'none',
          }}
          data-testid={dataTestIds.dialog.cancelButton}
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
