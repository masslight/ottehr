import CallEndIcon from '@mui/icons-material/CallEnd';
import MicIcon from '@mui/icons-material/Mic';
import MicOffIcon from '@mui/icons-material/MicOff';
import SettingsIcon from '@mui/icons-material/Settings';
import VideocamIcon from '@mui/icons-material/Videocam';
import VideocamOffIcon from '@mui/icons-material/VideocamOff';
import Box from '@mui/material/Box';
import { Dispatch, FC, SetStateAction, useContext, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { otherColors } from '../OttehrThemeProvider';
import { DataContext, useVideoParticipant } from '../store';
import { CallSettings } from './CallSettings';
import { useAuth0 } from '@auth0/auth0-react';
import { useLocalVideo, useAudioVideo, useMeetingManager, useToggleLocalMute } from 'amazon-chime-sdk-component-library-react';

interface VideoControlsProps {
  inCallRoom: boolean;
}

export const VideoControls: FC<VideoControlsProps> = ({ inCallRoom }) => {
  const navigate = useNavigate();
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const { state } = useContext(DataContext);
  const { isAuthenticated } = useAuth0();

  // const [isMicMuted, setIsMicMuted] = useState(false);

  const { toggleVideo, isVideoEnabled } = useLocalVideo();
  const { muted, toggleMute } = useToggleLocalMute();
  // const audioVideo = useAudioVideo();

  const meetingManager = useMeetingManager();

  const openSettings = (): void => {
    setIsSettingsOpen(true);
  };

  const closeSettings = (): void => {
    setIsSettingsOpen(false);
  };

  // const toggleMic = () => {
  //   if (!audioVideo) return;
  //   if (isMicMuted) {
  //     audioVideo.realtimeUnmuteLocalAudio();
  //   } else {
  //     audioVideo.realtimeMuteLocalAudio();
  //   }
  //   setIsMicMuted(!isMicMuted);
  // };

  const disconnect = (): void => {
    if (isAuthenticated) {
      state.fhirClient
        ?.patchResource({
          operations: [
            {
              op: 'replace',
              path: '/status',
              value: 'finished',
            },
          ],
          resourceId: meetingManager.meetingSession?.configuration.externalMeetingId || '',
          resourceType: 'Encounter',
        })
        .catch((err) => {
          console.error(err);
        });
      navigate('/provider-post-call', {
        state: {
          isProvider: true,
        },
      });
    } else {
      navigate('/patient-post-call');
    }
  };


  return (
    <>
      <Box
        sx={{
          alignItems: 'center',
          backgroundColor: otherColors.biscay,
          borderRadius: 5,
          bottom: 16,
          display: 'flex',
          gap: 1,
          justifyContent: 'center',
          left: '50%',
          maxWidth: 'fit-content',
          position: 'absolute',
          px: 2,
          py: 1,
          transform: 'translate(-50%, 0)',
        }}
      >
        {isVideoEnabled ? (
          <VideocamIcon onClick={toggleVideo} sx={{ color: 'white' }} />
        ) : (
          <VideocamOffIcon onClick={toggleVideo} sx={{ color: 'white' }} />
        )}
        {muted ? (
          <MicOffIcon onClick={toggleMute} sx={{ color: 'white' }} />
        ) : (
          <MicIcon onClick={toggleMute} sx={{ color: 'white' }} />
        )}
        <SettingsIcon onClick={openSettings} sx={{ color: 'white' }} />
        {inCallRoom && (
          <Box
            sx={{
              alignItems: 'center',
              backgroundColor: 'red',
              borderRadius: '50%',
              display: 'flex',
              height: 30,
              justifyContent: 'center',
              width: 30,
            }}
          >
            <CallEndIcon onClick={disconnect} sx={{ color: 'white' }} />
          </Box>
        )}
      </Box>
      <CallSettings onClose={closeSettings} open={isSettingsOpen} />
    </>
  );
};
