import { Box, Typography } from '@mui/material';
import { FC } from 'react';
import { useChartData } from '../../../../state';

export const EMCodeContainer: FC = () => {
  const { chartData } = useChartData();

  const emCode = chartData?.emCode;

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5, width: '100%' }}>
      <Typography variant="h5" color="primary.dark">
        E&M code
      </Typography>
      <Typography>{emCode?.display}</Typography>
    </Box>
  );
};
