import { Box, Typography } from '@mui/material';
import { FC } from 'react';
import { dataTestIds } from 'src/constants/data-test-ids';
import { useAppointmentData, useChartData } from 'src/shared/hooks/appointment/appointment.store';
import { useChartFields } from 'src/shared/hooks/appointment/useChartFields';
import { getSpentTime } from 'utils';
import { useAppFlags } from '../../../shared/contexts/useAppFlags';

export const ChiefComplaintContainer: FC = () => {
  const { encounter } = useAppointmentData();
  const { chartData } = useChartData();

  const { data: chartFields } = useChartFields({
    requestedFields: {
      chiefComplaint: {
        _tag: 'chief-complaint',
      },
    },
  });

  const { isInPerson: inPerson } = useAppFlags();
  const chiefComplaint = chartFields?.chiefComplaint?.text;
  const addToVisitNote = chartData?.addToVisitNote?.value;
  const spentTime = getSpentTime(encounter.statusHistory);

  return (
    <Box
      sx={{ display: 'flex', flexDirection: 'column', gap: 0.5, width: '100%' }}
      data-testid={dataTestIds.telemedEhrFlow.reviewTabChiefComplaintContainer}
    >
      <Typography variant="h5" color="primary.dark">
        Chief complaint & History of Present Illness
      </Typography>
      <Typography>{chiefComplaint}</Typography>
      {!inPerson && addToVisitNote && spentTime && (
        <Typography variant="body2" color="secondary.light">
          Provider spent {spentTime} minutes on real-time audio & video with this patient
        </Typography>
      )}
    </Box>
  );
};
