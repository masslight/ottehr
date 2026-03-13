import { Box, Typography } from '@mui/material';
import { FC } from 'react';
import { makeCptCodeDisplay } from 'utils';
import { useChartData } from '../../../stores/appointment/appointment.store';

export const CPTCodesContainer: FC = () => {
  const { chartData } = useChartData();
  const cptCodes = chartData?.cptCodes;

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5, width: '100%' }}>
      <Typography variant="h5" color="primary.dark">
        CPT codes
      </Typography>
      {cptCodes?.map((code) => <Typography key={code.resourceId}>{makeCptCodeDisplay(code)}</Typography>)}
    </Box>
  );
};
