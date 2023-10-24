import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  SelectChangeEvent,
} from '@mui/material';
import {
  createLocalAudioTrack,
  createLocalVideoTrack,
  LocalAudioTrack,
  LocalVideoTrack,
  LocalParticipant,
} from 'twilio-video';
import { useVideoParticipant } from '../store';
import useDevices from '../hooks/twilio/useDevices';
import { FC, useEffect, useRef, useState } from 'react';

interface CallSettingsProps {
  localParticipant: LocalParticipant | undefined;
  onClose: () => void;
  open: boolean;
}

export const CallSettings: FC<CallSettingsProps> = ({ localParticipant, onClose, open }) => {
  const { localTracks, setLocalTracks, selectedSpeaker, setSelectedSpeaker } = useVideoParticipant();
  const { audioInputDevices, videoInputDevices, audioOutputDevices } = useDevices();

  const videoRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let localVideoTrackCleanup: LocalVideoTrack | null = null;

    const attachVideo = (newTrack: LocalVideoTrack): void => {
      if (videoRef.current) {
        const videoElement = newTrack.attach();
        videoElement.style.width = '100%';
        videoElement.style.height = '100%';
        videoRef.current.appendChild(videoElement);
      }
    };

    const detachVideo = (): void => {
      if (videoRef.current) {
        videoRef.current.querySelectorAll('video').forEach((v) => v.remove());
      }
    };

    if (open) {
      createLocalVideoTrack()
        .then((newTrack) => {
          attachVideo(newTrack);
          localVideoTrackCleanup = newTrack;
        })
        .catch((error) => console.error('Failed to create video track:', error));
    }

    return () => {
      detachVideo();
      if (localVideoTrackCleanup) {
        localVideoTrackCleanup.stop();
      }
    };
  }, [open]);

  const [speakers, setSpeakers] = useState<string | number>(selectedSpeaker || '');

  const [camera, setCamera] = useState<string | number>('');
  const [microphone, setMicrophone] = useState<string | number>('');

  const updateDevice = async (type: string, deviceId: string): Promise<void> => {
    if (!localParticipant) return;

    let newTrack;

    switch (type) {
      case 'audioInput':
        newTrack = await createLocalAudioTrack({ deviceId: { exact: deviceId } });
        break;
      case 'videoInput':
        newTrack = await createLocalVideoTrack({ deviceId: { exact: deviceId } });
        break;
      default:
        return;
    }

    const updatedLocalTracks = localTracks.filter((track) => {
      if (track.kind === type.slice(0, -5)) {
        localParticipant.unpublishTrack(track);
        track.stop();
        return false;
      }
      return true;
    });

    localParticipant.publishTrack(newTrack).catch((error) => {
      console.error('Failed to publish track', error);
    });

    updatedLocalTracks.push(newTrack as LocalAudioTrack | LocalVideoTrack);
    setLocalTracks(updatedLocalTracks);
  };

  const handleCameraChange = (e: SelectChangeEvent<string | number>): void => {
    const selectedCamera = e.target.value;
    setCamera(selectedCamera);
  };

  const handleMicrophoneChange = (e: SelectChangeEvent<string | number>): void => {
    const selectedMicrophone = e.target.value;
    setMicrophone(selectedMicrophone);
  };

  const handleSpeakersChange = (e: SelectChangeEvent<string | number>): void => {
    const selectedSpeakers = e.target.value;
    setSpeakers(selectedSpeakers);
  };

  const handleSave = async (): Promise<void> => {
    if (camera) {
      await updateDevice('videoInput', String(camera));
    }
    if (microphone) {
      await updateDevice('audioInput', String(microphone));
    }
    if (speakers) {
      setSelectedSpeaker(String(speakers));
    }
    onClose();
  };

  return (
    <Dialog maxWidth="sm" onClose={onClose} open={open}>
      <DialogTitle>Call settings</DialogTitle>
      <DialogContent>
        {/* Camera preview */}
        <Box
          ref={videoRef}
          sx={{
            height: '100%',
            width: '100%',
          }}
        />
        {/* Camera selection */}
        <FormControl fullWidth margin="normal" variant="outlined">
          <InputLabel id="camera-label">Camera</InputLabel>
          <Select label="Camera" labelId="camera-label" onChange={handleCameraChange} value={camera}>
            {videoInputDevices.map((device) => (
              <MenuItem key={device.deviceId} value={device.deviceId}>
                {device.label}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
        {/* Microphone selection */}
        <FormControl fullWidth margin="normal" variant="outlined">
          <InputLabel id="microphone-label">Microphone</InputLabel>
          <Select label="Microphone" labelId="microphone-label" onChange={handleMicrophoneChange} value={microphone}>
            {audioInputDevices.map((device) => (
              <MenuItem key={device.deviceId} value={device.deviceId}>
                {device.label}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
        {/* Speakers selection */}
        <FormControl fullWidth margin="normal" variant="outlined">
          <InputLabel id="speakers-label">Speakers</InputLabel>
          <Select label="Speakers" labelId="speakers-label" onChange={handleSpeakersChange} value={speakers}>
            {audioOutputDevices.map((device) => (
              <MenuItem key={device.deviceId} value={device.deviceId}>
                {device.label}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
        <Button color="primary" style={{ marginTop: '16px' }} variant="contained">
          Having technical issues with the call?
        </Button>
      </DialogContent>
      <DialogActions>
        <Button color="primary" onClick={onClose}>
          Cancel
        </Button>
        <Button color="primary" onClick={handleSave}>
          Save Changes
        </Button>
      </DialogActions>
    </Dialog>
  );
};
