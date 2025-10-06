import { Box, Typography } from '@mui/material';
import { FC } from 'react';
import { useChartFields } from '../../../hooks/useChartFields';
import { PrescribedMedicationReviewItem } from './PrescribedMedicationReviewItem';

export const PrescribedMedicationsContainer: FC = () => {
  const { data: chartFields } = useChartFields({
    requestedFields: { prescribedMedications: {} },
  });

  const prescriptions = chartFields?.prescribedMedications;

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
