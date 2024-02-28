import VideocamOffIcon from '@mui/icons-material/VideocamOff';
import { Box, Typography, useTheme } from '@mui/material';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { otherColors } from '../OttehrThemeProvider';
import { createTelemedMeeting, joinTelemedMeeting } from '../api';
import { CustomButton, CustomContainer, LoadingSpinner } from '../components';
import { useDevices } from '../hooks';
import { useParticipant, useVideoParticipant } from '../store';
import { useState } from 'react';

// chime SDK
import { DeviceLabels, useMeetingManager } from 'amazon-chime-sdk-component-library-react';
import { MeetingSessionConfiguration } from 'amazon-chime-sdk-js';


export const VideoSettings = (): JSX.Element => {
  const navigate = useNavigate();
  const theme = useTheme();
  const { t } = useTranslation();
  const hasVideoDevice = useDevices().videoInputDevices.length > 0;
  const { patientName, providerId, providerName } = useParticipant();
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const { setCallStart } = useVideoParticipant();

  const meetingManager = useMeetingManager();
  console.log('meetingManager', meetingManager);
  const toggleMicAndCam = async (userInput: boolean): Promise<void> => {
    try {
      setIsLoading(true);
      // setIsMicOpen(userInput);
      // setIsVideoOpen(userInput);

      const encounter = await createTelemedMeeting(patientName, providerId, providerName);

      if (encounter === null) {
        console.error('Failed to create telemed meeting');
        return;
      }

      setCallStart(encounter?.period.start);

      const meetingID = encounter?.extension
        ?.find((ext: any) => ext.url === 'https://extensions.fhir.zapehr.com/encounter-virtual-service-pre-release')
        ?.extension?.find((innerExt: any) => innerExt.url === 'addressString')?.valueString;

      if (meetingID) {
        console.log('meetingId:', meetingID);
      } else {
        console.log('meetingId not found');
      }

      const encounterId = encounter?.id || '';
      console.log('Encounter ID:', encounterId);

      // join the meeting
      const telemedMeetingResponse = await joinTelemedMeeting(encounterId);

      // TODO: add snackbar for error
      if (telemedMeetingResponse === null) {
        console.error('Failed to fetch meeting and attendee info');
        return;
      }

      console.log('joinInfo: ', telemedMeetingResponse?.joinInfo);
      const meetingSessionConfiguration = new MeetingSessionConfiguration(telemedMeetingResponse?.joinInfo?.Meeting, telemedMeetingResponse?.joinInfo?.Attendee);
      const options = {
        deviceLabels: DeviceLabels.AudioAndVideo,
      };
      await meetingManager.join(meetingSessionConfiguration, options);

      setIsLoading(false);
      console.log('navigating to waiting room and starting call');
      await meetingManager.start();
      navigate('/waiting-room');
    } catch (error) {
      console.error('An error occurred:', error);
    }
  };


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
