import VideocamOffIcon from '@mui/icons-material/VideocamOff';
import { Box, Typography, useTheme } from '@mui/material';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import Video, { LocalAudioTrack, LocalVideoTrack } from 'twilio-video';
import { otherColors } from '../OttehrThemeProvider';
import { createTelemedRoom, getTelemedToken } from '../api';
import { CustomButton, CustomContainer } from '../components';
import { createProviderName } from '../helpers';
import { useDevices } from '../hooks';
import { useVideoParticipant } from '../store';
import { getProvider } from '../helpers/mockData';
import { Encounter } from 'fhir/r4';

export const VideoSettings = (): JSX.Element => {
  const navigate = useNavigate();
  const theme = useTheme();
  const { t } = useTranslation();
  const { setIsMicOpen, setIsVideoOpen, setLocalTracks, setRoom } = useVideoParticipant();
  const hasVideoDevice = useDevices().videoInputDevices.length > 0;

  // TODO hard-coded data
  const provider = getProvider();
  const toggleMicAndCam = async (userInput: boolean): Promise<void> => {
    try {
      setIsMicOpen(userInput);
      setIsVideoOpen(userInput);

      const encounter: Encounter | null = await createTelemedRoom();
      if (encounter === null) {
        console.error('Failed to create telemed room');
        return;
      }

      const roomSID = encounter?.extension
        ?.find((ext: any) => ext.url === 'https://extensions.fhir.zapehr.com/encounter-virtual-service-pre-release')
        ?.extension?.find((innerExt: any) => innerExt.url === 'addressString')?.valueString;

      if (roomSID) {
        console.log('RoomSID:', roomSID);
      } else {
        console.log('RoomSID not found');
      }

      const encounterId = encounter.id || '';
      console.log('Encounter ID:', encounterId);

      const twilioToken = await getTelemedToken(encounterId);

      if (twilioToken === null) {
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

      const connectedRoom = await Video.connect(twilioToken, {
        audio: true,
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
          mt: 2.5,
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
