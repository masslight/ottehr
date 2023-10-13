import { Box, Button, Typography } from '@mui/material';
import { FC, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ottEHRDefaultPatient, callButtonMobile } from '../assets/icons';
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
      <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
        <Box sx={{ display: 'flex' }}>
          <img src={ottEHRDefaultPatient} height="42px" />
          <Box pl={2}>
            <Typography color="primary.contrast" variant="body1">
              {name}
            </Typography>
            <Typography color="primary.contrast" variant="body2" sx={{ opacity: 0.6 }}>
              {relativeQueuedTime}
            </Typography>
          </Box>
        </Box>
        <Box>
          <Button sx={{ display: { xs: 'none', md: 'block' } }} variant="contained" color="primary" href={link}>
            {t('general.startCall')}
          </Button>
          <Button
            sx={{
              display: { md: 'none' },
            }}
          >
            <img src={callButtonMobile} />
          </Button>
        </Box>
      </Box>
    </Box>
  );
};
