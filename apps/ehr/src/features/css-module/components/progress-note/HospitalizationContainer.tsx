import { FC } from 'react';
import { Box, Typography } from '@mui/material';
import { getSelectors } from 'utils';
import { useAppointmentStore } from '../../../../telemed';

export const HospitalizationContainer: FC = () => {
  const { chartData } = getSelectors(useAppointmentStore, ['chartData']);

  const episodeOfCare = chartData?.episodeOfCare;

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5, width: '100%' }}>
      <Typography variant="h5" color="primary.dark">
        Hospitalization
      </Typography>
      {episodeOfCare?.map((item) => <Typography key={item.resourceId}>{item.display}</Typography>)}
    </Box>
  );
};
