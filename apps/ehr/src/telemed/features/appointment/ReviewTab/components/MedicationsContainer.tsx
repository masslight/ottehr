import { FC } from 'react';
import { Box, Typography, useTheme } from '@mui/material';
import { getSelectors } from '../../../../../shared/store/getSelectors';
import { useAppointmentStore } from '../../../../state';

export const MedicationsContainer: FC = () => {
  const { chartData } = getSelectors(useAppointmentStore, ['chartData']);
  const theme = useTheme();

  const medications = chartData?.medications;

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5, width: '100%' }}>
      <Typography variant="h5" color="primary.dark">
        Medications
      </Typography>
      {medications?.length ? (
        medications.map((medication) => <Typography key={medication.resourceId}>{medication.name}</Typography>)
      ) : (
        <Typography color={theme.palette.text.secondary}>No current medications</Typography>
      )}
    </Box>
  );
};
