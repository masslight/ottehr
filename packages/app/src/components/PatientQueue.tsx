import { FC } from 'react';
import { Box, Button, Grid, Typography } from '@mui/material';
import defaultPatient from '../assets/icons/ottehrDefaultPatient.svg';
import { getQueuedTimeFromTimestamp } from '../helpers';
import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';

export interface PatientQueueProps {
  name: string;
  queuedTime: string;
  link: string;
}

const PatientQueue: FC<PatientQueueProps> = ({ name, queuedTime, link }) => {
  const { t } = useTranslation();

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
    <Box sx={{ m: 0, py: 1 }}>
      <Grid container alignItems="center" spacing={{ xs: 0 }}>
        <Grid item xs={8} display="flex" alignItems="center" textAlign={{ xs: 'start' }}>
          <img src={defaultPatient} height="42px" />
          <Box pl={2}>
            <Typography variant="body1" color="primary.contrast">
              {name}
            </Typography>
            <Typography variant="body2" color="primary.contrast" sx={{ opacity: 0.6 }}>
              {relativeQueuedTime}
            </Typography>
          </Box>
        </Grid>
        <Grid item xs={4} display="flex" alignItems="center" justifyContent="flex-end">
          <Button variant="contained" color="primary" href={link}>
            {t('general.startCall')}
          </Button>
        </Grid>
      </Grid>
    </Box>
  );
};

export default PatientQueue;
