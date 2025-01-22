import CallEndIcon from '@mui/icons-material/CallEnd';
import MicIcon from '@mui/icons-material/Mic';
import MicOffIcon from '@mui/icons-material/MicOff';
import SettingsIcon from '@mui/icons-material/Settings';
import VideocamIcon from '@mui/icons-material/Videocam';
import VideocamOffIcon from '@mui/icons-material/VideocamOff';
import { Box, CircularProgress, useTheme } from '@mui/material';
import { useLocalVideo, useMeetingManager, useToggleLocalMute } from 'amazon-chime-sdk-component-library-react';
import { FC, useState } from 'react';
import { ConfirmationDialog, IconButtonContained } from '../../components';
import { useZapEHRAPIClient } from '../../hooks/useZapEHRAPIClient';
import { useAppointmentStore, useChangeTelemedAppointmentStatusMutation, useVideoCallStore } from '../../state';
import { CallSettings } from './CallSettings';
import { useParams } from 'react-router-dom';
import { ApptStatus } from 'ehr-utils';
import { getSelectors } from '../../../shared/store/getSelectors';

export const VideoControls: FC = () => {
  const theme = useTheme();

  const apiClient = useZapEHRAPIClient();
  const { mutateAsync, isLoading } = useChangeTelemedAppointmentStatusMutation();
  const { encounter } = getSelectors(useAppointmentStore, ['encounter']);

  const { id: appointmentId } = useParams();

  const { toggleVideo, isVideoEnabled } = useLocalVideo();
  const { muted, toggleMute } = useToggleLocalMute();
  const meetingManager = useMeetingManager();

  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  const openSettings = (): void => {
    setIsSettingsOpen(true);
  };

  const closeSettings = (): void => {
    setIsSettingsOpen(false);
  };

  const cleanup = async (): Promise<void> => {
    if (meetingManager) {
      await meetingManager.meetingSession?.deviceController.destroy().catch((error) => console.error(error));
      await meetingManager.leave().catch((error) => console.error(error));
    }
    useVideoCallStore.setState({ meetingData: null });
  };

  const disconnect = async (): Promise<void> => {
    if (apiClient && appointmentId) {
      await mutateAsync({ apiClient, appointmentId, newStatus: ApptStatus.unsigned }, {});
      useAppointmentStore.setState({
        encounter: { ...encounter, status: 'finished' },
      });
    }
    await cleanup();
  };

  return (
    <>
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 2,
          py: 1,
        }}
      >
        <IconButtonContained onClick={toggleVideo} variant={isVideoEnabled ? undefined : 'disabled'}>
          {isVideoEnabled ? (
            <VideocamIcon sx={{ color: theme.palette.primary.contrastText }} />
          ) : (
            <VideocamOffIcon sx={{ color: theme.palette.primary.dark }} />
          )}
        </IconButtonContained>
        <IconButtonContained onClick={toggleMute} variant={!muted ? undefined : 'disabled'}>
          {!muted ? (
            <MicIcon sx={{ color: theme.palette.primary.contrastText }} />
          ) : (
            <MicOffIcon sx={{ color: theme.palette.primary.dark }} />
          )}
        </IconButtonContained>
        <IconButtonContained onClick={openSettings}>
          <SettingsIcon sx={{ color: theme.palette.primary.contrastText }} />
        </IconButtonContained>
        <ConfirmationDialog
          title="Do you want to end video call with the patient?"
          response={disconnect}
          actionButtons={{
            proceed: {
              text: 'End video call',
              color: 'error',
            },
            back: { text: 'Cancel' },
          }}
        >
          {(showDialog) => (
            <IconButtonContained onClick={showDialog} disabled={isLoading} variant="error">
              {isLoading ? (
                <CircularProgress size={24} sx={{ color: theme.palette.primary.contrastText }} />
              ) : (
                <CallEndIcon sx={{ color: theme.palette.primary.contrastText }} />
              )}
            </IconButtonContained>
          )}
        </ConfirmationDialog>
      </Box>
      <CallSettings onClose={closeSettings} open={isSettingsOpen} />
    </>
  );
};
