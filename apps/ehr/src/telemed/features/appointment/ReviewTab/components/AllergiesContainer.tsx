import { FC } from 'react';
import { Box, Typography } from '@mui/material';
import { getSelectors } from '../../../../../shared/store/getSelectors';
import { useAppointmentStore } from '../../../../state';

export const AllergiesContainer: FC = () => {
  const { chartData } = getSelectors(useAppointmentStore, ['chartData']);

  const allergies = chartData?.allergies?.filter((allergy) => allergy.current === true);

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5, width: '100%' }}>
      <Typography variant="h5" color="primary.dark">
        Allergies
      </Typography>
      {allergies?.map((allergy) => <Typography key={allergy.resourceId}>{allergy.name}</Typography>)}
    </Box>
  );
};
