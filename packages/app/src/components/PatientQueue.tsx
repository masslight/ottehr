import { Box, Typography, Snackbar, Alert } from '@mui/material';
import { FC, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import Video, { LocalAudioTrack, LocalVideoTrack } from 'twilio-video';
import { getProviderTelemedToken } from '../api';
import { callButtonMobile, defaultPatient } from '../assets/icons';
import { getQueuedTimeFromTimestamp } from '../helpers';
import { useVideoParticipant } from '../store';
import { CustomButton } from './CustomButton';
import { useAuth0 } from '@auth0/auth0-react';

export interface PatientQueueProps {
  encounterId: string;
  patientName: string;
  queuedTime: string;
}

export const PatientQueue: FC<PatientQueueProps> = ({ encounterId, patientName, queuedTime }) => {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { setIsMicOpen, setIsVideoOpen, setLocalTracks, setRoom } = useVideoParticipant();
  const [relativeQueuedTime, setRelativeQueuedTime] = useState(getQueuedTimeFromTimestamp(queuedTime));
  const { getAccessTokenSilently } = useAuth0();
  const [telemedToken, setTelemedToken] = useState<string | null>(null);
  const [openSnackbar, setOpenSnackbar] = useState(false); // new state for Snackbar

  useEffect(() => {
    async function getZapEHRUser(): Promise<void> {
      const accessToken = await getAccessTokenSilently();
      setTelemedToken(await getProviderTelemedToken(encounterId, accessToken));
    }

    getZapEHRUser().catch((error) => {
      console.log(error);
    });
  }, [encounterId, getAccessTokenSilently]);

  const startCall = async (): Promise<void> => {
    try {
      setIsMicOpen(true);
      setIsVideoOpen(true);

      if (telemedToken === null) {
        console.error('Failed to fetch token');
        setOpenSnackbar(true); // open Snackbar if token is null
        return;
      }

      const tracks = await Video.createLocalTracks({
        audio: true,
        video: true,
      });

      const localTracks = tracks.filter((track) => track.kind === 'audio' || track.kind === 'video') as (
        | LocalAudioTrack
        | LocalVideoTrack
      )[];

      setLocalTracks(localTracks);

      const connectedRoom = await Video.connect(telemedToken, {
        audio: true,
        tracks: localTracks,
        video: true,
      });

      setRoom(connectedRoom);
      navigate(`/video-call`);
    } catch (error) {
      console.error('An error occurred:', error);
    }
  };

  const handleCloseSnackbar = (): void => {
    setOpenSnackbar(false);
  };

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
