import VisibilityOffIcon from '@mui/icons-material/VisibilityOff';
import { Box, Typography } from '@mui/material';
import { FC } from 'react';

// Same marker the Internal Notes modal uses, for note sections that are shown to staff on
// Review & Sign but never printed on the patient-facing documents.
export const NotVisibleToPatientLabel: FC = () => (
  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
    <VisibilityOffIcon color="primary" fontSize="small" />
    <Typography variant="body2" color="text.secondary">
      Not visible to the patient
    </Typography>
  </Box>
);
