import CallEndIcon from '@mui/icons-material/CallEnd';
import MicIcon from '@mui/icons-material/Mic';
import MicOffIcon from '@mui/icons-material/MicOff';
import SettingsIcon from '@mui/icons-material/Settings';
import VideocamIcon from '@mui/icons-material/Videocam';
import VideocamOffIcon from '@mui/icons-material/VideocamOff';
import { Box, CircularProgress, useTheme } from '@mui/material';
import { useLocalVideo, useMeetingManager, useToggleLocalMute } from 'amazon-chime-sdk-component-library-react';
import { FC, useState } from 'react';
import { useParams } from 'react-router-dom';
import { TelemedAppointmentStatusEnum } from 'utils';
import { dataTestIds } from '../../../constants/data-test-ids';
import { ConfirmationDialog, IconButtonContained } from '../../components';
import { useOystehrAPIClient } from '../../hooks/useOystehrAPIClient';
import { useAppointmentData, useChangeTelemedAppointmentStatusMutation, useVideoCallStore } from '../../state';
import { updateEncounterStatusHistory } from '../../utils';
import { CallSettings } from './CallSettings';

export const VideoControls: FC = () => {
  const theme = useTheme();

  const apiClient = useOystehrAPIClient();
  const { mutateAsync, isPending: isLoading } = useChangeTelemedAppointmentStatusMutation();
  const { encounter, appointmentSetState } = useAppointmentData();

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
      await mutateAsync({ apiClient, appointmentId, newStatus: TelemedAppointmentStatusEnum.unsigned }, {}).catch(
        (error) => {
          console.error(error);
        }
      );
      appointmentSetState({
        encounter: {
          ...encounter,
          status: 'finished',
          statusHistory: updateEncounterStatusHistory('finished', encounter.statusHistory),
        },
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
        }}
      >
        <IconButtonContained onClick={toggleVideo} variant="primary.lighter">
          {isVideoEnabled ? (
            <VideocamIcon sx={{ color: theme.palette.primary.contrastText }} />
          ) : (
            <VideocamOffIcon sx={{ color: theme.palette.primary.contrastText }} />
          )}
        </IconButtonContained>
        <IconButtonContained onClick={toggleMute} variant="primary.lighter">
          {!muted ? (
            <MicIcon sx={{ color: theme.palette.primary.contrastText }} />
          ) : (
            <MicOffIcon sx={{ color: theme.palette.primary.contrastText }} />
          )}
        </IconButtonContained>
        <IconButtonContained onClick={openSettings} variant="primary.lighter">
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
                <CallEndIcon
                  sx={{ color: theme.palette.primary.contrastText }}
                  data-testid={dataTestIds.telemedEhrFlow.endVideoCallButton}
                />
              )}
            </IconButtonContained>
          )}
        </ConfirmationDialog>
      </Box>
      {isSettingsOpen && <CallSettings onClose={closeSettings} />}
    </>
  );
};
