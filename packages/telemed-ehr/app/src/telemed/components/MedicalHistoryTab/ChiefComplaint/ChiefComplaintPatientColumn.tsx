import { FC } from 'react';
import { Box, Skeleton, Typography, useTheme } from '@mui/material';
import { getSelectors } from '../../../../shared/store/getSelectors';
import { useAppointmentStore } from '../../../state';

export const ChiefComplaintPatientColumn: FC = () => {
  const theme = useTheme();
  const { appointment, isAppointmentLoading } = getSelectors(useAppointmentStore, [
    'appointment',
    'isAppointmentLoading',
  ]);

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <Box>
        <Typography variant="subtitle2" color={theme.palette.primary.dark}>
          Reason for visit selected by patient
        </Typography>
        {isAppointmentLoading ? (
          <Skeleton width="100%">
            <Typography>.</Typography>
          </Skeleton>
        ) : (
          <Typography>{appointment?.description}</Typography>
        )}
      </Box>
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
        <Typography variant="subtitle2" color={theme.palette.primary.dark}>
          Photo of patient’s condition
        </Typography>
        {isAppointmentLoading ? (
          <Box sx={{ width: '100%', display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gridGap: 16 }}>
            {[1, 2].map((item) => (
              <Box key={item} sx={{ aspectRatio: '1/1' }}>
                <Skeleton variant="rounded" height="100%" />
              </Box>
            ))}
          </Box>
        ) : (
          <Box sx={{ width: '100%', display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gridGap: 16 }}>
            {[1, 2].map((item) => (
              <Box key={item} sx={{ backgroundColor: 'black', aspectRatio: '1/1', borderRadius: 2 }} />
            ))}
          </Box>
        )}
      </Box>
    </Box>
  );
};
