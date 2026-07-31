import Oystehr from '@oystehr/sdk';
import { enqueueSnackbar } from 'notistack';
import { createResourcesFromAudioRecording, uploadAudioRecording } from 'src/api/api';
import { create } from 'zustand';
import { detectAudioContainerType } from '../utils/audio-container.helper';

export type AudioRecordingStatus = 'RECORDING' | 'PAUSED';

export interface AudioRecordingSession {
  visitID: string;
  status: AudioRecordingStatus;
  duration: number; // ms, refreshed on a timer while recording
}

interface AudioRecordingState {
  // Only one recording can be active at a time (one mic).
  session: AudioRecordingSession | null;
  uploadingVisitID: string | null;
  // Frozen at Stop for the "uploading" chip; in the store (not component state) to survive remounts.
  uploadingDuration: number;
}

interface StartRecordingParams {
  visitID: string;
  oystehr: Oystehr;
  onComplete?: () => void;
}

// Mirrors wavesurfer's RecordPlugin preference order so the produced blob matches what the
// transcription backend has always received.
const MIME_TYPES = ['audio/webm', 'audio/wav', 'audio/mpeg', 'audio/mp4', 'audio/mp3'];

// A page frozen mid-stop (iOS backgrounding the tab) can drop both the final `dataavailable` and `onstop`,
// leaving the mic open and the "uploading" chip stuck forever.
const STOP_FALLBACK_MS = 5000;

// Per-recording state, reached only through that recorder's own handlers. `chunks` especially must not live
// on the shared `capture` below: a recorder outliving its session would append fragments to the *next*
// recording, producing two interleaved streams no decoder (or Vertex) can read.
interface ActiveCapture {
  visitID: string;
  recorder: MediaRecorder;
  stream: MediaStream;
  chunks: Blob[];
  startedAt: number; // performance.now() at the last start/resume
  accumulatedMs: number; // duration accrued before the current running segment
  oystehr: Oystehr;
  onComplete: (() => void) | null;
  finalized: boolean; // onstop and the fallback timer can both land; upload once
  fallbackTimer: ReturnType<typeof setTimeout> | null;
}

// Kept in module scope, not in the reactive store, so the live capture survives component remounts
// (a phone rotation swaps the appointment-row layout and unmounts the recorder UI) without re-rendering.
const capture: {
  active: ActiveCapture | null;
  starting: boolean; // claimed synchronously, before the getUserMedia await
  timer: ReturnType<typeof setInterval> | null;
} = {
  active: null,
  starting: false,
  timer: null,
};

export const useAudioRecordingStore = create<AudioRecordingState>()(() => ({
  session: null,
  uploadingVisitID: null,
  uploadingDuration: 0,
}));

const clearTimer = (): void => {
  if (capture.timer) {
    clearInterval(capture.timer);
    capture.timer = null;
  }
};

const currentDuration = (active: ActiveCapture, status: AudioRecordingStatus): number =>
  status === 'RECORDING' ? active.accumulatedMs + (performance.now() - active.startedAt) : active.accumulatedMs;

const startTimer = (): void => {
  clearTimer();
  capture.timer = setInterval(() => {
    const { session } = useAudioRecordingStore.getState();
    const active = capture.active;
    if (!session || !active) return;
    useAudioRecordingStore.setState({ session: { ...session, duration: currentDuration(active, session.status) } });
  }, 250);
};

const releaseMic = (active: ActiveCapture): void => {
  active.stream.getTracks().forEach((track) => track.stop());
};

const finalizeAndUpload = async (active: ActiveCapture): Promise<void> => {
  if (active.finalized) return;
  active.finalized = true;
  if (active.fallbackTimer) {
    clearTimeout(active.fallbackTimer);
    active.fallbackTimer = null;
  }
  // A recorder whose tracks all end stops itself and fires `onstop` with no stop() in front of it, so tear
  // the session down here too — otherwise the UI keeps ticking on a released mic, the duration persists as
  // 0, and the next Pause throws InvalidStateError. Synchronous, so stop() never sees a finalized capture.
  if (capture.active === active) {
    const { session } = useAudioRecordingStore.getState();
    active.accumulatedMs = currentDuration(active, session?.status ?? 'PAUSED');
    clearTimer();
    capture.active = null;
    useAudioRecordingStore.setState({
      session: null,
      uploadingVisitID: active.visitID,
      uploadingDuration: active.accumulatedMs,
    });
  }
  releaseMic(active);

  const { visitID, chunks, oystehr, onComplete } = active;
  // Upload the actual recorded type (iOS Safari records audio/mp4, not audio/webm). The transcription
  // backend keys off the stored Content-Type, so hardcoding audio/webm would break mobile transcription.
  const declaredType = active.recorder.mimeType || 'audio/webm';
  const blob = new Blob(chunks, { type: declaredType });
  try {
    const contentType = await detectAudioContainerType(blob, declaredType);
    // The Z3 object key is fixed to `${visitID}.webm` by the upload zambda; only the Content-Type is read
    // back at transcription time, so this File's name is irrelevant.
    const file = new File([blob], `${visitID}.webm`, { type: contentType });
    const { z3URL, presignedUploadUrl } = await uploadAudioRecording(oystehr, { visitID });
    const uploadResponse = await fetch(presignedUploadUrl, {
      method: 'PUT',
      headers: { 'Content-Type': file.type },
      body: file,
    });
    // Bail before creating resources if the object didn't land — otherwise we'd persist FHIR
    // resources referencing a missing/corrupt recording.
    if (!uploadResponse.ok) {
      throw new Error(`Audio upload failed: ${uploadResponse.status} ${uploadResponse.statusText}`);
    }
    await createResourcesFromAudioRecording(oystehr, { visitID, duration: active.accumulatedMs, z3URL });
    onComplete?.();
  } catch (error) {
    // A silent drop reads as "the scribe worked" until the note never appears, by which point the audio is gone.
    console.error('Failed to upload audio recording', error);
    enqueueSnackbar('The visit recording could not be saved. Please record again.', { variant: 'error' });
  } finally {
    // Only clear if this upload still owns the indicator.
    if (useAudioRecordingStore.getState().uploadingVisitID === visitID) {
      useAudioRecordingStore.setState({ uploadingVisitID: null });
    }
  }
};

// The mic can disappear out-of-band (OS interruption, revoked permission, device unplug). Route it through
// stop() so we finalize what we captured (or at least release the mic) instead of getting stuck on RECORDING.
const handleCaptureLost = (visitID: string, reason: unknown): void => {
  if (useAudioRecordingStore.getState().session?.visitID !== visitID) return; // stale listener after teardown
  console.warn('Ambient Scribe capture lost; finalizing recording', reason);
  audioRecordingActions.stop();
};

export const audioRecordingActions = {
  async startRecording({ visitID, oystehr, onComplete }: StartRecordingParams): Promise<void> {
    // Claim the slot synchronously: `session` isn't written until after the await, so a store-only check lets
    // a double-tap start a second recorder that nothing can ever stop.
    if (capture.starting || capture.active || useAudioRecordingStore.getState().session) return;
    capture.starting = true;

    try {
      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      } catch (error) {
        console.error('Error accessing the microphone', error);
        return;
      }

      const mimeType = MIME_TYPES.find((type) => MediaRecorder.isTypeSupported(type));
      const recorder = new MediaRecorder(stream, {
        ...(mimeType ? { mimeType } : {}),
        audioBitsPerSecond: 128000,
      });
      const chunks: Blob[] = [];
      const active: ActiveCapture = {
        visitID,
        recorder,
        stream,
        chunks,
        startedAt: performance.now(),
        accumulatedMs: 0,
        oystehr,
        onComplete: onComplete ?? null,
        finalized: false,
        fallbackTimer: null,
      };

      // Both handlers close over this session's own state, never `capture`.
      recorder.ondataavailable = (event): void => {
        if (event.data.size > 0) chunks.push(event.data);
      };
      recorder.onstop = (): void => {
        void finalizeAndUpload(active);
      };
      recorder.onerror = (event): void => handleCaptureLost(visitID, event);
      // A track ending on its own never fires onstop, so listen for it. Programmatic track.stop() (in
      // releaseMic) does not emit 'ended', so this won't double-fire on the normal path.
      stream
        .getTracks()
        .forEach((track) => track.addEventListener('ended', () => handleCaptureLost(visitID, 'track ended')));

      capture.active = active;
      recorder.start(1000);
      startTimer();

      useAudioRecordingStore.setState({ session: { visitID, status: 'RECORDING', duration: 0 } });
    } finally {
      capture.starting = false;
    }
  },

  pause(): void {
    const { session } = useAudioRecordingStore.getState();
    const active = capture.active;
    if (!session || session.status !== 'RECORDING' || !active) return;
    active.accumulatedMs = currentDuration(active, 'RECORDING');
    active.recorder.pause();
    clearTimer();
    useAudioRecordingStore.setState({ session: { ...session, status: 'PAUSED', duration: active.accumulatedMs } });
  },

  resume(): void {
    const { session } = useAudioRecordingStore.getState();
    const active = capture.active;
    if (!session || session.status !== 'PAUSED' || !active) return;
    active.startedAt = performance.now();
    active.recorder.resume();
    startTimer();
    useAudioRecordingStore.setState({ session: { ...session, status: 'RECORDING' } });
  },

  stop(): void {
    const { session } = useAudioRecordingStore.getState();
    const active = capture.active;
    if (!session || !active) return;
    active.accumulatedMs = currentDuration(active, session.status); // freeze final duration; the upload reads it
    clearTimer();
    // Detach before stopping, so a Record press landing before onstop starts a clean recording instead of
    // adopting this one. A self-finalized capture has already detached, so anything still here is live.
    capture.active = null;

    useAudioRecordingStore.setState({
      session: null,
      uploadingVisitID: session.visitID,
      uploadingDuration: active.accumulatedMs,
    });

    if (active.recorder.state === 'inactive') {
      // A fatal error inactivates the recorder and fires `error` — routed here by handleCaptureLost — before
      // the queued `stop`, so onstop may never arrive. Upload what we captured rather than discarding it.
      void finalizeAndUpload(active);
      return;
    }

    active.fallbackTimer = setTimeout(() => void finalizeAndUpload(active), STOP_FALLBACK_MS);
    active.recorder.stop(); // triggers onstop -> finalizeAndUpload
  },

  // Stop any active recording and kick off its upload. Reliable for in-SPA navigation and rotation, but
  // best-effort on real tab close/reload: the async upload chain usually can't finish before page unload.
  flushActiveSession(): void {
    if (useAudioRecordingStore.getState().session) {
      audioRecordingActions.stop();
    }
  },

  // The live mic stream, for view-only visualisation (wavesurfer). Never stop/close this externally.
  getStream(): MediaStream | null {
    return capture.active?.stream ?? null;
  },
};
