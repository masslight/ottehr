import { FC } from 'react';
import { Box, Typography, useTheme } from '@mui/material';
import { getSelectors } from '../../../../../shared/store/getSelectors';
import { useAppointmentStore } from '../../../../state';

export const SurgicalHistoryContainer: FC = () => {
  const { chartData } = getSelectors(useAppointmentStore, ['chartData']);
  const theme = useTheme();

  const procedures = chartData?.procedures;
  const proceduresNote = chartData?.proceduresNote?.text;

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5, width: '100%' }}>
      <Typography variant="h5" color="primary.dark">
        Surgical history
      </Typography>
      {procedures?.length ? (
        procedures.map((procedure) => (
          <Typography key={procedure.resourceId}>
            {procedure.code} {procedure.display}
          </Typography>
        ))
      ) : (
        <Typography color={theme.palette.text.secondary}>No surgical history</Typography>
      )}
      <Typography>{proceduresNote}</Typography>
    </Box>
  );
};
