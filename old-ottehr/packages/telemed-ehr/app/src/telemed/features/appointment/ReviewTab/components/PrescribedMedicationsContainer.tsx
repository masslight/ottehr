import { Box, Typography } from '@mui/material';
import { FC } from 'react';
import { getSelectors } from '../../../../../shared/store/getSelectors';
import { useAppointmentStore } from '../../../../state';
import { PrescribedMedicationReviewItem } from './PrescribedMedicationReviewItem';

export const PrescribedMedicationsContainer: FC = () => {
  const { chartData } = getSelectors(useAppointmentStore, ['chartData']);

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, width: '100%' }}>
      <Typography variant="h5" color="primary.dark">
        Prescriptions
      </Typography>
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75 }}>
        {chartData?.prescribedMedications?.map((med) => (
          <PrescribedMedicationReviewItem medication={med} key={med.resourceId || med.name} />
        ))}
      </Box>
    </Box>
  );
};
