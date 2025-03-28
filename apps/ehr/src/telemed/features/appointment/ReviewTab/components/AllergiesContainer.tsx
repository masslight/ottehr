import { FC } from 'react';
import { Box, Typography } from '@mui/material';
import { getSelectors } from '../../../../../shared/store/getSelectors';
import { useAppointmentStore } from '../../../../state';
import { dataTestIds } from '../../../../../constants/data-test-ids';
export const AllergiesContainer: FC = () => {
  const { chartData } = getSelectors(useAppointmentStore, ['chartData']);

  const allergies = chartData?.allergies;

  return (
    <Box
      sx={{ display: 'flex', flexDirection: 'column', gap: 0.5, width: '100%' }}
      data-testid={dataTestIds.telemedEhrFlow.reviewTabKnownAllergiesContainer}
    >
      <Typography variant="h5" color="primary.dark">
        Allergies
      </Typography>
      {allergies?.map((allergy) => <Typography key={allergy.resourceId}>{allergy.name}</Typography>)}
    </Box>
  );
};
