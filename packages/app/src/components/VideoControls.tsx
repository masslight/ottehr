import Box from '@mui/material/Box';
import React, { useState } from 'react';
import { LocalAudioTrack, LocalParticipant, LocalVideoTrack } from 'twilio-video';

import CallEndIcon from '@mui/icons-material/CallEnd';
import MicIcon from '@mui/icons-material/Mic';
import MicOffIcon from '@mui/icons-material/MicOff';
import SettingsIcon from '@mui/icons-material/Settings';
import VideocamIcon from '@mui/icons-material/Videocam';
import VideocamOffIcon from '@mui/icons-material/VideocamOff';

import { useNavigate } from 'react-router-dom';
import { useVideoParticipant } from '../store';
import { CallSettings } from './CallSettings';

interface VideoControlsProps {
  localParticipant: LocalParticipant | undefined;
  inCallRoom: boolean;
}

export const VideoControls: React.FC<VideoControlsProps> = ({ localParticipant, inCallRoom }) => {
  const { room, localTracks, isMicOpen, setIsMicOpen, isVideoOpen, setIsVideoOpen } = useVideoParticipant();
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const navigate = useNavigate();

  const openSettings = (): void => {
    setIsSettingsOpen(true);
  };

  const closeSettings = (): void => {
    setIsSettingsOpen(false);
  };

  const disconnect = (): void => {
    room?.disconnect();
    navigate('/post-call');
  };

  const toggleVideo = (): void => {
    if (localParticipant) {
      const videoTracks = localTracks.filter((track) => track.kind === 'video') as LocalVideoTrack[];
      videoTracks.forEach((localTrack) => {
        if (localTrack.isEnabled) {
          localTrack.disable();
          setIsVideoOpen(false);
        } else {
          localTrack.enable();
          setIsVideoOpen(true);
        }
      });
    }
  };

  const toggleMic = (): void => {
    if (localParticipant) {
      const audioTracks = localTracks.filter((track) => track.kind === 'audio') as LocalAudioTrack[];

      audioTracks.forEach((localTrack) => {
        if (localTrack.isEnabled) {
          localTrack.disable();
          setIsMicOpen(false);
        } else {
          localTrack.enable();
          setIsMicOpen(true);
        }
      });
    }
  };

  return (
    <>
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          backgroundColor: 'rgba(50, 63, 83, 0.87)',
          px: 2,
          py: 1,
          gap: 1,
          maxWidth: 'fit-content',
          borderRadius: 5,
          position: 'absolute',
          bottom: 16,
          left: '50%',
          transform: 'translate(-50%, 0)',
        }}
      >
        {isVideoOpen ? (
          <VideocamIcon sx={{ color: 'white' }} onClick={toggleVideo} />
        ) : (
          <VideocamOffIcon sx={{ color: 'white' }} onClick={toggleVideo} />
        )}
        {isMicOpen ? (
          <MicIcon sx={{ color: 'white' }} onClick={toggleMic} />
        ) : (
          <MicOffIcon sx={{ color: 'white' }} onClick={toggleMic} />
        )}
        <SettingsIcon sx={{ color: 'white' }} onClick={openSettings} />
        {inCallRoom && (
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: '50%',
              backgroundColor: 'red',
              width: 30,
              height: 30,
            }}
          >
            <CallEndIcon sx={{ color: 'white' }} onClick={disconnect} />
          </Box>
        )}
      </Box>
      <CallSettings open={isSettingsOpen} onClose={closeSettings} localParticipant={localParticipant} />
    </>
  );
};
