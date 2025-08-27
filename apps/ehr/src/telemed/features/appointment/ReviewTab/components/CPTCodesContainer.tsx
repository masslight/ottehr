import { Box, Typography } from '@mui/material';
import { FC } from 'react';
import { useChartData } from '../../../../state';

export const CPTCodesContainer: FC = () => {
  const { chartData } = useChartData();
  const cptCodes = chartData?.cptCodes;

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5, width: '100%' }}>
      <Typography variant="h5" color="primary.dark">
        CPT codes
      </Typography>
      {cptCodes?.map((code) => (
        <Typography key={code.resourceId}>
          {code.code} {code.display}
        </Typography>
      ))}
    </Box>
  );
};
