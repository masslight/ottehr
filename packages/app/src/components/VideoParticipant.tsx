import { Box } from '@mui/material';
import { FC, useState, useEffect, useRef } from 'react';
import {
  AudioTrack,
  VideoTrack,
  Participant,
  LocalVideoTrack,
  RemoteVideoTrack,
  LocalAudioTrack,
  RemoteAudioTrack,
} from 'twilio-video';
import { useVideoParticipant } from '../store';

interface ParticipantProps {
  participant: Participant;
}

interface HTMLMediaElement {
  setSinkId(sinkId: string): Promise<void>;
}

export const VideoParticipant: FC<ParticipantProps> = ({ participant }) => {
  const [videoTracks, setVideoTracks] = useState<(VideoTrack | null)[]>([]);
  const [audioTracks, setAudioTracks] = useState<(AudioTrack | null)[]>([]);
  const { selectedSpeaker } = useVideoParticipant();

  const videoRef = useRef<HTMLVideoElement>(null);
  const audioRef = useRef<HTMLMediaElement>(null);

  // Get the audio and video tracks from the participant, filtering out the tracks that are null
  const getExistingVideoTracks = (participant: Participant): (LocalVideoTrack | RemoteVideoTrack | null)[] => {
    const videoPublications = Array.from(participant.videoTracks.values());
    const existingVideoTracks = videoPublications
      .map((publication) => publication.track)
      .filter((track) => track !== null);
    return existingVideoTracks;
  };

  const getExistingAudioTracks = (participant: Participant): (LocalAudioTrack | RemoteAudioTrack | null)[] => {
    const audioPublications = Array.from(participant.audioTracks.values());
    const existingAudioTracks = audioPublications
      .map((publication) => publication.track)
      .filter((track) => track !== null);
    return existingAudioTracks;
  };

  // When a new track is added or removed, update the video and audio tracks in the state
  useEffect(() => {
    const trackSubscribed = (track: AudioTrack | VideoTrack): void => {
      if (track.kind === 'video') {
        setVideoTracks((videoTracks) => [...videoTracks, track]);
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

    setVideoTracks(getExistingVideoTracks(participant));
    setAudioTracks(getExistingAudioTracks(participant));

    participant.on('trackEnabled', (track) => {
      console.log(`Track enabled: ${track.kind}`);
    });
    participant.on('trackDisabled', (track) => {
      console.log(`Track disabled: ${track.kind}`);
    });
    participant.on('trackSubscribed', trackSubscribed);
    participant.on('trackUnsubscribed', trackUnsubscribed);

    // Clean up at the end by removing all the tracks and the event listeners
    return () => {
      setVideoTracks([]);
      setAudioTracks([]);
      participant.removeAllListeners();
      participant.videoTracks.forEach((track) => (track.isEnabled = false));
    };
  }, [participant]);

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
      if (selectedSpeaker && typeof audioRef.current.setSinkId === 'function') {
        audioRef.current.setSinkId(selectedSpeaker).catch((err: Error) => {
          console.warn('Could not set Sink ID:', err);
        });
      }

      return () => {
        audioTrack.detach();
      };
    }
    return () => undefined;
  }, [audioTracks, selectedSpeaker]);

  return (
    <Box
      id={participant.identity}
      sx={{
        height: '100%',
        overflow: 'hidden',
        position: 'relative',
        width: '100%',
      }}
    >
      <Box
        autoPlay={true}
        component="video"
        ref={videoRef}
        sx={{
          height: '100%',
          objectFit: 'cover',
          width: '100%',
        }}
      />
      <Box autoPlay={true} component="audio" muted={false} ref={audioRef} sx={{ display: 'none' }} />
      <Box
        sx={{
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          bottom: 0,
          color: 'white',
          left: 0,
          padding: '0.5rem',
          position: 'absolute',
        }}
      >
        {participant.identity}
      </Box>
    </Box>
  );
};
