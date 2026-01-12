import { Box, Typography } from '@mui/material';
import { FC } from 'react';
import { dataTestIds } from 'src/constants/data-test-ids';
import { useChartFields } from '../../../hooks/useChartFields';

export const ReviewOfSystemsContainer: FC = () => {
  const { data: chartFields } = useChartFields({ requestedFields: { ros: { _tag: 'ros' } } });
  const ros = chartFields?.ros?.text;

  if (!ros) return null;

  const formattedRos = ros.replace(/\\n/g, '\n');

  return (
    <Box
      sx={{ display: 'flex', flexDirection: 'column', gap: 0.5, width: '100%' }}
      data-testid={dataTestIds.telemedEhrFlow.reviewTabRosContainer}
    >
      <Typography variant="h5" color="primary.dark">
        Review of systems
      </Typography>
      <Typography sx={{ whiteSpace: 'pre-wrap' }}>{formattedRos}</Typography>
    </Box>
  );
};
