import React, { FC } from 'react';
import {
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  IconButton,
  Typography,
  useTheme,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import { RoundedButton } from '../../../../components';
import { PropsWithChildren } from '../../../../../shared/types';

type GenerateExcuseDialogContainerProps = PropsWithChildren<{
  open: boolean;
  onClose: () => void;
  onSubmit: () => void;
  label: string;
}>;

export const GenerateExcuseDialogContainer: FC<GenerateExcuseDialogContainerProps> = (props) => {
  const { open, onClose, onSubmit, label, children } = props;

  const theme = useTheme();

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth scroll="paper">
      <DialogTitle component="div" sx={{ p: 3, pb: 2, display: 'flex', alignItems: 'flex-start' }}>
        <Typography variant="h4" color={theme.palette.primary.dark} sx={{ flex: 1 }}>
          {label}
        </Typography>
        <IconButton size="small" onClick={onClose}>
          <CloseIcon fontSize="small" />
        </IconButton>
      </DialogTitle>
      <Divider />

      <DialogContent
        sx={{
          p: 3,
        }}
      >
        {children}
      </DialogContent>

      <Divider />
      <DialogActions sx={{ py: 2, px: 3, display: 'flex', justifyContent: 'space-between' }}>
        <RoundedButton onClick={onClose}>Cancel</RoundedButton>
        <RoundedButton onClick={onSubmit} variant="contained">
          Generate note
        </RoundedButton>
      </DialogActions>
    </Dialog>
  );
};
