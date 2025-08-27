import { Box, Typography } from '@mui/material';
import { FC } from 'react';
import { dataTestIds } from '../../../../../constants/data-test-ids';
import { useChartData } from '../../../../state';

export const ReviewOfSystemsContainer: FC = () => {
  const { chartData } = useChartData();
  const ros = chartData?.ros?.text;

  return (
    <Box
      sx={{ display: 'flex', flexDirection: 'column', gap: 0.5, width: '100%' }}
      data-testid={dataTestIds.telemedEhrFlow.reviewTabRosContainer}
    >
      <Typography variant="h5" color="primary.dark">
        Review of systems
      </Typography>
      <Typography>{ros}</Typography>
    </Box>
  );
};
