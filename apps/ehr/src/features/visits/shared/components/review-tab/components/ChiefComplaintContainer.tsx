import { Box, Typography } from '@mui/material';
import { FC } from 'react';
import { dataTestIds } from 'src/constants/data-test-ids';
import { getSpentTime, isTelemedAppointment } from 'utils';
import { useChartFields } from '../../../hooks/useChartFields';
import { useAppointmentData, useChartData } from '../../../stores/appointment/appointment.store';

export const ChiefComplaintContainer: FC = () => {
  const { encounter, appointment } = useAppointmentData();
  const { chartData } = useChartData();

  const { data: chartFields } = useChartFields({
    requestedFields: {
      historyOfPresentIllness: {
        _tag: 'history-of-present-illness',
      },
    },
  });

  const chiefComplaint = chartFields?.historyOfPresentIllness?.text;
  const addToVisitNote = chartData?.addToVisitNote?.value;
  const spentTime = getSpentTime(encounter.statusHistory);

  return (
    <Box
      sx={{ display: 'flex', flexDirection: 'column', gap: 0.5, width: '100%' }}
      data-testid={dataTestIds.telemedEhrFlow.reviewTabChiefComplaintContainer}
    >
      <Typography variant="h5" color="primary.dark">
        Additional information
      </Typography>
      <Typography>{chiefComplaint}</Typography>
      {isTelemedAppointment(appointment) && addToVisitNote && spentTime && (
        <Typography variant="body2" color="secondary.light">
          Provider spent {spentTime} minutes on real-time audio & video with this patient
        </Typography>
      )}
    </Box>
  );
};
