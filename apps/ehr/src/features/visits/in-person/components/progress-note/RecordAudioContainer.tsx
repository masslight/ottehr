import { Close, Pause, PlayArrow, Stop } from '@mui/icons-material';
import { Grid, IconButton, Typography } from '@mui/material';
import { DateTime } from 'luxon';
import { ReactElement, useEffect, useRef, useState } from 'react';
import { createResourcesFromAudioRecording, uploadAudioRecording } from 'src/api/api';
import { RoundedButton } from 'src/components/RoundedButton';
import { useChartData } from 'src/features/visits/shared/stores/appointment/appointment.store';
import { useApiClients } from 'src/hooks/useAppClients';
import useEvolveUser from 'src/hooks/useEvolveUser';
import { AIChatDetails, getFormatDuration } from 'utils';
import WaveSurfer from 'wavesurfer.js';
import RecordPlugin from 'wavesurfer.js/dist/plugins/record';
import { getSource, getSourceFormat } from '../../../shared/components/OttehrAi';
import { RecordedAudio } from './RecordedAudio';

interface RecordAudioContainerProps {
  visitID: string;
  width?: string;
  aiChat: AIChatDetails | undefined;
  setRecordingAnchorElement: ((value: React.SetStateAction<HTMLButtonElement | null>) => void) | undefined;
}

enum RecordingStatus {
  NOT_STARTED = 'NOT_STARTED',
  RECORDING = 'RECORDING',
  PAUSED = 'PAUSED',
  STOPPED = 'STOPPED',
}

export function RecordAudioContainer(props: RecordAudioContainerProps): ReactElement {
  const { visitID, width = '400px', aiChat, setRecordingAnchorElement } = props;
  const [recordingStatus, setRecordingStatus] = useState<RecordingStatus>(RecordingStatus.NOT_STARTED);
  const [loading, setLoading] = useState<boolean>(false);
  const [duration, setDuration] = useState<number>(0);
  const { oystehrZambda: oystehr } = useApiClients();
  const evolveUser = useEvolveUser();
  const providerName = evolveUser?.profileResource?.name?.[0]
    ? oystehr?.fhir.formatHumanName(evolveUser.profileResource.name?.[0])
    : 'Unknown';

  const waveformRef = useRef<HTMLDivElement | null>(null);
  const wavesurferRef = useRef<WaveSurfer | null>(null);
  const recordPluginRef = useRef<ReturnType<typeof RecordPlugin.create> | null>(null);
  const { refetch } = useChartData();

  useEffect(() => {
    if (!waveformRef.current) return;

    const recordPlugin = RecordPlugin.create({
      scrollingWaveform: true,
      scrollingWaveformWindow: 10,
      // continuousWaveform: true,
      // continuousWaveformDuration: 0,
      renderRecordedAudio: false,
    });

    const ws = WaveSurfer.create({
      container: waveformRef.current,
      waveColor: '#29B6F6',
      progressColor: '#2196f3',
      height: 80,
      plugins: [recordPlugin],
    });

    wavesurferRef.current = ws;
    recordPluginRef.current = recordPlugin;

    recordPlugin.on('record-progress', async (durationTemp: number) => {
      setDuration(durationTemp);
    });

    recordPlugin.on('record-end', async (blob: Blob) => {
      setRecordingStatus(RecordingStatus.NOT_STARTED);
      setLoading(true);
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
      await createResourcesFromAudioRecording(oystehr, {
        visitID,
        duration: recordPluginRef.current?.getDuration(),
        z3URL,
      });
      await refetch();
      setDuration(0);
      setLoading(false);
    });

    return () => {
      ws.destroy();
      recordPlugin.destroy();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [oystehr, visitID]);

  const startOrResumeRecording = async (): Promise<void> => {
    const plugin = recordPluginRef.current;
    if (!plugin) return;

    if (recordingStatus === RecordingStatus.NOT_STARTED) {
      // Start recording
      setRecordingStatus(RecordingStatus.RECORDING);
      const devices = await RecordPlugin.getAvailableAudioDevices();
      const deviceId = devices[0]?.deviceId;
      await plugin.startRecording({ deviceId });
    } else {
      // Resume after pause
      plugin.resumeRecording();
    }

    setRecordingStatus(RecordingStatus.RECORDING);
  };

  const pauseRecording = (): void => {
    recordPluginRef.current?.pauseRecording();
    setRecordingStatus(RecordingStatus.PAUSED);
  };

  const endRecording = (): void => {
    recordPluginRef.current?.stopRecording();
  };

  function getButtonLabel(status: RecordingStatus): string {
    switch (status) {
      case RecordingStatus.NOT_STARTED:
        return 'Start Recording';
      case RecordingStatus.RECORDING:
        return 'Pause';
      case RecordingStatus.PAUSED:
        return 'Continue';
      default:
        console.log(`Unknown recording status ${status}`);
        throw new Error('Unknown recording status');
    }
  }

  // if (loading) {
  //   return <Typography variant="body1">Loading...</Typography>;
  // }

  return (
    <Grid container style={{ padding: 25, width: width, alignItems: 'center' }}>
      <Grid item xs={8}>
        <Typography variant="h5" color="primary.dark">
          Ambient Scribe
        </Typography>
      </Grid>
      {setRecordingAnchorElement && (
        <Grid item xs={4}>
          <IconButton aria-label="Close" onClick={() => setRecordingAnchorElement(null)} sx={{ float: 'right' }}>
            <Close />
          </IconButton>
        </Grid>
      )}
      {recordingStatus === RecordingStatus.NOT_STARTED && (
        <>
          {aiChat?.documents
            .filter((item) => item.resourceType === 'DocumentReference')
            .sort((a, b) => {
              if (a.date && b.date) {
                return new Date(a.date).getTime() - new Date(b.date).getTime();
              }
              return 0;
            })
            .map((item) => {
              const audioDuration = item.content
                .find((item) => item.attachment.title?.startsWith('Audio recording'))
                ?.attachment.title?.replace('Audio recording ', '')
                .replace(/[^:0-9]/g, '');
              const audioSource = getSource(item, oystehr, aiChat.providers);
              return <RecordedAudio duration={audioDuration} status="ready" source={audioSource} />;
            })}
          {loading && (
            <RecordedAudio
              duration={getFormatDuration(duration)}
              status="loading"
              source={getSourceFormat(providerName, DateTime.now())}
            />
          )}
          {setRecordingAnchorElement && (
            <Grid item xs={12}>
              <Typography variant="body1" sx={{ marginBottom: 2 }}>
                The scribe records audio and summarizes the visit.
              </Typography>
            </Grid>
          )}
        </>
      )}

      {recordingStatus !== RecordingStatus.STOPPED && (
        <>
          <Grid item xs={2} sx={{ ...(recordingStatus === RecordingStatus.NOT_STARTED && { display: 'none' }) }}>
            <Typography sx={{ fontWeight: 'bold' }}>{getFormatDuration(duration)}</Typography>
          </Grid>
          <Grid item xs={10}>
            <div
              ref={waveformRef}
              style={{ width: '100%', ...(recordingStatus === RecordingStatus.NOT_STARTED && { display: 'none' }) }}
            />
          </Grid>
          <RoundedButton
            variant="contained"
            startIcon={recordingStatus === RecordingStatus.RECORDING ? <Pause /> : <PlayArrow />}
            onClick={recordingStatus === RecordingStatus.RECORDING ? pauseRecording : startOrResumeRecording}
          >
            {getButtonLabel(recordingStatus)}
          </RoundedButton>
          {(recordingStatus === RecordingStatus.PAUSED || recordingStatus === RecordingStatus.RECORDING) && (
            <RoundedButton
              variant="contained"
              startIcon={<Stop />}
              onClick={endRecording}
              color="error"
              sx={{ marginLeft: 1 }}
            >
              End
            </RoundedButton>
          )}
        </>
      )}
    </Grid>
  );
}
