import { Box, Typography } from '@mui/material';
import { FC, useEffect, useRef, useState } from 'react';
import {
  AudioTrack,
  LocalAudioTrack,
  LocalVideoTrack,
  Participant,
  RemoteAudioTrack,
  RemoteVideoTrack,
  VideoTrack,
} from 'twilio-video';
import { getSelectors } from '../../shared/store/getSelectors';
import { useAppointmentStore, useVideoCallStore } from '../state';
interface ParticipantProps {
  participant: Participant;
}

interface HTMLMediaElement {
  setSinkId(sinkId: string): Promise<void>;
}

export const VideoParticipant: FC<ParticipantProps> = ({ participant }) => {
  const audioRef = useRef<HTMLMediaElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const videoCallState = getSelectors(useVideoCallStore, ['selectedSpeaker']);
  const [videoTracks, setVideoTracks] = useState<(VideoTrack | null)[]>([]);
  const [audioTracks, setAudioTracks] = useState<(AudioTrack | null)[]>([]);

  const { patient } = getSelectors(useAppointmentStore, ['patient']);

  const [isVideoEnabled, setIsVideoEnabled] = useState<boolean>();
  // Get the audio and video tracks from the participant, filtering out the tracks that are null
  const getExistingAudioTracks = (participant: Participant): (LocalAudioTrack | RemoteAudioTrack | null)[] => {
    const audioPublications = Array.from(participant.audioTracks.values());
    const existingAudioTracks = audioPublications
      .map((publication) => publication.track)
      .filter((track) => track !== null);
    return existingAudioTracks;
  };

  const getExistingVideoTracks = (participant: Participant): (LocalVideoTrack | RemoteVideoTrack | null)[] => {
    const videoPublications = Array.from(participant.videoTracks.values());
    const existingVideoTracks = videoPublications
      .map((publication) => publication.track)
      .filter((track) => track !== null);
    return existingVideoTracks;
  };

  // When a new track is added or removed, update the video and audio tracks in the state
  useEffect(() => {
    const trackSubscribed = (track: AudioTrack | VideoTrack): void => {
      if (track.kind === 'video') {
        setVideoTracks((videoTracks) => [...videoTracks, track]);
        setIsVideoEnabled(track.isEnabled);
      } else {
        setAudioTracks((audioTracks) => [...audioTracks, track]);
      }
    };

    const trackUnsubscribed = (track: AudioTrack | VideoTrack): void => {
      if (track.kind === 'video') {
        setVideoTracks((videoTracks) => videoTracks.filter((v) => v !== track));
      } else {
        setAudioTracks((audioTracks) => audioTracks.filter((a) => a !== track));
      }
    };

    setAudioTracks(getExistingAudioTracks(participant));
    setVideoTracks(getExistingVideoTracks(participant));

    const trackEnabled = (track: AudioTrack | VideoTrack): void => {
      if (track.kind === 'video') {
        setIsVideoEnabled(true);
      }
    };

    const trackDisabled = (track: AudioTrack | VideoTrack): void => {
      if (track.kind === 'video') {
        setIsVideoEnabled(false);
      }
    };

    participant.on('trackEnabled', trackEnabled);
    participant.on('trackDisabled', trackDisabled);

    participant.on('trackSubscribed', trackSubscribed);
    participant.on('trackUnsubscribed', trackUnsubscribed);

    // Clean up at the end by removing all the tracks and the event listeners
    return () => {
      setAudioTracks([]);
      setVideoTracks([]);
      participant.off('trackEnabled', trackEnabled);
      participant.off('trackDisabled', trackDisabled);
      participant.removeAllListeners();
      participant.videoTracks.forEach((track) => (track.isEnabled = false));
    };
  }, [isVideoEnabled, participant]);

  // When a new videoTrack or audioTrack is subscribed, add it to the DOM.
  // When unsubscribed, detach it
  useEffect(() => {
    const videoTrack = videoTracks[0];

    if (videoRef.current && videoTrack) {
      videoTrack.attach(videoRef.current);
      return () => {
        videoTrack.detach();
      };
    }
    return () => undefined;
  }, [videoTracks]);

  useEffect(() => {
    const audioTrack = audioTracks[0];

    if (audioRef.current && audioTrack) {
      (audioTrack.attach as any)(audioRef.current);
      if (videoCallState.selectedSpeaker && typeof audioRef.current.setSinkId === 'function') {
        audioRef.current.setSinkId(videoCallState.selectedSpeaker).catch((err: Error) => {
          console.warn('Could not set Sink ID:', err);
        });
      }

      return () => {
        audioTrack.detach();
      };
    }
    return () => undefined;
  }, [audioTracks, videoCallState.selectedSpeaker]);

  return (
    <Box
      id={participant.identity}
      sx={{
        height: '557px',
        width: '100%',
        position: 'relative',
      }}
    >
      {!isVideoEnabled && (
        <Box
          sx={{
            display: 'flex',
            height: '100%',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Typography>No video</Typography>
        </Box>
      )}
      {isVideoEnabled && (
        <Box
          autoPlay={true}
          component="video"
          ref={videoRef}
          sx={{
            height: '100%',
            width: '100%',
            objectFit: 'cover',
          }}
        />
      )}
      <Box
        sx={{
          position: 'absolute',
          top: 0,
          left: 0,
          height: 60,
          width: '100%',
          backgroundImage: 'linear-gradient(rgba(0,0,0,0.7), rgba(0,0,0,0))',
          pt: '10px',
          pl: '10px',
        }}
      >
        <Typography sx={{ fontWeight: 700, fontSize: '14px' }}>
          {patient?.name?.[0]?.given?.[0]} {patient?.name?.[0]?.family} (patient)
        </Typography>
      </Box>
      <Box autoPlay={true} component="audio" muted={false} ref={audioRef} sx={{ display: 'none' }} />
    </Box>
  );
};
