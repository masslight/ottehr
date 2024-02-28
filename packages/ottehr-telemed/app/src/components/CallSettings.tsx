import { FC, ReactNode, useEffect, useRef, useState, ChangeEvent } from 'react';
import {
  useLocalVideo,
  useMeetingManager,
  VideoTile,
  useAudioVideo
} from 'amazon-chime-sdk-component-library-react';
import { Select, MenuItem, FormControl, InputLabel, Dialog, DialogTitle, DialogContent, DialogActions, Button, SelectChangeEvent, Box, Grid } from '@mui/material';

interface CallSettingsProps {
  onClose: () => void;
  open: boolean;
}


export const CallSettings: FC<CallSettingsProps> = ({ onClose, open }) => {
  const meetingManager = useMeetingManager();
  const audioVideo = useAudioVideo();


  const [videoDevices, setVideoDevices] = useState<MediaDeviceInfo[]>([]);
  const [audioDevices, setAudioDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedVideoDevice, setSelectedVideoDevice] = useState('');
  const [selectedAudioDevice, setSelectedAudioDevice] = useState('');
  const videoPreviewRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const observer = {
      audioInputsChanged: (freshAudioInputDevices: MediaDeviceInfo[]) => {
        setAudioDevices(freshAudioInputDevices);
      },
      videoInputsChanged: (freshVideoInputDevices: MediaDeviceInfo[]) => {
        setVideoDevices(freshVideoInputDevices);
      },
    };

    meetingManager.audioVideo?.addDeviceChangeObserver(observer);

    const initDevices = async () => {
      const videoInputDevices = await meetingManager.audioVideo?.listVideoInputDevices() ?? [];
      const audioInputDevices = await meetingManager.audioVideo?.listAudioInputDevices() ?? [];

      setVideoDevices(videoInputDevices);
      setAudioDevices(audioInputDevices);

      if (videoInputDevices.length > 0) {
        setSelectedVideoDevice(videoInputDevices[0].deviceId);
      }
      if (audioInputDevices.length > 0) {
        setSelectedAudioDevice(audioInputDevices[0].deviceId);
      }
    };

    initDevices();

    return () => {
      meetingManager.audioVideo?.removeDeviceChangeObserver(observer);
    };
  }, [meetingManager.audioVideo]);

  useEffect(() => {
    console.log('useeffect selectedVideoDevice', selectedVideoDevice)
    if (selectedVideoDevice && videoPreviewRef.current) {
      console.log('start preview')
      // Start the video preview when a device is selected and the component mounts
      // audioVideo?.startVideoPreviewForVideoInput(videoPreviewRef.current);
      audioVideo?.startVideoInput(selectedVideoDevice).then(() => {
        console.log('trying')
        audioVideo?.startVideoPreviewForVideoInput(videoPreviewRef.current!);
      });
    }

    // return () => {
    //   if (videoPreviewRef.current) {
    //     audioVideo?.stopVideoPreviewForVideoInput(videoPreviewRef.current);
    //     audioVideo?.stopVideoInput(); // If we also want to stop sending the video stream - need to TEST if needed
    //   }
    // };
  }, [selectedVideoDevice, audioVideo]);

  const handleVideoDeviceChange = async (event: SelectChangeEvent<string>) => {
    console.log('video device change', event.target.value)
    const deviceId = event.target.value;
    setSelectedVideoDevice(deviceId);
    console.log('videoPreviewRef', videoPreviewRef);
    await audioVideo?.startVideoInput(deviceId);
  };

  const handleAudioDeviceChange = async (event: SelectChangeEvent<string>) => {
    const deviceId = event.target.value;
    setSelectedAudioDevice(deviceId);
    await audioVideo?.startAudioInput(deviceId);
  };

  return (
    <Dialog open={open} onClose={onClose}>
      <DialogTitle>Call Settings</DialogTitle>
      <DialogContent>
        {/* Camera preview */}
        <video ref={videoPreviewRef} autoPlay muted playsInline style={{
          height: '100%',
          width: '100%',
        }}></video>
        <FormControl fullWidth margin='normal'>
          <InputLabel>Camera</InputLabel>
          <Select value={selectedVideoDevice} onChange={handleVideoDeviceChange}>
            {videoDevices.map((device) => (
              <MenuItem key={device.deviceId} value={device.deviceId}>
                {device.label}
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        <FormControl fullWidth margin='normal'>
          <InputLabel>Microphone</InputLabel>
          <Select value={selectedAudioDevice} onChange={handleAudioDeviceChange}>
            {audioDevices.map((device) => (
              <MenuItem key={device.deviceId} value={device.deviceId}>
                {device.label}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Close</Button>
      </DialogActions>
    </Dialog>
  );
};
