import { FC, useState } from 'react';
import { LocalAudioTrack, LocalVideoTrack } from 'twilio-video';
import { useNavigate } from 'react-router-dom';
import { Box } from '@mui/material';
import MicIcon from '@mui/icons-material/Mic';
import MicOffIcon from '@mui/icons-material/MicOff';
import VideocamIcon from '@mui/icons-material/Videocam';
import VideocamOffIcon from '@mui/icons-material/VideocamOff';
import CallEndIcon from '@mui/icons-material/CallEnd';
import { getSelectors } from 'ottehr-utils';
import { CallSettings } from './CallSettings';
import { useVideoCallStore } from '../features/video-call';
import { otherColors } from '../IntakeThemeProvider';
import { IconButtonContained } from './IconButtonContained';
import { CallSettingsTooltip } from './CallSettingsTooltip';

export const VideoControls: FC = () => {
  const { room, localTracks, isVideoOpen, isMicOpen, setIsMicOpen, setIsVideoOpen } = getSelectors(useVideoCallStore, [
    'room',
    'localTracks',
    'isVideoOpen',
    'isMicOpen',
    'setIsMicOpen',
    'setIsVideoOpen',
  ]);

  const navigate = useNavigate();
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isTooltipOpen, setIsTooltipOpen] = useState(false);

  const handleTooltipClose = (): void => {
    setIsTooltipOpen(false);
  };

  const handleTooltipOpen = (): void => {
    setIsTooltipOpen(true);
  };

  const openSettings = (): void => {
    setIsSettingsOpen(true);
  };

  const closeSettings = (): void => {
    setIsSettingsOpen(false);
  };

  const disconnect = (): void => {
    room?.localParticipant.tracks.forEach((trackPub) => {
      if (trackPub.track.kind === 'audio' || trackPub.track.kind === 'video') {
        (trackPub.track as LocalAudioTrack | LocalVideoTrack).stop();
      }
    });
    room?.disconnect();
    navigate('/post-call');
  };

  const toggleTrack = (kind: 'audio' | 'video', setState: (value: boolean) => void): void => {
    if (!room?.localParticipant) return;

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
          backgroundColor: otherColors.darkPurple,
          display: 'flex',
          gap: 3,
          justifyContent: 'center',
          py: 2,
        }}
      >
        <IconButtonContained onClick={toggleVideo} variant={isVideoOpen ? undefined : 'disabled'}>
          {isVideoOpen ? (
            <VideocamIcon sx={{ color: otherColors.white }} />
          ) : (
            <VideocamOffIcon sx={{ color: otherColors.darkPurple }} />
          )}
        </IconButtonContained>
        <IconButtonContained onClick={toggleMic} variant={isMicOpen ? undefined : 'disabled'}>
          {isMicOpen ? (
            <MicIcon sx={{ color: otherColors.white }} />
          ) : (
            <MicOffIcon sx={{ color: otherColors.darkPurple }} />
          )}
        </IconButtonContained>
        <CallSettingsTooltip
          isTooltipOpen={isTooltipOpen}
          handleTooltipOpen={handleTooltipOpen}
          handleTooltipClose={handleTooltipClose}
          openSettings={openSettings}
        />
        <IconButtonContained onClick={disconnect} variant="error">
          <CallEndIcon sx={{ color: otherColors.white }} />
        </IconButtonContained>
      </Box>
      <CallSettings onClose={closeSettings} open={isSettingsOpen} />
    </>
  );
};
