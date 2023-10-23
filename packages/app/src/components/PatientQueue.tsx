import { Box, Button, Typography } from '@mui/material';
import { FC, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ottEHRDefaultPatient, callButtonMobile } from '../assets/icons';
import { getQueuedTimeFromTimestamp } from '../helpers';
import { useNavigate } from 'react-router-dom';
import { useVideoParticipant } from '../store';
import Video, { LocalAudioTrack, LocalVideoTrack } from 'twilio-video';
import { zapehrApi } from '../api';

export interface PatientQueueProps {
  roomName: string;
  name: string;
  queuedTime: string;
}

export const PatientQueue: FC<PatientQueueProps> = ({ roomName, name, queuedTime }) => {
  const { t } = useTranslation();
  const { setIsVideoOpen, setIsMicOpen, setRoom, setLocalTracks } = useVideoParticipant();
  const navigate = useNavigate();
  const [relativeQueuedTime, setRelativeQueuedTime] = useState(getQueuedTimeFromTimestamp(queuedTime));

  const startCall = async (): Promise<void> => {
    try {
      setIsVideoOpen(true);
      setIsMicOpen(true);

      const fetchedToken = await zapehrApi.getTwilioToken(roomName);
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
        name: roomName,
        audio: true,
        video: true,
        tracks: localTracks,
      });

      setRoom(connectedRoom);
      navigate(`/video-call/`);
      // Navigate to room or handle UI updates
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
          <Button sx={{ display: { xs: 'none', md: 'block' } }} variant="contained" color="primary" onClick={startCall}>
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
