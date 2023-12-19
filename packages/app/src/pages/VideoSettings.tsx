import VideocamOffIcon from '@mui/icons-material/VideocamOff';
import { Box, Typography, useTheme } from '@mui/material';
import { useTranslation } from 'react-i18next';
import { useNavigate, useNavigationType, NavigationType } from 'react-router-dom';
import Video, { LocalAudioTrack, LocalVideoTrack } from 'twilio-video';
import { otherColors } from '../OttehrThemeProvider';
import { createTelemedRoom, getTelemedToken } from '../api';
import { CustomButton, CustomContainer, LoadingSpinner } from '../components';
import { useDevices } from '../hooks';
import { useParticipant, useVideoParticipant } from '../store';
import { useEffect, useState } from 'react';

export const VideoSettings = (): JSX.Element => {
  const navigate = useNavigate();
  const navType = useNavigationType();
  const theme = useTheme();
  const { t } = useTranslation();
  const { setIsMicOpen, setIsVideoOpen, setLocalTracks, setRoom, cleanup } = useVideoParticipant();
  const hasVideoDevice = useDevices().videoInputDevices.length > 0;
  const { patientName, providerId, providerName } = useParticipant();
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const { setCallStart } = useVideoParticipant();

  const toggleMicAndCam = async (userInput: boolean): Promise<void> => {
    try {
      setIsLoading(true);
      setIsMicOpen(userInput);
      setIsVideoOpen(userInput);

      const encounter = await createTelemedRoom(patientName, providerId, providerName);
      if (encounter === null) {
        console.error('Failed to create telemed room');
        return;
      }
      setCallStart(encounter?.period.start);
      const roomSID = encounter?.extension
        ?.find((ext: any) => ext.url === 'https://extensions.fhir.zapehr.com/encounter-virtual-service-pre-release')
        ?.extension?.find((innerExt: any) => innerExt.url === 'addressString')?.valueString;

      if (roomSID) {
        console.log('RoomSID:', roomSID);
      } else {
        console.log('RoomSID not found');
      }

      const encounterId = encounter?.id || '';
      console.log('Encounter ID:', encounterId);
      const twilioToken = await getTelemedToken(encounterId);

      // TODO: add snackbar for error
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
      setIsLoading(false);
      setRoom(connectedRoom);
      navigate('/waiting-room');
    } catch (error) {
      console.error('An error occurred:', error);
    }
  };

  useEffect(() => {
    if (navType === NavigationType.Pop) {
      cleanup();
    }
  }, [cleanup, navType]);

  return (
    <CustomContainer isProvider={false} subtitle={providerName} title={t('general.waitingRoom')}>
      {isLoading && <LoadingSpinner transparent={true} />}
      <Typography variant="h5">{t('video.enableCamAndMic')}</Typography>
      <Typography variant="body1">{t('video.permissionAccess')}</Typography>
      <Box
        sx={{
          alignItems: 'center',
          backgroundColor: otherColors.biscay,
          borderRadius: 2,
          display: 'flex',
          flexDirection: 'column',
          height: '25vh',
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
