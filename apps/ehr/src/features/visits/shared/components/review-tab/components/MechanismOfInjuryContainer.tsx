import { Box, Typography } from '@mui/material';
import { FC } from 'react';
import { useChartFields } from '../../../hooks/useChartFields';

export const MechanismOfInjuryContainer: FC = () => {
  const { data: chartFields } = useChartFields({
    requestedFields: {
      mechanismOfInjury: {
        _tag: 'mechanism-of-injury',
      },
    },
  });

  const mechanismOfInjury = chartFields?.mechanismOfInjury?.text;

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5, width: '100%' }}>
      <Typography variant="h5" color="primary.dark">
        Mechanism of Injury
      </Typography>
      <Typography>{mechanismOfInjury}</Typography>
    </Box>
  );
};
