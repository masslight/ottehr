import ScannerIcon from '@mui/icons-material/Scanner';
import { Box, Dialog, DialogContent, DialogTitle, Typography } from '@mui/material';
import { FC } from 'react';

interface ScannerModalProps {
  open: boolean;
  onClose: () => void;
}

export const ScannerModal: FC<ScannerModalProps> = ({ open, onClose }) => {
  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <ScannerIcon />
          <Typography variant="h6">Scan Document</Typography>
        </Box>
      </DialogTitle>
      <DialogContent>
        <Box sx={{ padding: 2 }}>
          <Typography>Scanner interface will be built here.</Typography>
        </Box>
      </DialogContent>
    </Dialog>
  );
};
