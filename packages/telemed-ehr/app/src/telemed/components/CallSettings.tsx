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
import { FC, useEffect, useRef, useState } from 'react';
import {
  createLocalAudioTrack,
  createLocalVideoTrack,
  LocalAudioTrack,
  LocalVideoTrack,
  LocalParticipant,
} from 'twilio-video';
import { useDevices } from '../hooks';
import { getSelectors } from '../../shared/store/getSelectors';
import { useVideoCallStore } from '../state';

interface CallSettingsProps {
  localParticipant: LocalParticipant | undefined;
  onClose: () => void;
  open: boolean;
}

interface Device {
  deviceId: string;
  label: string;
}

interface DeviceSelectorProps {
  devices: Device[];
  handleChange: (e: SelectChangeEvent<string>) => void;
  label: string;
  selectedDevice: string;
}

const DeviceSelector: FC<DeviceSelectorProps> = ({ devices, selectedDevice, handleChange, label }) => (
  <FormControl fullWidth margin="normal" variant="outlined">
    <InputLabel>{label}</InputLabel>
    <Select label={label} onChange={handleChange} value={selectedDevice}>
      {devices.map((device) => (
        <MenuItem key={device.deviceId} value={device.deviceId}>
          {device.label}
        </MenuItem>
      ))}
    </Select>
  </FormControl>
);

export const CallSettings: FC<CallSettingsProps> = ({ localParticipant, onClose, open }) => {
  const { audioInputDevices, videoInputDevices, audioOutputDevices } = useDevices();
  const videoRef = useRef<HTMLDivElement | null>(null);
  const videoCallState = getSelectors(useVideoCallStore, [
    'localTracks',
    'setLocalTracks',
    'selectedSpeaker',
    'setSelectedSpeaker',
  ]);

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

  const [camera, setCamera] = useState<string>('');
  const [microphone, setMicrophone] = useState<string>('');
  const [speakers, setSpeakers] = useState<string>(videoCallState.selectedSpeaker || '');

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

    const updatedLocalTracks = videoCallState.localTracks.filter((track) => {
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
    videoCallState.setLocalTracks(updatedLocalTracks);
  };

  const handleCameraChange = (e: SelectChangeEvent<string>): void => {
    const selectedCamera = e.target.value;
    setCamera(selectedCamera);
  };

  const handleMicrophoneChange = (e: SelectChangeEvent<string>): void => {
    const selectedMicrophone = e.target.value;
    setMicrophone(selectedMicrophone);
  };

  const handleSpeakersChange = (e: SelectChangeEvent<string>): void => {
    const selectedSpeakers = e.target.value;
    setSpeakers(selectedSpeakers);
  };

  // TODO device labels translated without breaking video call functionality/back end submission
  const deviceConfigs = [
    {
      devices: videoInputDevices,
      handleChange: handleCameraChange,
      label: 'Camera',
      selectedDevice: camera,
    },
    {
      devices: audioInputDevices,
      handleChange: handleMicrophoneChange,
      label: 'Microphone',
      selectedDevice: microphone,
    },
    {
      devices: audioOutputDevices,
      handleChange: handleSpeakersChange,
      label: 'Speakers',
      selectedDevice: speakers,
    },
  ];

  const handleSave = async (): Promise<void> => {
    if (camera) {
      await updateDevice('videoInput', String(camera));
    }
    if (microphone) {
      await updateDevice('audioInput', String(microphone));
    }
    if (speakers) {
      videoCallState.setSelectedSpeaker(String(speakers));
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
        {/* Device selectors */}
        {deviceConfigs.map((config, index) => (
          <DeviceSelector
            key={index}
            devices={config.devices}
            handleChange={config.handleChange}
            label={config.label}
            selectedDevice={config.selectedDevice}
          />
        ))}
        <Button sx={{ mt: 2 }} fullWidth variant="contained" size="large" type="button">
          Having technical issues with the call?
        </Button>
      </DialogContent>
      <DialogActions>
        <Button fullWidth variant="outlined" onClick={onClose}>
          Cancel
        </Button>
        <Button fullWidth variant="contained" onClick={handleSave}>
          Save Changes
        </Button>
      </DialogActions>
    </Dialog>
  );
};
