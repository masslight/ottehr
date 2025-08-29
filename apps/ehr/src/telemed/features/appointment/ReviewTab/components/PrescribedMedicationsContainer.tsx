import { Box, Typography } from '@mui/material';
import { FC } from 'react';
import { useChartData } from '../../../../state';
import { PrescribedMedicationReviewItem } from './PrescribedMedicationReviewItem';

export const PrescribedMedicationsContainer: FC = () => {
  const { chartData } = useChartData();

  const prescriptions = chartData?.prescribedMedications;

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, width: '100%' }}>
      <Typography variant="h5" color="primary.dark">
        Prescriptions
      </Typography>
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75 }}>
        {prescriptions?.map((med) => (
          <PrescribedMedicationReviewItem medication={med} key={med.resourceId || med.name} />
        ))}
      </Box>
    </Box>
  );
};
