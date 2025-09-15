import { Box, Modal, Typography } from '@mui/material';
import { FC } from 'react';
import { RoundedButton } from './RoundedButton';

interface ConfirmationModalProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  loading?: boolean;
}

export const ConfirmationModal: FC<ConfirmationModalProps> = ({
  open,
  onClose,
  onConfirm,
  title,
  message,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  loading = false,
}) => {
  return (
    <Modal open={open} onClose={onClose}>
      <Box
        sx={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          width: 500,
          bgcolor: 'background.paper',
          boxShadow: 24,
          p: 4,
          borderRadius: 2,
        }}
      >
        <Typography variant="h6" component="h2" gutterBottom>
          {title}
        </Typography>
        <Typography variant="body1" sx={{ mb: 3 }}>
          {message}
        </Typography>
        <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1 }}>
          <RoundedButton onClick={onConfirm} variant="contained" color="primary" disabled={loading}>
            {loading ? 'Loading...' : confirmText}
          </RoundedButton>
          <RoundedButton variant="outlined" onClick={onClose} disabled={loading}>
            {cancelText}
          </RoundedButton>
        </Box>
      </Box>
    </Modal>
  );
};
