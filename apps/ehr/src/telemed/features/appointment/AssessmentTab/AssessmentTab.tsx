import { Box, CircularProgress } from '@mui/material';
import { FC } from 'react';
import { useChartData } from '../../../state';
import { AssessmentCard } from './AssessmentCard';

export const AssessmentTab: FC = () => {
  const { isChartDataLoading } = useChartData();

  if (isChartDataLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center' }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        gap: 1,
      }}
    >
      <AssessmentCard />
    </Box>
  );
};
