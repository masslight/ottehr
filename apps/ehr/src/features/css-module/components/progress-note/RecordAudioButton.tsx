import { ReactElement, useEffect, useRef, useState } from 'react';
import { createResourcesFromAudioRecording, uploadAudioRecording } from 'src/api/api';
import { RoundedButton } from 'src/components/RoundedButton';
import { useApiClients } from 'src/hooks/useAppClients';
import WaveSurfer from 'wavesurfer.js';
// @ts-expect-error types defined
import RecordPlugin from 'wavesurfer.js/dist/plugins/record.esm.js';

interface RecordAudioButtonProps {
  visitID: string;
}

enum RecordingStatus {
  NOT_STARTED = 'NOT_STARTED',
  RECORDING = 'RECORDING',
  PAUSED = 'PAUSED',
  STOPPED = 'STOPPED',
}

export function RecordAudioButton(props: RecordAudioButtonProps): ReactElement {
  const { visitID } = props;
  const [recordingStatus, setRecordingStatus] = useState<RecordingStatus>(RecordingStatus.NOT_STARTED);
  // const [recording, setIsRecording] = useState(false);
  // const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const { oystehrZambda: oystehr } = useApiClients();

  const waveformRef = useRef<HTMLDivElement | null>(null);
  const wavesurferRef = useRef<WaveSurfer | null>(null);
  const recordPluginRef = useRef<ReturnType<typeof RecordPlugin.create> | null>(null);

  useEffect(() => {
    if (!waveformRef.current) return;

    const recordPlugin = RecordPlugin.create({
      scrollingWaveform: false,
      continuousWaveform: true,
      continuousWaveformDuration: 10,
      renderRecordedAudio: false,
    });

    const ws = WaveSurfer.create({
      container: waveformRef.current,
      waveColor: '#ddd',
      progressColor: '#2196f3',
      height: 80,
      plugins: [recordPlugin],
    });

    wavesurferRef.current = ws;
    recordPluginRef.current = recordPlugin;

    recordPlugin.on('record-end', async (blob: Blob) => {
      // const url = URL.createObjectURL(blob);
      setRecordingStatus(RecordingStatus.STOPPED);
      if (!oystehr) {
        console.error('Oystehr client is undefined');
        return;
      }
      const file = new File([blob], `${visitID}.webm`, { type: 'audio/webm' });
      const { z3URL, presignedUploadUrl } = await uploadAudioRecording(oystehr, { visitID });
      const uploadResponse = await fetch(presignedUploadUrl, {
        method: 'PUT',
        headers: {
          'Content-Type': file.type,
        },
        body: file,
      });
      console.log(uploadResponse);
      await createResourcesFromAudioRecording(oystehr, { visitID, z3URL });
    });

    return () => {
      ws.destroy();
      wavesurferRef.current = null;
      recordPluginRef.current = null;
    };
  }, [oystehr, visitID]);

  const startOrResumeRecording = async (): Promise<void> => {
    const plugin = recordPluginRef.current;
    if (!plugin) return;

    if (recordingStatus === RecordingStatus.NOT_STARTED) {
      setRecordingStatus(RecordingStatus.RECORDING);
      const devices = await RecordPlugin.getAvailableAudioDevices();
      const deviceId = devices[0]?.deviceId;
      await plugin.startRecording({ deviceId });
    } else {
      // Resume after pause
      plugin.resumeRecording();
    }

    setRecordingStatus(RecordingStatus.RECORDING);
    // setAudioUrl(null);
  };

  const pauseRecording = (): void => {
    recordPluginRef.current?.pauseRecording();
    setRecordingStatus(RecordingStatus.PAUSED);
  };

  const endRecording = (): void => {
    recordPluginRef.current?.stopRecording();
  };

  return (
    <>
      {recordingStatus !== RecordingStatus.STOPPED && (
        <>
          <RoundedButton
            variant="outlined"
            onClick={recordingStatus === RecordingStatus.RECORDING ? pauseRecording : startOrResumeRecording}
          >
            {recordingStatus === RecordingStatus.NOT_STARTED
              ? 'Start'
              : recordingStatus === RecordingStatus.RECORDING
              ? 'Pause'
              : 'Continue'}{' '}
            Recording
          </RoundedButton>

          {(recordingStatus === RecordingStatus.PAUSED || recordingStatus === RecordingStatus.RECORDING) && (
            <RoundedButton variant="outlined" onClick={endRecording} color="error">
              End Recording
            </RoundedButton>
          )}

          <div
            ref={waveformRef}
            style={{ width: '100%', display: recordingStatus === RecordingStatus.NOT_STARTED ? 'none' : 'block' }}
          />
        </>
      )}

      {/* {audioUrl && (
                <audio
                    controls
                    src={audioUrl}
                    style={{ width: "100%", marginTop: 8 }}
                />
            )} */}
    </>
  );
}
