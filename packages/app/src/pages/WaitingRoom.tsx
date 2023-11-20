import { Box, Typography } from '@mui/material';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { otherColors } from '../OttehrThemeProvider';
import { CustomContainer, VideoControls } from '../components';
import { createProviderName } from '../helpers';
import { useLocalVideo } from '../hooks';
import { useVideoParticipant } from '../store';
import { getProvider } from '../helpers/mockData';

export const WaitingRoom = (): JSX.Element => {
  const navigate = useNavigate();
  const videoRef = useRef<HTMLDivElement | null>(null);
  const { t } = useTranslation();
  const { room, localTracks } = useVideoParticipant();
  useLocalVideo(videoRef, localTracks);
  // localParticipant is not counted so we start with 1
  const [numParticipants, setNumParticipants] = useState<number>(1);

  const participantConnected = useCallback(() => {
    setNumParticipants((prevNumParticipants: number) => prevNumParticipants + 1);
  }, []);

  const participantDisconnected = useCallback(() => {
    setNumParticipants((prevNumParticipants: number) => prevNumParticipants - 1);
  }, []);

  useEffect(() => {
    if (room) {
      room.on('participantConnected', participantConnected);
      room.on('participantDisconnected', participantDisconnected);
      room.participants.forEach(participantConnected);
    }
  }, [room, participantConnected, participantDisconnected]);

  // navigate to video call when provider joins
  useEffect(() => {
    if (numParticipants > 1) {
      navigate(`/video-call/`);
    }
    return undefined;
  }, [navigate, numParticipants]);

  // TODO hard-coded data
  const provider = getProvider();

  return (
    <CustomContainer isProvider={false} subtitle={createProviderName(provider)} title={t('general.waitingRoom')}>
      <Typography sx={{ pb: 1 }} variant="h5">
        {t('waitingRoom.startingSoon')}
      </Typography>
      <Typography sx={{ pb: 2.5 }} variant="body1">
        {t('waitingRoom.thanksPrefix')}
        {createProviderName(provider, false)}
        {t('waitingRoom.thanksSuffix')}
      </Typography>
      <Box
        sx={{
          alignItems: 'center',
          backgroundColor: otherColors.transparent,
          borderRadius: 2,
          display: 'flex',
          flexDirection: 'column',
          height: '25vh',
          justifyContent: 'center',
          overflow: 'hidden',
          position: 'relative',
          px: 15,
          py: 10,
        }}
      >
        <Box
          sx={{
            backgroundColor: otherColors.biscay,
            borderRadius: 5,
            bottom: 16,
            display: 'flex',
            gap: 1,
            justifyContent: 'center',
            left: '50%',
            maxWidth: 'fit-content',
            position: 'absolute',
            transform: 'translate(-50%, 0)',
            zIndex: 2,
          }}
        >
          <VideoControls inCallRoom={false} localParticipant={room?.localParticipant} />
        </Box>
        <Box
          ref={videoRef}
          sx={{
            height: '100%',
            left: 0,
            position: 'absolute',
            top: 0,
            width: '100%',
          }}
        />
      </Box>
    </CustomContainer>
  );
};
