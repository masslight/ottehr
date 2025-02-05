import { Typography } from '@mui/material';
import { Box, useTheme } from '@mui/system';
import { ReactElement } from 'react';
import { formatDateUsingSlashes } from '../helpers/formatDateTime';
import { calculatePatientAge } from 'utils';

export const PatientDateOfBirth = ({ dateOfBirth }: { dateOfBirth: string }): ReactElement => {
  const theme = useTheme();

  return (
    <Box sx={{ display: 'flex', alignItems: 'center' }}>
      <Typography variant="body2" sx={{ color: theme.palette.text.secondary, whiteSpace: 'nowrap' }}>
        {`DOB: ${formatDateUsingSlashes(dateOfBirth)} (${calculatePatientAge(dateOfBirth)})`}
      </Typography>
    </Box>
  );
};
