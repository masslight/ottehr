/* eslint-disable @typescript-eslint/no-unused-vars */
import * as React from 'react';
import { useEffect } from 'react';

import {
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
import { usePatient } from '../store';
import useDevices from '../hooks/twilio/useDevices';

interface CallSettingsProps {
  open: boolean;
  onClose: () => void;
  localParticipant: LocalParticipant | undefined;
}

export const CallSettings: React.FC<CallSettingsProps> = ({ open, onClose, localParticipant }) => {
  const [camera, setCamera] = React.useState<string | number>('');
  const [microphone, setMicrophone] = React.useState<string | number>('');
  const [speakers, setSpeakers] = React.useState<string | number>('');
  const { localTracks, setLocalTracks, selectedSpeaker, setSelectedSpeaker } = usePatient();
  const { audioInputDevices, videoInputDevices, audioOutputDevices } = useDevices();

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

    // Unpublish and remove old track, and update localTracks
    const updatedLocalTracks = localTracks.filter((track) => {
      if (track.kind === type.slice(0, -5)) {
        // 'audioInput' to 'audio', 'videoInput' to 'video'
        localParticipant.unpublishTrack(track);
        track.stop();
        return false;
      }
      return true; // keep other tracks
    });

    // Publish new track
    localParticipant.publishTrack(newTrack).catch((error) => {
      console.error('Failed to publish track', error);
    });

    // Add the new track to updatedLocalTracks and update the context
    updatedLocalTracks.push(newTrack as LocalAudioTrack | LocalVideoTrack);
    setLocalTracks(updatedLocalTracks);
  };

  const handleCameraChange = async (e: SelectChangeEvent<string | number>): Promise<void> => {
    const selectedCamera = e.target.value;
    setCamera(selectedCamera);
    await updateDevice('videoInput', String(selectedCamera));
  };

  const handleMicrophoneChange = async (e: SelectChangeEvent<string | number>): Promise<void> => {
    const selectedMicrophone = e.target.value;
    setMicrophone(selectedMicrophone);
    await updateDevice('audioInput', String(selectedMicrophone));
  };

  const handleSpeakersChange = (e: SelectChangeEvent<string | number>): void => {
    const selectedSpeakers = e.target.value;
    setSpeakers(selectedSpeakers);
    setSelectedSpeaker(String(selectedSpeakers));
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm">
      <DialogTitle>Call settings</DialogTitle>
      <DialogContent>
        {/* Camera preview */}
        <div>
          <img src="#" alt="Camera Preview" style={{ width: '100%', height: 'auto', marginBottom: '16px' }} />
        </div>
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
        // Microphone selection
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
        // Speakers selection
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
        {/* Technical issues */}
        <Button variant="contained" color="primary" style={{ marginTop: '16px' }}>
          Having technical issues with the call?
        </Button>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} color="primary">
          Cancel
        </Button>
        <Button onClick={onClose} color="primary">
          Save Changes
        </Button>
      </DialogActions>
    </Dialog>
  );
};
