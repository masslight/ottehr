import { Box, Typography } from '@mui/material';
import { FC, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import Video, { LocalAudioTrack, LocalVideoTrack } from 'twilio-video';
import { zapehrApi } from '../api';
import { callButtonMobile, defaultPatient } from '../assets/icons';
import { getQueuedTimeFromTimestamp } from '../helpers';
import { useVideoParticipant } from '../store';
import { CustomButton } from './CustomButton';

export interface PatientQueueProps {
  encounterId: string;
  firstName: string;
  lastName: string;
  queuedTime: string;
}

export const PatientQueue: FC<PatientQueueProps> = ({ encounterId, firstName, lastName, queuedTime }) => {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { setIsMicOpen, setIsVideoOpen, setLocalTracks, setRoom } = useVideoParticipant();
  const [relativeQueuedTime, setRelativeQueuedTime] = useState(getQueuedTimeFromTimestamp(queuedTime));

  const startCall = async (): Promise<void> => {
    try {
      setIsMicOpen(true);
      setIsVideoOpen(true);

      //  this will not work for now as it is for m2m
      const fetchedToken = await zapehrApi.getTelemedToken(encounterId);
      if (fetchedToken === null) {
        console.error('Failed to fetch token');
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

      const connectedRoom = await Video.connect(fetchedToken, {
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
              {firstName} {lastName}
            </Typography>
            <Typography color="primary.contrast" sx={{ opacity: 0.6 }} variant="body2">
              {relativeQueuedTime}
            </Typography>
          </Box>
        </Box>
        <Box>
          <CustomButton onClick={startCall} sx={{ display: { md: 'block', xs: 'none' } }}>
            {t('general.startCall')}
          </CustomButton>
          <CustomButton sx={{ display: { md: 'none' } }}>
            <img alt={t('imageAlts.callButton')} src={callButtonMobile} />
          </CustomButton>
        </Box>
      </Box>
    </Box>
  );
};
