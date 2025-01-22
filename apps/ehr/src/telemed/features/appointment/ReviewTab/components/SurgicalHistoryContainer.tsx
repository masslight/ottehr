import { FC } from 'react';
import { Box, Typography } from '@mui/material';
import { getSelectors } from '../../../../../shared/store/getSelectors';
import { useAppointmentStore } from '../../../../state';

export const SurgicalHistoryContainer: FC = () => {
  const { chartData } = getSelectors(useAppointmentStore, ['chartData']);

  const procedures = chartData?.procedures;
  const proceduresNote = chartData?.proceduresNote?.text;

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5, width: '100%' }}>
      <Typography variant="h5" color="primary.dark">
        Surgical history
      </Typography>
      {procedures!.map((procedure) => (
        <Typography key={procedure.resourceId}>
          {procedure.code} {procedure.display}
        </Typography>
      ))}
      <Typography>{proceduresNote}</Typography>
    </Box>
  );
};
