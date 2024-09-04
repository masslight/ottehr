import { FC, RefObject, useState } from 'react';
import { Box, Card, FormControl, IconButton, InputLabel, MenuItem, Select, Typography } from '@mui/material';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import ReplayIcon from '@mui/icons-material/Replay';
import VolumeUpOutlinedIcon from '@mui/icons-material/VolumeUpOutlined';
import { otherColors } from '../../IntakeThemeProvider';

type SoundSettingsProps = {
  selectedOutputDevice: string;
  setSelectedOutputDevice: (value: string) => void;
  outputDevices: MediaDeviceInfo[];
  audioPreviewRef: RefObject<HTMLAudioElement>;
};

export const SoundSettings: FC<SoundSettingsProps> = (props) => {
  const { selectedOutputDevice, setSelectedOutputDevice, outputDevices, audioPreviewRef } = props;

  const [isPlaying, setIsPlaying] = useState(false);
  const [duration, setDuration] = useState(0);

  const handlePlay = (): void => {
    const audio = audioPreviewRef.current;
    if (!audio) {
      return;
    }

    void audio.play();
    setIsPlaying(!isPlaying);
  };

  const handleTimeUpdate = (): void => {
    const audio = audioPreviewRef.current;
    if (!audio) {
      return;
    }

    if (audio.currentTime === duration) {
      setIsPlaying(false);
    }
  };

  const handleLoadedMetadata = (): void => {
    const audio = audioPreviewRef.current;
    if (!audio) {
      return;
    }

    setDuration(audio.duration);
  };

  const handleRestart = (): void => {
    const audio = audioPreviewRef.current;
    if (!audio) {
      return;
    }

    audio.currentTime = 0;
  };

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        gap: 1,
      }}
    >
      <FormControl fullWidth margin="normal">
        <InputLabel>Sound</InputLabel>
        <Select
          value={
            outputDevices.map(({ deviceId }) => deviceId).includes(selectedOutputDevice) ? selectedOutputDevice : ''
          }
          onChange={(e) => setSelectedOutputDevice(e.target.value)}
          label="Sound"
          size="small"
        >
          {outputDevices.map((device) => (
            <MenuItem key={device.deviceId} value={device.deviceId}>
              {device.label}
            </MenuItem>
          ))}
        </Select>
      </FormControl>

      <audio
        ref={audioPreviewRef}
        src="https://cdn.freesound.org/previews/216/216676_321967-lq.mp3"
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={handleLoadedMetadata}
      />

      <Card
        sx={{
          backgroundColor: otherColors.coachingVisit,
          py: 1,
          px: 2,
          display: 'flex',
          alignItems: 'center',
          gap: 1,
        }}
        elevation={0}
      >
        <VolumeUpOutlinedIcon color="primary" />
        <Typography variant="body2" fontWeight={700} color="primary.main" sx={{ flexGrow: 1 }}>
          {isPlaying ? 'Playing...' : 'Play the test sound'}
        </Typography>
        <IconButton
          sx={{
            backgroundColor: 'primary.main',
            color: 'white',
            '&:hover': { backgroundColor: 'primary.main' },
          }}
          size="small"
          onClick={isPlaying ? handleRestart : handlePlay}
        >
          {isPlaying ? <ReplayIcon fontSize="small" /> : <PlayArrowIcon fontSize="small" />}
        </IconButton>
      </Card>
    </Box>
  );
};
