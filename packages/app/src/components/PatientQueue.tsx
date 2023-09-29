import { FC } from 'react';
import { Box, Grid, Link as MuiLink, Typography, useTheme } from '@mui/material';
import defaultPatient from '../assets/icons/defaultPatient.svg';
import { getQueuedTimeFromTimestamp } from '../helpers';
import React, { useState, useEffect } from 'react';

export interface PatientQueueProps {
  name: string;
  queuedTime: string;
  link: string;
}

const PatientQueue: FC<PatientQueueProps> = ({ name, queuedTime, link }) => {
  const theme = useTheme();

  const [relativeQueuedTime, setRelativeQueuedTime] = useState(getQueuedTimeFromTimestamp(queuedTime));

  useEffect(() => {
    setRelativeQueuedTime(getQueuedTimeFromTimestamp(queuedTime));

    // interval to update the state every minute
    const interval = setInterval(() => {
      setRelativeQueuedTime(getQueuedTimeFromTimestamp(queuedTime));
    }, 60000);

    return () => clearInterval(interval);
  }, [queuedTime]);

  return (
    <Box sx={{ m: 0, px: { xs: 3, md: 5 }, py: 2 }}>
      <Grid container direction="row" spacing={{ xs: 0, md: 2 }}>
        <Grid item xs={12} md={3} textAlign={{ xs: 'center', md: 'start' }} sx={{ marginTop: '0 !important' }}>
          <img src={defaultPatient} height="42px" />
        </Grid>
        <Grid item xs={12} md={6} textAlign={{ xs: 'center', md: 'start' }} sx={{ marginTop: '0 !important' }}>
          <Typography sx={{ fontSize: '18px' }} color={theme.palette.secondary.main}>
            {name}
          </Typography>
        </Grid>
        <Grid item xs={12} md={3} textAlign={{ xs: 'center', md: 'end' }} sx={{ marginTop: '0 !important' }}>
          <MuiLink
            href={link}
            sx={{
              fontWeight: 700,
              fontSize: '16px',
              color: theme.palette.secondary.main,
            }}
          >
            {relativeQueuedTime}
          </MuiLink>
        </Grid>
      </Grid>
    </Box>
  );
};

export default PatientQueue;
