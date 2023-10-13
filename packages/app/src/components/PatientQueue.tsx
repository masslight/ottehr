import { Box, Button, Grid, Typography } from '@mui/material';
import { FC, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ottEHRDefaultPatient } from '../assets/icons';
import { getQueuedTimeFromTimestamp } from '../helpers';

export interface PatientQueueProps {
  link: string;
  name: string;
  queuedTime: string;
}

export const PatientQueue: FC<PatientQueueProps> = ({ link, name, queuedTime }) => {
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
      <Grid alignItems="center" container spacing={{ xs: 0 }}>
        <Grid alignItems="center" display="flex" item textAlign={{ xs: 'start' }} xs={8}>
          <img height="42px" src={ottEHRDefaultPatient} />
          <Box pl={2}>
            <Typography color="primary.contrast" variant="body1">
              {name}
            </Typography>
            <Typography color="primary.contrast" variant="body2" sx={{ opacity: 0.6 }}>
              {relativeQueuedTime}
            </Typography>
          </Box>
        </Grid>
        <Grid alignItems="center" display="flex" item justifyContent="flex-end" xs={4}>
          <Button color="primary" href={link} variant="contained">
            {t('general.startCall')}
          </Button>
        </Grid>
      </Grid>
    </Box>
  );
};
