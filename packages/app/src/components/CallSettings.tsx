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
import { useEffect, useRef, useState } from 'react';

interface CallSettingsProps {
  open: boolean;
  onClose: () => void;
  localParticipant: LocalParticipant | undefined;
}

export const CallSettings: React.FC<CallSettingsProps> = ({ open, onClose, localParticipant }) => {
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
    <Dialog open={open} onClose={onClose} maxWidth="sm">
      <DialogTitle>Call settings</DialogTitle>
      <DialogContent>
        {/* Camera preview */}
        <Box
          ref={videoRef}
          sx={{
            width: '100%',
            height: '100%',
          }}
        />
        {/* Camera selection */}
        <FormControl fullWidth variant="outlined" margin="normal">
          <InputLabel id="camera-label">Camera</InputLabel>
          <Select labelId="camera-label" value={camera} label="Camera" onChange={handleCameraChange}>
            {videoInputDevices.map((device) => (
              <MenuItem key={device.deviceId} value={device.deviceId}>
                {device.label}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
        {/* Microphone selection */}
        <FormControl fullWidth variant="outlined" margin="normal">
          <InputLabel id="microphone-label">Microphone</InputLabel>
          <Select labelId="microphone-label" value={microphone} label="Microphone" onChange={handleMicrophoneChange}>
            {audioInputDevices.map((device) => (
              <MenuItem key={device.deviceId} value={device.deviceId}>
                {device.label}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
        {/* Speakers selection */}
        <FormControl fullWidth variant="outlined" margin="normal">
          <InputLabel id="speakers-label">Speakers</InputLabel>
          <Select labelId="speakers-label" value={speakers} label="Speakers" onChange={handleSpeakersChange}>
            {audioOutputDevices.map((device) => (
              <MenuItem key={device.deviceId} value={device.deviceId}>
                {device.label}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
        <Button variant="contained" color="primary" style={{ marginTop: '16px' }}>
          Having technical issues with the call?
        </Button>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} color="primary">
          Cancel
        </Button>
        <Button onClick={handleSave} color="primary">
          Save Changes
        </Button>
      </DialogActions>
    </Dialog>
  );
};
