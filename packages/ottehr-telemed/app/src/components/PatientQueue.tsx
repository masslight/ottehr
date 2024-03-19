import { Box, Typography, Snackbar, Alert } from '@mui/material';
import { FC, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { joinAsProviderTelemedMeeting } from '../api';
import { callButtonMobile, defaultPatient } from '../assets/icons';
import { getRelativeTime } from '../helpers';
import { useVideoParticipant } from '../store';
import { CustomButton } from './CustomButton';
import { useAuth0 } from '@auth0/auth0-react';
import { MeetingSessionConfiguration } from 'amazon-chime-sdk-js';
import { DeviceLabels, useMeetingManager } from 'amazon-chime-sdk-component-library-react';

export interface PatientQueueProps {
  encounterId: string;
  patientName: string;
  queuedTime: string;
}

export const PatientQueue: FC<PatientQueueProps> = ({ encounterId, patientName, queuedTime }) => {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { setRemoteParticipantName } = useVideoParticipant();
  const [relativeQueuedTime, setRelativeQueuedTime] = useState(getRelativeTime(queuedTime));
  const { getAccessTokenSilently } = useAuth0();
  const [meetingConfig, setMeetingConfig] = useState<Record<string, any> | undefined>();
  const [openSnackbar, setOpenSnackbar] = useState(false); // new state for Snackbar
  const { setCallStart } = useVideoParticipant();
  const meetingManager = useMeetingManager();

  useEffect(() => {
    async function getZapEHRUser(): Promise<void> {
      const accessToken = await getAccessTokenSilently();
      const joinInfo = await joinAsProviderTelemedMeeting(encounterId, accessToken);
      setMeetingConfig(joinInfo);
    }

    getZapEHRUser().catch((error) => {
      console.log(error);
    });
  }, [encounterId, getAccessTokenSilently]);

  const startCall = async (): Promise<void> => {
    setCallStart(queuedTime);
    try {
      if (meetingConfig === null) {
        console.error('Failed to fetch join info');
        setOpenSnackbar(true); // open Snackbar if joinInfo  is null
        return;
      }

      const meetingSessionConfiguration = new MeetingSessionConfiguration(
        meetingConfig?.Meeting,
        meetingConfig?.Attendee,
      );
      const options = {
        deviceLabels: DeviceLabels.AudioAndVideo,
      };

      await meetingManager.join(meetingSessionConfiguration, options);

      setRemoteParticipantName(patientName);
      await meetingManager.start();
      navigate(`/video-call`);
    } catch (error) {
      console.error('An error occurred:', error);
    }
  };

  const handleCloseSnackbar = (): void => {
    setOpenSnackbar(false);
  };

  useEffect(() => {
    setRelativeQueuedTime(getRelativeTime(queuedTime));

    // interval to update the state every minute
    const interval = setInterval(() => {
      setRelativeQueuedTime(getRelativeTime(queuedTime));
    }, 60000);

    return () => clearInterval(interval);
  }, [queuedTime]);

  return (
    <Box sx={{ m: 0, py: 1 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
        <Box sx={{ display: 'flex' }}>
          <img alt={t('imageAlts.patient')} height="42px" src={defaultPatient} />
          <Box pl={1.75}>
            <Typography color="primary.contrast" variant="body1">
              {patientName}
            </Typography>
            <Typography color="primary.contrast" sx={{ opacity: 0.6 }} variant="body2">
              {relativeQueuedTime}
            </Typography>
          </Box>
        </Box>
        <Box sx={{ alignItems: 'center', display: 'flex' }}>
          <CustomButton onClick={startCall} sx={{ display: { md: 'block', xs: 'none' } }}>
            {t('general.startCall')}
          </CustomButton>
          <CustomButton sx={{ display: { md: 'none' } }}>
            <img alt={t('imageAlts.callButton')} src={callButtonMobile} />
          </CustomButton>
        </Box>
      </Box>
      <Snackbar autoHideDuration={6000} onClose={handleCloseSnackbar} open={openSnackbar}>
        <Alert onClose={handleCloseSnackbar} severity="error" sx={{ width: '100%' }}>
          {t('errors.tokenNotLoaded')}
        </Alert>
      </Snackbar>
    </Box>
  );
};
