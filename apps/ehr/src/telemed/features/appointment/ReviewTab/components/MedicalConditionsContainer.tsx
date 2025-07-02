import { Box, Typography, useTheme } from '@mui/material';
import { FC } from 'react';
import { dataTestIds } from '../../../../../constants/data-test-ids';
import { getSelectors } from '../../../../../shared/store/getSelectors';
import { useAppointmentStore } from '../../../../state';

export const MedicalConditionsContainer: FC = () => {
  const { chartData } = getSelectors(useAppointmentStore, ['chartData']);
  const theme = useTheme();

  const conditions = chartData?.conditions?.filter((condition) => condition.current === true);

  return (
    <Box
      sx={{ display: 'flex', flexDirection: 'column', gap: 0.5, width: '100%' }}
      data-testid={dataTestIds.telemedEhrFlow.reviewTabMedicalConditionsContainer}
    >
      <Typography variant="h5" color="primary.dark">
        Medical conditions
      </Typography>
      {conditions?.length ? (
        conditions?.map((condition) => (
          <Typography key={condition.resourceId}>
            {condition.display} {condition.code}
          </Typography>
        ))
      ) : (
        <Typography color={theme.palette.text.secondary}>No known medical conditions</Typography>
      )}
    </Box>
  );
};
