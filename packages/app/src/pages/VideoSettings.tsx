import VideocamOffIcon from '@mui/icons-material/VideocamOff';
import { Box, Typography, useTheme } from '@mui/material';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import Video, { LocalAudioTrack, LocalVideoTrack } from 'twilio-video';
import { otherColors } from '../OttehrThemeProvider';
import { zapehrApi } from '../api';
import { CustomButton, CustomContainer } from '../components';
import { createProviderName } from '../helpers';
import { useDevices } from '../hooks';
import { useVideoParticipant } from '../store';
import { getProvider } from '../helpers/mockData';

export const VideoSettings = (): JSX.Element => {
  const navigate = useNavigate();
  const theme = useTheme();
  const { t } = useTranslation();
  const { setIsMicOpen, setIsVideoOpen, setLocalTracks, setRoom } = useVideoParticipant();
  // Note: twilio free rooms are limited to 2 participant, and it takes around 15-20 seconds to disconnect a participant
  const hasVideoDevice = useDevices().videoInputDevices.length > 0;

  // TODO hard-coded data
  const provider = getProvider();
  const roomName = 'test1';
  const toggleMicAndCam = async (userInput: boolean): Promise<void> => {
    try {
      setIsMicOpen(userInput);
      setIsVideoOpen(userInput);

      const fetchedToken = await zapehrApi.getTwilioToken(roomName);
      if (fetchedToken === null) {
        console.error('Failed to fetch token');
        return;
      }

      const tracks = await Video.createLocalTracks({
        audio: true,
        video: hasVideoDevice,
      });

      const localTracks = tracks.filter((track) => track.kind === 'audio' || track.kind === 'video') as (
        | LocalAudioTrack
        | LocalVideoTrack
      )[];
      setLocalTracks(localTracks);

      const connectedRoom = await Video.connect(fetchedToken, {
        audio: true,
        name: roomName,
        tracks: localTracks,
        video: hasVideoDevice,
      });

      setRoom(connectedRoom);
      navigate('/waiting-room');
    } catch (error) {
      console.error('An error occurred:', error);
    }
  };

  return (
    <CustomContainer isProvider={false} subtitle={createProviderName(provider)} title={t('general.waitingRoom')}>
      <Typography variant="h5">{t('video.enableCamAndMic')}</Typography>
      <Typography variant="body1">{t('video.permissionAccess')}</Typography>
      <Box
        sx={{
          alignItems: 'center',
          backgroundColor: otherColors.biscay,
          borderRadius: 2,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          mt: 2,
          px: 15,
          py: 10,
          [theme.breakpoints.down('md')]: {
            px: 8,
            py: 6,
          },
        }}
      >
        <VideocamOffIcon sx={{ color: theme.palette.background.default }} />
        <Typography
          color="primary.contrast"
          sx={{
            opacity: '0.5',
            textAlign: 'center',
          }}
          variant="body1"
        >
          {t('video.enableInBrowser')}
        </Typography>
      </Box>
      <CustomButton onClick={() => toggleMicAndCam(true)}>{t('video.enableBoth')}</CustomButton>
      <CustomButton onClick={() => toggleMicAndCam(false)} secondary>
        {t('video.continueWithout')}
      </CustomButton>
    </CustomContainer>
  );
};
