import CallEndIcon from '@mui/icons-material/CallEnd';
import MicIcon from '@mui/icons-material/Mic';
import MicOffIcon from '@mui/icons-material/MicOff';
import SettingsIcon from '@mui/icons-material/Settings';
import VideocamIcon from '@mui/icons-material/Videocam';
import VideocamOffIcon from '@mui/icons-material/VideocamOff';
import { Box, useTheme } from '@mui/material';
import { useLocalVideo, useMeetingManager, useToggleLocalMute } from 'amazon-chime-sdk-component-library-react';
import { FC, useState } from 'react';
import { ConfirmationDialog } from 'src/components/ConfirmationDialog';
import { dataTestIds } from 'src/constants/data-test-ids';
import { IconButtonContained } from 'src/features/visits/shared/components/IconButtonContained';
import { useAppointmentData } from 'src/features/visits/shared/stores/appointment/appointment.store';
import { useApiClients } from 'src/hooks/useAppClients';
import { useVideoCallStore } from '../../state/video-call/video-call.store';
import { CallSettings } from './CallSettings';

export const VideoControls: FC = () => {
  const theme = useTheme();

  const { oystehr } = useApiClients();
  const { encounter } = useAppointmentData();
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
    if (!oystehr || !encounter.id) {
      // Throw so ConfirmationDialog surfaces an error and keeps the dialog open, rather than silently
      // tearing down only the provider's side while the patient stays in the meeting.
      throw new Error('Unable to end the video call: the session is not ready yet. Please try again in a moment.');
    }
    // Immediately end the meeting for all participants. This also triggers the recording pipeline right away
    // instead of waiting for the room to time out. If endMeeting throws, we intentionally do NOT run cleanup():
    // the provider stays connected and can retry, instead of being told the call ended for everyone while the
    // patient is in fact still in the room.
    await oystehr.telemed.endMeeting({ encounterId: encounter.id });
    useVideoCallStore.setState((state) => ({ endedCallCount: state.endedCallCount + 1 }));
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
          description="This will permanently end the meeting for all participants and cannot be undone."
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
            <IconButtonContained onClick={showDialog} variant="error">
              <CallEndIcon
                sx={{ color: theme.palette.primary.contrastText }}
                data-testid={dataTestIds.telemedEhrFlow.endVideoCallButton}
              />
            </IconButtonContained>
          )}
        </ConfirmationDialog>
      </Box>
      {isSettingsOpen && <CallSettings onClose={closeSettings} />}
    </>
  );
};
