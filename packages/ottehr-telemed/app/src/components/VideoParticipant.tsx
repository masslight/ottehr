import { Box } from '@mui/material';
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
import { otherColors } from '../OttehrThemeProvider';
import { useVideoParticipant } from '../store';
import { defaultPatient, defaultProvider } from '../assets/icons';
import { t } from 'i18next';
import { useAuth0 } from '@auth0/auth0-react';
interface ParticipantProps {
  participant: Participant;
}

interface HTMLMediaElement {
  setSinkId(sinkId: string): Promise<void>;
}

export const VideoParticipant: FC<ParticipantProps> = ({ participant }) => {
  const audioRef = useRef<HTMLMediaElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const { selectedSpeaker, remoteParticipantName } = useVideoParticipant();
  const [videoTracks, setVideoTracks] = useState<(VideoTrack | null)[]>([]);
  const [audioTracks, setAudioTracks] = useState<(AudioTrack | null)[]>([]);

  const [isVideoEnabled, setIsVideoEnabled] = useState<boolean>();

  const { isAuthenticated, isLoading } = useAuth0();
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
      {!isVideoEnabled && (
        <Box
          sx={{
            alignItems: 'center',
            display: 'flex',
            height: '100%',
            justifyContent: 'center',
          }}
        >
          {isAuthenticated && !isLoading ? (
            <img alt={t('imageAlts.patient')} height="100px" src={defaultPatient} />
          ) : (
            <img alt={t('imageAlts.provider')} height="100px" src={defaultProvider} />
          )}
        </Box>
      )}
      {isVideoEnabled && (
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
      )}
      <Box autoPlay={true} component="audio" muted={false} ref={audioRef} sx={{ display: 'none' }} />
      <Box
        sx={{
          backgroundColor: otherColors.blackTransparent,
          bottom: 0,
          color: 'white',
          left: 0,
          padding: '0.5rem',
          position: 'absolute',
        }}
      >
        {remoteParticipantName}
      </Box>
    </Box>
  );
};
