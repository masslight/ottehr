/* eslint-disable @typescript-eslint/no-empty-function */
/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { Box } from '@mui/material';
import React, { useState, useEffect, useRef } from 'react';
import { AudioTrack, VideoTrack, Participant } from 'twilio-video';
import { usePatient } from '../store';

interface ParticipantProps {
  participant: Participant;
}

interface HTMLMediaElement {
  setSinkId(sinkId: string): Promise<void>;
}

export const VideoParticipant = ({ participant }: ParticipantProps) => {
  const [videoTracks, setVideoTracks] = useState<(VideoTrack | null)[]>([]);
  const [audioTracks, setAudioTracks] = useState<(AudioTrack | null)[]>([]);
  const { selectedSpeaker } = usePatient();
  // Create refs for the HTML elements to attach audio and video to in the DOM
  const videoRef = useRef<HTMLVideoElement>(null);
  const audioRef = useRef<HTMLMediaElement>(null);

  // Get the audio and video tracks from the participant, filtering out the tracks that are null
  const getExistingVideoTracks = (participant: Participant) => {
    const videoPublications = Array.from(participant.videoTracks.values());
    const existingVideoTracks = videoPublications
      .map((publication) => publication.track)
      .filter((track) => track !== null);
    return existingVideoTracks;
  };

  const getExistingAudioTracks = (participant: Participant) => {
    const audioPublications = Array.from(participant.audioTracks.values());
    const existingAudioTracks = audioPublications
      .map((publication) => publication.track)
      .filter((track) => track !== null);
    return existingAudioTracks;
  };

  // When a new track is added or removed, update the video and audio tracks in the state
  useEffect(() => {
    const trackSubscribed = (track: AudioTrack | VideoTrack) => {
      if (track.kind === 'video') {
        setVideoTracks((videoTracks) => [...videoTracks, track]);
      } else {
        setAudioTracks((audioTracks) => [...audioTracks, track]);
      }
    };

    const trackUnsubscribed = (track: AudioTrack | VideoTrack) => {
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
    // Set up event listeners
    participant.on('trackSubscribed', trackSubscribed);
    participant.on('trackUnsubscribed', trackUnsubscribed);

    // Clean up at the end by removing all the tracks and the event listeners
    return () => {
      console.log('Participant disconnected');
      setVideoTracks([]);
      setAudioTracks([]);
      participant.removeAllListeners();
      // Remove all event listeners from the participant
      participant.videoTracks.forEach((track) => (track.isEnabled = false));
    };
  }, [participant]);

  // When a new videoTrack or audioTrack is subscribed, add it to the DOM.
  // When unsubscribed, detach it
  useEffect(() => {
    const videoTrack = videoTracks[0];
    console.log('Current video track:', videoTrack);

    if (videoRef.current && videoTrack) {
      videoTrack.attach(videoRef.current);
      return () => {
        videoTrack.detach();
      };
    }
    return () => {};
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
    return () => {};
  }, [audioTracks, selectedSpeaker]);

  return (
    <Box
      sx={{
        width: '100%',
        height: '100%',
        position: 'relative',
        overflow: 'hidden',
      }}
      id={participant.identity}
    >
      <Box
        component="video"
        ref={videoRef}
        autoPlay={true}
        sx={{
          width: '100%',
          height: '100%',
          objectFit: 'cover',
        }}
      />
      <Box component="audio" ref={audioRef} autoPlay={true} muted={false} sx={{ display: 'none' }} />
      <Box
        sx={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          color: 'white',
          padding: '0.5rem',
        }}
      >
        {participant.identity}
      </Box>
    </Box>
  );
};
