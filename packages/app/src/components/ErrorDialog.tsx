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
import { FC, ReactElement } from 'react';
import { useTranslation } from 'react-i18next';

interface props {
  closeButtonText: string;
  description: string | ReactElement;
  handleClose: any;
  open: boolean;
  title: string;
}

export const ErrorDialog: FC<props> = ({ closeButtonText, description, handleClose, open, title }) => {
  const theme = useTheme();
  const { t } = useTranslation();

  return (
    <Dialog
      disableScrollLock
      onClose={handleClose}
      open={open}
      sx={{
        '.MuiPaper-root': {
          p: 2,
        },
      }}
    >
      <DialogTitle color="secondary.main" variant="h2" sx={{ width: '80%' }}>
        {title}
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
      <DialogActions>
        <Button
          onClick={handleClose}
          size="large"
          variant="contained"
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
