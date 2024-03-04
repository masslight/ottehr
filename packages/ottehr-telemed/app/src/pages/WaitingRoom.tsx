import { Box, Typography } from '@mui/material';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { otherColors } from '../OttehrThemeProvider';
import { CustomContainer, VideoControls } from '../components';
import { useParticipant, useVideoParticipant } from '../store';
import { useLocalVideo, useRosterState, LocalVideo } from 'amazon-chime-sdk-component-library-react';

export const WaitingRoom = (): JSX.Element => {
  const navigate = useNavigate();

  const { roster } = useRosterState();
  const { isVideoEnabled, toggleVideo } = useLocalVideo();

  const { t } = useTranslation();
  const { providerName } = useParticipant();
  const { setRemoteParticipantName } = useVideoParticipant();

  const inVideoCallWorkflowRef = useRef(false);
  const [numParticipants, setNumParticipants] = useState<number>(0);

  useEffect(() => {
    const startLocalVideo = async (): Promise<void> => {
      if (!isVideoEnabled) {
        await toggleVideo();
      }
    };
    void startLocalVideo();
  }, [isVideoEnabled, toggleVideo]);

  // navigate to video call when provider joins
  useEffect(() => {
    console.log('check if provider joined roster');
    setNumParticipants(Object.keys(roster).length);
    if (numParticipants > 1) {
      setRemoteParticipantName(providerName);
      inVideoCallWorkflowRef.current = true;
      navigate(`/video-call/`);
    }
  }, [navigate, numParticipants, inVideoCallWorkflowRef, roster, setRemoteParticipantName, providerName]);

  return (
    <CustomContainer isProvider={false} subtitle={providerName} title={t('general.waitingRoom')}>
      <Typography sx={{ pb: 1 }} variant="h5">
        {t('waitingRoom.startingSoon')}
      </Typography>
      <Typography sx={{ pb: 2.5 }} variant="body1">
        {t('waitingRoom.thanksPrefix')}
        {providerName}
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
        ></Box>
        {isVideoEnabled && (
          <Box
            sx={{
              height: '100%',
              left: 0,
              position: 'absolute',
              top: 0,
              width: '100%',
              '& video': {
                width: '100%',
                height: '100%',
                objectFit: 'cover',
              },
            }}
          >
            <LocalVideo />
          </Box>
        )}
        <VideoControls inCallRoom={false} />
      </Box>
    </CustomContainer>
  );
};
