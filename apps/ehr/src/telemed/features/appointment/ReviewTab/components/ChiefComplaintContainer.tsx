import { Box, Typography } from '@mui/material';
import { FC } from 'react';
import { getSpentTime } from 'utils';
import { dataTestIds } from '../../../../../constants/data-test-ids';
import { useFeatureFlags } from '../../../../../features/css-module/context/featureFlags';
import { getSelectors } from '../../../../../shared/store/getSelectors';
import { useAppointmentStore } from '../../../../state';

export const ChiefComplaintContainer: FC = () => {
  const { chartData, encounter } = getSelectors(useAppointmentStore, ['chartData', 'encounter']);
  const { css } = useFeatureFlags();

  const chiefComplaint = chartData?.chiefComplaint?.text;

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
      {!css && addToVisitNote && spentTime && (
        <Typography variant="body2" color="secondary.light">
          Provider spent {spentTime} minutes on real-time audio & video with this patient
        </Typography>
      )}
    </Box>
  );
};
