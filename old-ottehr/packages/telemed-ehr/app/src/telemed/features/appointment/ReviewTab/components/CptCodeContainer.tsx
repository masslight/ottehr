import React, { FC } from 'react';
import { Box, Typography } from '@mui/material';
import { getSelectors } from '../../../../../shared/store/getSelectors';
import { useAppointmentStore } from '../../../../state';

export const CptCodeContainer: FC = () => {
  const { chartData } = getSelectors(useAppointmentStore, ['chartData']);

  const cptCode = (chartData?.cptCodes || [])[0];

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5, width: '100%' }}>
      <Typography variant="h5" color="primary.dark">
        CPT code
      </Typography>
      {cptCode ? (
        <Typography>{cptCode.display}</Typography>
      ) : (
        <Typography color="secondary.light">No CPT code provided</Typography>
      )}
    </Box>
  );
};
