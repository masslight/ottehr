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
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { PROJECT_WEBSITE } from 'utils';
import i18n from '../lib/i18n';

export interface ErrorDialogConfig {
  title: string;
  description: string | ReactElement;
  closeButtonText?: string;
  id?: string;
}

const UnexpectedErrorDescriptionComponent: FC = () => {
  const { t } = useTranslation();

  return (
    <>
      {t('general.errors.unexpected.description')}{' '}
      <Link to={PROJECT_WEBSITE} target="_blank">
        {t('general.errors.unexpected.link')}
      </Link>
      .
    </>
  );
};

export const UnexpectedErrorDescription: ReactElement = <UnexpectedErrorDescriptionComponent />;

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
  closeButtonText,
  description,
  actionButtonText = i18n.t('general.button.continue'),
  afterOpen,
  handleContinue,
}) => {
  const theme = useTheme();
  const { t } = useTranslation();
  const isMobile = useMediaQuery(`(max-width: 480px)`);
  if (open) {
    afterOpen?.();
  }
  // if user uses google translate instead of language picker they could run into DOM tree issues for text nodes
  // https://github.com/facebook/react/issues/11538#issuecomment-390386520
  // <span></span> around the below text resolves issue
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
        <span>{title}</span>
        <IconButton
          aria-label={t('general.button.close')}
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
          data-testid="error-dialog-close-button"
          variant={handleContinue ? 'outlined' : 'contained'}
          onClick={handleClose}
          size={isMobile ? 'small' : 'large'}
          sx={{
            fontWeight: '700',
          }}
        >
          <span>{closeButtonText}</span>
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
            <span>{actionButtonText}</span>
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
};
