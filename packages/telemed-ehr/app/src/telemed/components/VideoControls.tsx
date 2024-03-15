import { Box, useTheme } from '@mui/material';
import { FC, useState } from 'react';
import { LocalParticipant } from 'twilio-video';
import MicIcon from '@mui/icons-material/Mic';
import MicOffIcon from '@mui/icons-material/MicOff';
import VideocamIcon from '@mui/icons-material/Videocam';
import VideocamOffIcon from '@mui/icons-material/VideocamOff';
import SettingsIcon from '@mui/icons-material/Settings';
import CallEndIcon from '@mui/icons-material/CallEnd';
import { CallSettings } from './CallSettings';
import { getSelectors } from '../../shared/store/getSelectors';
import { useVideoCallStore } from '../state';
import { pip } from '../assets';
import { IconButtonContained } from './IconButtonContained';

interface VideoControlsProps {
  localParticipant: LocalParticipant | undefined;
}

export const VideoControls: FC<VideoControlsProps> = ({ localParticipant }) => {
  const { room, localTracks, isVideoOpen, isMicOpen, setIsMicOpen, setIsVideoOpen } = getSelectors(useVideoCallStore, [
    'room',
    'localTracks',
    'isVideoOpen',
    'isMicOpen',
    'setIsMicOpen',
    'setIsVideoOpen',
  ]);

  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const theme = useTheme();

  const openSettings = (): void => {
    setIsSettingsOpen(true);
  };

  const closeSettings = (): void => {
    setIsSettingsOpen(false);
  };

  const disconnect = (): void => {
    if (room) {
      room.localParticipant.tracks.forEach((trackPub) => {
        if (trackPub.track.kind === 'audio' || trackPub.track.kind === 'video') {
          trackPub.track.stop();
          trackPub.track.disable();
          trackPub.track.detach().forEach((element) => element.remove());
          trackPub.unpublish();
        }
      });
      room.disconnect();
    }
    useVideoCallStore.setState({ videoToken: undefined });
  };

  const toggleTrack = (kind: 'audio' | 'video', setState: (value: boolean) => void): void => {
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
          display: 'flex',
          alignItems: 'center',
          gap: 3,
          py: 2,
        }}
      >
        <IconButtonContained onClick={toggleVideo} variant={isVideoOpen ? undefined : 'disabled'}>
          {isVideoOpen ? (
            <VideocamIcon sx={{ color: theme.palette.primary.contrastText }} />
          ) : (
            <VideocamOffIcon sx={{ color: theme.palette.primary.dark }} />
          )}
        </IconButtonContained>
        <IconButtonContained onClick={toggleMic} variant={isMicOpen ? undefined : 'disabled'}>
          {isMicOpen ? (
            <MicIcon sx={{ color: theme.palette.primary.contrastText }} />
          ) : (
            <MicOffIcon sx={{ color: theme.palette.primary.dark }} />
          )}
        </IconButtonContained>
        <IconButtonContained>
          <img src={pip} alt="pip icon" />
        </IconButtonContained>
        <IconButtonContained onClick={openSettings}>
          <SettingsIcon sx={{ color: theme.palette.primary.contrastText }} />
        </IconButtonContained>
        <IconButtonContained onClick={disconnect} variant="error">
          <CallEndIcon sx={{ color: theme.palette.primary.contrastText }} />
        </IconButtonContained>
      </Box>
      <CallSettings localParticipant={localParticipant} onClose={closeSettings} open={isSettingsOpen} />
    </>
  );
};
