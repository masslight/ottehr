import Oystehr from '@oystehr/sdk';
import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
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
  const blob = new Blob(capture.chunks, { type: capture.mediaRecorder?.mimeType || 'audio/webm' });
  resetCapture();
  try {
    if (!oystehr) {
      console.error('Oystehr client is undefined; cannot upload audio recording');
      return;
    }
    // Keep the historical filename/type so the transcription backend keeps receiving a `.webm`.
    const file = new File([blob], `${visitID}.webm`, { type: 'audio/webm' });
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
    useAudioRecordingStore.setState({ session: null, uploadingVisitID: session.visitID });
    if (capture.mediaRecorder.state !== 'inactive') {
      capture.mediaRecorder.stop(); // triggers onstop -> finalizeAndUpload
    }
  },

  // Stop and save any active recording (on leaving the hosting page or tab close).
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

/**
 * Keeps an active recording alive across phone rotation (which changes neither the host route nor the
 * mount) while stopping and saving it on real navigation away or tab close. Call once in each recorder
 * host (the appointments page and the in-person visit layout).
 */
export function useStopAmbientScribeOnLeave(): void {
  const { pathname } = useLocation();
  const hostPathRef = useRef(pathname);

  // Covers navigations that keep the host mounted (e.g. switching patients under the in-person layout).
  useEffect(() => {
    if (pathname !== hostPathRef.current) {
      audioRecordingActions.flushActiveSession();
      hostPathRef.current = pathname;
    }
  }, [pathname]);

  // Covers navigations that unmount the host (e.g. leaving the appointments page) and tab close/reload.
  useEffect(() => {
    const flush = (): void => audioRecordingActions.flushActiveSession();
    window.addEventListener('pagehide', flush);
    return () => {
      window.removeEventListener('pagehide', flush);
      flush();
    };
  }, []);
}
