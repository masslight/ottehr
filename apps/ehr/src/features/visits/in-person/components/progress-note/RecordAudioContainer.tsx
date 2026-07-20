import { Close, Pause, PlayArrow, Stop } from '@mui/icons-material';
import { Grid, IconButton, Typography } from '@mui/material';
import { DateTime } from 'luxon';
import { ReactElement, useEffect, useRef, useState } from 'react';
import { RoundedButton } from 'src/components/RoundedButton';
import { useChartData } from 'src/features/visits/shared/stores/appointment/appointment.store';
import {
  audioRecordingActions,
  AudioRecordingStatus,
  useAudioRecordingStore,
} from 'src/features/visits/shared/stores/audioRecording.store';
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

type LocalStatus = 'NOT_STARTED' | AudioRecordingStatus;

export function RecordAudioContainer(props: RecordAudioContainerProps): ReactElement {
  const { visitID, width = '400px', aiChat, setRecordingAnchorElement } = props;
  const { oystehrZambda: oystehr } = useApiClients();
  const evolveUser = useEvolveUser();
  const providerName = evolveUser?.profileResource?.name?.[0]
    ? oystehr?.fhir.formatHumanName(evolveUser.profileResource.name?.[0])
    : 'Unknown';
  const { refetch } = useChartData();

  // The recording lives in the store so it survives this component remounting on rotation; this is just
  // the view/controller. Selectors stay granular so the duration tick only re-renders the recording row.
  const isActiveHere = useAudioRecordingStore((state) => state.session?.visitID === visitID);
  const recordingStatus: LocalStatus = useAudioRecordingStore((state) =>
    state.session?.visitID === visitID ? state.session.status : 'NOT_STARTED'
  );
  const duration = useAudioRecordingStore((state) => (state.session?.visitID === visitID ? state.session.duration : 0));
  const uploading = useAudioRecordingStore((state) => state.uploadingVisitID === visitID);
  // Snapshot at Stop so the "uploading" chip shows the real length (the store session clears on upload).
  const [uploadedDuration, setUploadedDuration] = useState<number>(0);

  const waveformRef = useRef<HTMLDivElement | null>(null);

  // View-only waveform: renderMicStream visualises the store's stream without capturing, so destroying
  // this on unmount only tears down the drawing — the store's MediaRecorder keeps running.
  useEffect(() => {
    if (!isActiveHere || !waveformRef.current) return;
    const stream = audioRecordingActions.getStream();
    if (!stream) return;

    const recordPlugin = RecordPlugin.create({
      scrollingWaveform: true,
      scrollingWaveformWindow: 10,
      renderRecordedAudio: false,
    });
    const ws = WaveSurfer.create({
      container: waveformRef.current,
      waveColor: '#29B6F6',
      progressColor: '#2196f3',
      height: 80,
      plugins: [recordPlugin],
    });
    const micStream = recordPlugin.renderMicStream(stream);

    return () => {
      micStream.onDestroy();
      ws.destroy();
    };
  }, [isActiveHere]);

  const startOrResumeRecording = async (): Promise<void> => {
    if (recordingStatus === 'PAUSED') {
      audioRecordingActions.resume();
      return;
    }
    if (!oystehr) {
      console.error('Oystehr client is undefined');
      return;
    }
    await audioRecordingActions.startRecording({ visitID, oystehr, onComplete: refetch });
  };

  const pauseRecording = (): void => {
    audioRecordingActions.pause();
  };

  const endRecording = (): void => {
    setUploadedDuration(duration);
    audioRecordingActions.stop();
  };

  function getButtonLabel(status: LocalStatus): string {
    switch (status) {
      case 'NOT_STARTED':
        return 'Start Recording';
      case 'RECORDING':
        return 'Pause';
      case 'PAUSED':
        return 'Continue';
      default:
        console.log(`Unknown recording status ${status}`);
        throw new Error('Unknown recording status');
    }
  }

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
      {recordingStatus === 'NOT_STARTED' && (
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
          {uploading && (
            <RecordedAudio
              duration={getFormatDuration(uploadedDuration)}
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

      <Grid item xs={2} sx={{ ...(recordingStatus === 'NOT_STARTED' && { display: 'none' }) }}>
        <Typography sx={{ fontWeight: 'bold' }}>{getFormatDuration(duration)}</Typography>
      </Grid>
      <Grid item xs={10}>
        <div
          ref={waveformRef}
          style={{ width: '100%', ...(recordingStatus === 'NOT_STARTED' && { display: 'none' }) }}
        />
      </Grid>
      <RoundedButton
        variant="contained"
        startIcon={recordingStatus === 'RECORDING' ? <Pause /> : <PlayArrow />}
        onClick={recordingStatus === 'RECORDING' ? pauseRecording : startOrResumeRecording}
      >
        {getButtonLabel(recordingStatus)}
      </RoundedButton>
      {(recordingStatus === 'PAUSED' || recordingStatus === 'RECORDING') && (
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
    </Grid>
  );
}
