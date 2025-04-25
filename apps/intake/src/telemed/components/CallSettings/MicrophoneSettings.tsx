import GraphicEqIcon from '@mui/icons-material/GraphicEq';
import KeyboardVoiceIcon from '@mui/icons-material/KeyboardVoice';
import KeyboardVoiceOutlinedIcon from '@mui/icons-material/KeyboardVoiceOutlined';
import PauseIcon from '@mui/icons-material/Pause';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import ReplayIcon from '@mui/icons-material/Replay';
import StopIcon from '@mui/icons-material/Stop';
import { Box, Card, FormControl, IconButton, InputLabel, MenuItem, Select, Typography } from '@mui/material';
import { FC, useCallback, useEffect, useRef, useState } from 'react';
import { otherColors } from '../../../IntakeThemeProvider';

type MicrophoneSettingsProps = {
  selectedAudioDevice: string;
  setSelectedAudioDevice: (value: string) => void;
  audioDevices: MediaDeviceInfo[];
};

const mimeType = 'audio/webm';

export const MicrophoneSettings: FC<MicrophoneSettingsProps> = (props) => {
  const { selectedAudioDevice, setSelectedAudioDevice, audioDevices } = props;

  const mediaRecorder = useRef<MediaRecorder | null>(null);
  const [recordingStatus, setRecordingStatus] = useState('inactive');
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [audioChunks, setAudioChunks] = useState<Blob[]>([]);
  const [audio, setAudio] = useState<string | null>('');
  const audioPreviewRef = useRef<HTMLAudioElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [duration, setDuration] = useState(0);

  useEffect(() => {
    const getStream = async (): Promise<void> => {
      const streamData = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: false,
      });
      setStream(streamData);
    };

    void getStream();
  }, []);

  const startRecording = async (): Promise<void> => {
    if (!stream) {
      return;
    }

    setRecordingStatus('recording');

    mediaRecorder.current = new MediaRecorder(stream, { mimeType });
    mediaRecorder.current.start();

    const localAudioChunks: Blob[] = [];
    mediaRecorder.current.ondataavailable = (event) => {
      if (typeof event.data === 'undefined') return;
      if (event.data.size === 0) return;
      localAudioChunks.push(event.data);
    };
    setAudioChunks(localAudioChunks);
  };

  const stopRecording = useCallback((): void => {
    if (!mediaRecorder.current) {
      return;
    }

    setRecordingStatus('done');
    mediaRecorder.current.stop();
    mediaRecorder.current.onstop = () => {
      const audioBlob = new Blob(audioChunks, { type: mimeType });
      const audioUrl = URL.createObjectURL(audioBlob);

      setAudio(audioUrl);
      setAudioChunks([]);
    };
  }, [audioChunks]);

  useEffect(() => {
    let timeout: ReturnType<typeof setTimeout> | null = null;
    if (recordingStatus === 'recording') {
      timeout = setTimeout(() => {
        stopRecording();
      }, 5000);
    }
    return () => {
      timeout && clearTimeout(timeout);
    };
  }, [recordingStatus, stopRecording]);

  const rerun = (): void => {
    setRecordingStatus('inactive');
    if (isPlaying) {
      togglePlayPause();
    }
    setAudio(null);
  };

  const togglePlayPause = (): void => {
    const audio = audioPreviewRef.current;
    if (!audio) {
      return;
    }

    if (audio) {
      if (isPlaying) {
        audio.pause();
      } else {
        void audio.play();
      }
      setIsPlaying(!isPlaying);
    }
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

  useEffect(() => {
    if (audio) {
      handleLoadedMetadata();
    }
  }, [audio]);

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        gap: 1,
      }}
    >
      <FormControl fullWidth margin="normal">
        <InputLabel>Microphone</InputLabel>
        <Select
          value={audioDevices.map(({ deviceId }) => deviceId).includes(selectedAudioDevice) ? selectedAudioDevice : ''}
          onChange={(e) => setSelectedAudioDevice(e.target.value)}
          label="Microphone"
          size="small"
        >
          {audioDevices.map((device) => (
            <MenuItem key={device.deviceId} value={device.deviceId}>
              {device.label}
            </MenuItem>
          ))}
        </Select>
      </FormControl>

      <audio
        ref={audioPreviewRef}
        onDurationChange={handleLoadedMetadata}
        src={audio || undefined}
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
        {recordingStatus === 'done' ? <GraphicEqIcon color="primary" /> : <KeyboardVoiceOutlinedIcon color="primary" />}
        <Typography variant="body2" fontWeight={700} color="primary.main" sx={{ flexGrow: 1 }}>
          {recordingStatus === 'inactive'
            ? 'Record your voice (5 sec)'
            : recordingStatus === 'recording'
            ? 'Recording...'
            : 'Play it back'}
        </Typography>

        {recordingStatus === 'done' && (
          <IconButton
            sx={{
              backgroundColor: 'primary.main',
              color: 'white',
              '&:hover': { backgroundColor: 'primary.main' },
            }}
            size="small"
            onClick={togglePlayPause}
          >
            {isPlaying ? <PauseIcon fontSize="small" /> : <PlayArrowIcon fontSize="small" />}
          </IconButton>
        )}

        <IconButton
          sx={{
            backgroundColor: 'primary.main',
            color: 'white',
            '&:hover': { backgroundColor: 'primary.main' },
          }}
          size="small"
          onClick={
            recordingStatus === 'inactive' ? startRecording : recordingStatus === 'recording' ? stopRecording : rerun
          }
        >
          {recordingStatus === 'inactive' ? (
            <KeyboardVoiceIcon fontSize="small" />
          ) : recordingStatus === 'recording' ? (
            <StopIcon fontSize="small" />
          ) : (
            <ReplayIcon fontSize="small" />
          )}
        </IconButton>
      </Card>
    </Box>
  );
};
