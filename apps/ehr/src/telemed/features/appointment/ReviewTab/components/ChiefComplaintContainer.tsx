import { FC } from 'react';
import { Box, Typography } from '@mui/material';
import { getSelectors } from '../../../../../shared/store/getSelectors';
import { useAppointmentStore } from '../../../../state';
import { getSpentTime } from 'utils';
import { useFeatureFlags } from '../../../../../features/css-module/context/featureFlags';

export const ChiefComplaintContainer: FC = () => {
  const { chartData, encounter } = getSelectors(useAppointmentStore, ['chartData', 'encounter']);
  const { css } = useFeatureFlags();

  const chiefComplaint = chartData?.chiefComplaint?.text;

  const addToVisitNote = chartData?.addToVisitNote?.value;
  const spentTime = getSpentTime(encounter.statusHistory);

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5, width: '100%' }}>
      <Typography variant="h5" color="primary.dark">
        Chief complaint & History of Present Illness
      </Typography>
      <Typography>{chiefComplaint}</Typography>
      {!css && addToVisitNote && spentTime && (
        <Typography variant="body2" color="secondary.light">
          Provider spent {spentTime} minutes on real-time audio & video with this patient
        </Typography>
      )}
    </Box>
  );
};
