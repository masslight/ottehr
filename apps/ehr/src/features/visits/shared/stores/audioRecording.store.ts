import Oystehr from '@oystehr/sdk';
import { useEffect, useRef } from 'react';
import { createResourcesFromAudioRecording, uploadAudioRecording } from 'src/api/api';
import { create } from 'zustand';

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

// Kept in module scope, not in the reactive store, so the live capture survives component remounts
// (a phone rotation swaps the appointment-row layout and unmounts the recorder UI) without re-rendering.
interface CaptureInternals {
  stream: MediaStream | null;
  mediaRecorder: MediaRecorder | null;
  chunks: Blob[];
  timer: ReturnType<typeof setInterval> | null;
  startedAt: number; // performance.now() at the last start/resume
  accumulatedMs: number; // duration accrued before the current running segment
  oystehr: Oystehr | null;
  onComplete: (() => void) | null;
}

const capture: CaptureInternals = {
  stream: null,
  mediaRecorder: null,
  chunks: [],
  timer: null,
  startedAt: 0,
  accumulatedMs: 0,
  oystehr: null,
  onComplete: null,
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

const currentDuration = (status: AudioRecordingStatus): number =>
  status === 'RECORDING' ? capture.accumulatedMs + (performance.now() - capture.startedAt) : capture.accumulatedMs;

const startTimer = (): void => {
  clearTimer();
  capture.timer = setInterval(() => {
    const { session } = useAudioRecordingStore.getState();
    if (!session) return;
    useAudioRecordingStore.setState({ session: { ...session, duration: currentDuration(session.status) } });
  }, 250);
};

const resetCapture = (): void => {
  clearTimer();
  capture.stream?.getTracks().forEach((track) => track.stop());
  capture.stream = null;
  capture.mediaRecorder = null;
  capture.chunks = [];
  capture.startedAt = 0;
  capture.accumulatedMs = 0;
  capture.oystehr = null;
  capture.onComplete = null;
};

const finalizeAndUpload = async (visitID: string, durationMs: number): Promise<void> => {
  const { oystehr, onComplete } = capture;
  // Upload the actual recorded type (iOS Safari records audio/mp4, not audio/webm). The transcription
  // backend keys off the stored Content-Type, so hardcoding audio/webm would break mobile transcription.
  const recordedType = capture.mediaRecorder?.mimeType || 'audio/webm';
  const contentType = recordedType.split(';')[0].trim() || 'audio/webm'; // drop any ;codecs=… suffix
  const blob = new Blob(capture.chunks, { type: recordedType });
  resetCapture();
  try {
    if (!oystehr) {
      console.error('Oystehr client is undefined; cannot upload audio recording');
      return;
    }
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
    await createResourcesFromAudioRecording(oystehr, { visitID, duration: durationMs, z3URL });
    onComplete?.();
  } catch (error) {
    console.error('Failed to upload audio recording', error);
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
    if (useAudioRecordingStore.getState().session) return; // one recording at a time (single mic)

    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch (error) {
      console.error('Error accessing the microphone', error);
      return;
    }

    const mimeType = MIME_TYPES.find((type) => MediaRecorder.isTypeSupported(type));
    const mediaRecorder = new MediaRecorder(stream, {
      ...(mimeType ? { mimeType } : {}),
      audioBitsPerSecond: 128000,
    });

    capture.stream = stream;
    capture.mediaRecorder = mediaRecorder;
    capture.chunks = [];
    capture.oystehr = oystehr;
    capture.onComplete = onComplete ?? null;
    capture.accumulatedMs = 0;
    capture.startedAt = performance.now();

    mediaRecorder.ondataavailable = (event): void => {
      if (event.data.size > 0) capture.chunks.push(event.data);
    };
    mediaRecorder.onstop = (): void => {
      void finalizeAndUpload(visitID, capture.accumulatedMs);
    };
    mediaRecorder.onerror = (event): void => handleCaptureLost(visitID, event);
    // A track ending on its own never fires onstop, so listen for it. Programmatic track.stop() (in
    // resetCapture) does not emit 'ended', so this won't double-fire on the normal path.
    stream
      .getTracks()
      .forEach((track) => track.addEventListener('ended', () => handleCaptureLost(visitID, 'track ended')));
    mediaRecorder.start(1000);
    startTimer();

    useAudioRecordingStore.setState({ session: { visitID, status: 'RECORDING', duration: 0 } });
  },

  pause(): void {
    const { session } = useAudioRecordingStore.getState();
    if (!session || session.status !== 'RECORDING' || !capture.mediaRecorder) return;
    capture.accumulatedMs = currentDuration('RECORDING');
    capture.mediaRecorder.pause();
    clearTimer();
    useAudioRecordingStore.setState({ session: { ...session, status: 'PAUSED', duration: capture.accumulatedMs } });
  },

  resume(): void {
    const { session } = useAudioRecordingStore.getState();
    if (!session || session.status !== 'PAUSED' || !capture.mediaRecorder) return;
    capture.startedAt = performance.now();
    capture.mediaRecorder.resume();
    startTimer();
    useAudioRecordingStore.setState({ session: { ...session, status: 'RECORDING' } });
  },

  stop(): void {
    const { session } = useAudioRecordingStore.getState();
    if (!session || !capture.mediaRecorder) return;
    capture.accumulatedMs = currentDuration(session.status); // freeze final duration; onstop reads it
    clearTimer();
    if (capture.mediaRecorder.state === 'inactive') {
      // Recorder already ended out-of-band, so onstop -> finalizeAndUpload won't fire: release the mic and
      // clear state here instead of leaving uploadingVisitID stuck and the mic held open.
      resetCapture();
      useAudioRecordingStore.setState({ session: null, uploadingVisitID: null, uploadingDuration: 0 });
      return;
    }
    useAudioRecordingStore.setState({
      session: null,
      uploadingVisitID: session.visitID,
      uploadingDuration: capture.accumulatedMs,
    });
    capture.mediaRecorder.stop(); // triggers onstop -> finalizeAndUpload
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
    return capture.stream;
  },
};

interface UseStopAmbientScribeOnLeaveOptions {
  hostKey: string;
}

/**
 * Keeps an active recording alive across phone rotation (which changes neither the host route nor the
 * mount) while stopping and uploading it on real navigation away. On tab close/reload the flush is
 * best-effort — the async upload chain usually can't finish before the page unloads (see
 * flushActiveSession). Call once in each recorder host (the appointments page and the in-person layout).
 */
export function useStopAmbientScribeOnLeave({ hostKey }: UseStopAmbientScribeOnLeaveOptions): void {
  const hostKeyRef = useRef(hostKey);

  // Covers navigations that keep the host mounted but change identity (e.g. switching patients under
  // the in-person layout).
  useEffect(() => {
    if (hostKey !== hostKeyRef.current) {
      audioRecordingActions.flushActiveSession();
      hostKeyRef.current = hostKey;
    }
  }, [hostKey]);

  // Covers navigations that unmount the host (e.g. leaving the appointments page) and, best-effort, tab
  // close/reload — pagehide fires but the async upload usually won't complete before the page unloads.
  useEffect(() => {
    const flush = (): void => audioRecordingActions.flushActiveSession();
    window.addEventListener('pagehide', flush);
    return () => {
      window.removeEventListener('pagehide', flush);
      flush();
    };
  }, []);
}
