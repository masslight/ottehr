import { FC } from 'react';
import { Box, Typography } from '@mui/material';
import { getSelectors } from '../../../../../shared/store/getSelectors';
import { useAppointmentStore } from '../../../../state';
import { dataTestIds } from '../../../../../constants/data-test-ids';

export const MedicalConditionsContainer: FC = () => {
  const { chartData } = getSelectors(useAppointmentStore, ['chartData']);

  const conditions = chartData?.conditions;

  return (
    <Box
      sx={{ display: 'flex', flexDirection: 'column', gap: 0.5, width: '100%' }}
      data-testid={dataTestIds.telemedEhrFlow.reviewTabMedicalConditionsContainer}
    >
      <Typography variant="h5" color="primary.dark">
        Medical conditions
      </Typography>
      {conditions?.map((condition) => (
        <Typography key={condition.resourceId}>
          {condition.display} {condition.code}
        </Typography>
      ))}
    </Box>
  );
};
