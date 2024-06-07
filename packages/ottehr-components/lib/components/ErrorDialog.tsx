import { Close } from '@mui/icons-material';
import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  IconButton,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import { FC, ReactElement } from 'react';
import { Link } from 'react-router-dom';

export interface ErrorDialogConfig {
  title: string;
  description: string | ReactElement;
  closeButtonText?: string;
  id?: string;
}

export const UnexpectedErrorDescription: ReactElement = (
  <>
    There was an unexpected error. Please try again and if the error persists{' '}
    <Link to="https://ottehr.com" target="_blank">
      contact us
    </Link>
    .
  </>
);

interface ErrorDialogProps {
  open: boolean;
  handleClose: any;
  title: string;
  description: string | ReactElement;
  closeButtonText: string;
  afterOpen?: () => void;
  actionButtonText?: string;
  handleContinue?: () => void;
}

export const ErrorDialog: FC<ErrorDialogProps> = ({
  open,
  handleClose,
  title,
  description,
  actionButtonText = 'Continue',
  closeButtonText,
  afterOpen,
  handleContinue,
}) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(`(max-width: 480px)`);
  if (open) {
    afterOpen?.();
  }

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
      <DialogActions
        sx={{
          justifyContent: `${handleContinue ? 'space-between' : 'end'}`,
          display: isMobile ? 'contents' : 'flex',
          marginLeft: isMobile ? 0 : 'initial',
        }}
      >
        <Button
          variant={handleContinue ? 'outlined' : 'contained'}
          onClick={handleClose}
          size={isMobile ? 'small' : 'large'}
          sx={{
            fontWeight: '700',
          }}
        >
          {closeButtonText}
        </Button>
        {handleContinue && (
          <Button
            variant="contained"
            onClick={handleContinue}
            size={isMobile ? 'small' : 'large'}
            sx={{
              fontWeight: '700',
              marginTop: isMobile ? 1 : 0,
              marginLeft: isMobile ? '0 !important' : 1,
            }}
          >
            {actionButtonText}
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
};
