import CallEndIcon from '@mui/icons-material/CallEnd';
import MicIcon from '@mui/icons-material/Mic';
import MicOffIcon from '@mui/icons-material/MicOff';
import SettingsIcon from '@mui/icons-material/Settings';
import VideocamIcon from '@mui/icons-material/Videocam';
import VideocamOffIcon from '@mui/icons-material/VideocamOff';
import Box from '@mui/material/Box';
import { Dispatch, FC, SetStateAction, useContext, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { LocalParticipant } from 'twilio-video';
import { otherColors } from '../OttehrThemeProvider';
import { DataContext, useVideoParticipant } from '../store';
import { CallSettings } from './CallSettings';
import { useAuth0 } from '@auth0/auth0-react';

interface VideoControlsProps {
  inCallRoom: boolean;
  localParticipant: LocalParticipant | undefined;
}

export const VideoControls: FC<VideoControlsProps> = ({ inCallRoom, localParticipant }) => {
  const navigate = useNavigate();
  const { cleanup, isMicOpen, isVideoOpen, localTracks, room, setIsMicOpen, setIsVideoOpen } = useVideoParticipant();
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const { state } = useContext(DataContext);
  const { isAuthenticated } = useAuth0();

  const openSettings = (): void => {
    setIsSettingsOpen(true);
  };

  const closeSettings = (): void => {
    setIsSettingsOpen(false);
  };

  const disconnect = (): void => {
    cleanup();
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
          resourceId: room?.name || '',
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

  const toggleTrack = (kind: 'audio' | 'video', setState: Dispatch<SetStateAction<boolean>>): void => {
    if (!localParticipant) return;

    const tracks = localTracks.filter((track) => track.kind === kind);

    tracks.forEach((localTrack) => {
      if (localTrack.isEnabled) {
        localTrack.disable();
        setState(false);
      } else {
        localTrack.enable();
        setState(true);
      }
    });
  };

  const toggleMic = (): void => toggleTrack('audio', setIsMicOpen);
  const toggleVideo = (): void => toggleTrack('video', setIsVideoOpen);

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
        {isVideoOpen ? (
          <VideocamIcon onClick={toggleVideo} sx={{ color: 'white' }} />
        ) : (
          <VideocamOffIcon onClick={toggleVideo} sx={{ color: 'white' }} />
        )}
        {isMicOpen ? (
          <MicIcon onClick={toggleMic} sx={{ color: 'white' }} />
        ) : (
          <MicOffIcon onClick={toggleMic} sx={{ color: 'white' }} />
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
      <CallSettings localParticipant={localParticipant} onClose={closeSettings} open={isSettingsOpen} />
    </>
  );
};
