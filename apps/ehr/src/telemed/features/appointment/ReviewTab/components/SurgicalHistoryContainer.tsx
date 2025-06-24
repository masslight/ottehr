import { Box, Typography, useTheme } from '@mui/material';
import { FC } from 'react';
import { dataTestIds } from '../../../../../constants/data-test-ids';
import { getSelectors } from '../../../../../shared/store/getSelectors';
import { useAppointmentStore } from '../../../../state';

export const SurgicalHistoryContainer: FC = () => {
  const { chartData } = getSelectors(useAppointmentStore, ['chartData']);
  const theme = useTheme();

  const procedures = chartData?.surgicalHistory;
  const surgicalHistoryNote = chartData?.surgicalHistoryNote?.text;

  return (
    <Box
      sx={{ display: 'flex', flexDirection: 'column', gap: 0.5, width: '100%' }}
      data-testid={dataTestIds.telemedEhrFlow.reviewTabSurgicalHistoryContainer}
    >
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
      <Typography>{surgicalHistoryNote}</Typography>
    </Box>
  );
};
