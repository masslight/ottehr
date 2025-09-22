import CloseIcon from '@mui/icons-material/Close';
import { Box, Dialog, DialogContent, DialogTitle, IconButton, Typography } from '@mui/material';
import { PatientSummaryTable } from './PatientSummaryTable';

interface PatientSummaryModalProps {
  open: boolean;
  onClose: () => void;
  patientId?: string;
  loading?: boolean;
}

export const PatientSummaryModal: React.FC<PatientSummaryModalProps> = ({
  open,
  onClose,
  patientId,
  loading = false,
}) => {
  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="xl"
      fullWidth
      sx={{
        '& .MuiDialog-paper': {
          borderRadius: 4,
          minHeight: '55vh',
          maxHeight: '70vh',
          boxShadow: '0px 6px 20px rgba(0,0,0,0.15)',
        },
      }}
    >
      <DialogTitle
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          borderColor: 'divider',
          pb: 2,
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <Typography variant="h4" color="primary.dark" sx={{ flexGrow: 1 }}>
            Communication Summary
          </Typography>
        </Box>
        <IconButton onClick={onClose} size="small">
          <CloseIcon />
        </IconButton>
      </DialogTitle>

      <DialogContent sx={{ pt: 3 }}>
        {loading ? (
          <Typography>Loading summary...</Typography>
        ) : patientId ? (
          <PatientSummaryTable />
        ) : (
          <Typography color="error">No patient data available</Typography>
        )}
      </DialogContent>
    </Dialog>
  );
};
