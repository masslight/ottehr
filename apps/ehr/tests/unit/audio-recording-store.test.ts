import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

// The store's only external dependency is the two api wrappers; stub them so nothing hits the network.
const uploadAudioRecording = vi.fn(async (..._args: unknown[]) => ({
  z3URL: 'z3://bucket/enc-1.webm',
  presignedUploadUrl: 'https://upload',
}));
const createResourcesFromAudioRecording = vi.fn(async (..._args: unknown[]) => ({
  presignedUploadUrl: 'https://upload',
}));
vi.mock('src/api/api', () => ({
  uploadAudioRecording: (...args: unknown[]) => uploadAudioRecording(...args),
  createResourcesFromAudioRecording: (...args: unknown[]) => createResourcesFromAudioRecording(...args),
}));

// Minimal MediaRecorder/getUserMedia stubs — jsdom/node don't provide the media capture APIs.
const trackStop = vi.fn();
class MockMediaRecorder {
  static isTypeSupported = (): boolean => true;
  state: 'inactive' | 'recording' | 'paused' = 'inactive';
  mimeType = 'audio/webm';
  ondataavailable: ((event: { data: Blob }) => void) | null = null;
  onstop: (() => void) | null = null;
  onpause: (() => void) | null = null;
  start(): void {
    this.state = 'recording';
  }
  stop(): void {
    this.state = 'inactive';
    this.onstop?.();
  }
  pause(): void {
    this.state = 'paused';
  }
  resume(): void {
    this.state = 'recording';
  }
  requestData(): void {}
}

const getUserMedia = vi.fn(async () => ({ getTracks: () => [{ stop: trackStop }] }));

beforeEach(() => {
  vi.stubGlobal('MediaRecorder', MockMediaRecorder);
  vi.stubGlobal('navigator', { mediaDevices: { getUserMedia } });
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => ({ ok: true }))
  );
  uploadAudioRecording.mockClear();
  createResourcesFromAudioRecording.mockClear();
  trackStop.mockClear();
  getUserMedia.mockClear();
});

afterEach(async () => {
  const { audioRecordingActions, useAudioRecordingStore } = await import(
    'src/features/visits/shared/stores/audioRecording.store'
  );
  // Drain any recording left active by a test through the (stubbed) upload before restoring globals,
  // so a deferred fetch can't escape onto the real-network guard.
  audioRecordingActions.flushActiveSession();
  await vi.waitFor(() => expect(useAudioRecordingStore.getState().uploadingVisitID).toBeNull());
  useAudioRecordingStore.setState({ session: null, uploadingVisitID: null });
  vi.unstubAllGlobals();
});

const oystehr = {} as never;

describe('audioRecording.store', () => {
  test('startRecording creates a session and holds the live stream in the store', async () => {
    const { audioRecordingActions, useAudioRecordingStore } = await import(
      'src/features/visits/shared/stores/audioRecording.store'
    );

    await audioRecordingActions.startRecording({ visitID: 'enc-1', oystehr });

    expect(useAudioRecordingStore.getState().session).toMatchObject({ visitID: 'enc-1', status: 'RECORDING' });
    // The capture is owned by the store, not a component — this is what lets it survive a remount on rotation.
    expect(audioRecordingActions.getStream()).not.toBeNull();
    expect(getUserMedia).toHaveBeenCalledOnce();
  });

  test('pause/resume toggles status without ending the session', async () => {
    const { audioRecordingActions, useAudioRecordingStore } = await import(
      'src/features/visits/shared/stores/audioRecording.store'
    );

    await audioRecordingActions.startRecording({ visitID: 'enc-1', oystehr });
    audioRecordingActions.pause();
    expect(useAudioRecordingStore.getState().session?.status).toBe('PAUSED');
    audioRecordingActions.resume();
    expect(useAudioRecordingStore.getState().session?.status).toBe('RECORDING');
    // Still recording — the stream was never torn down.
    expect(audioRecordingActions.getStream()).not.toBeNull();
  });

  test('stop uploads the recording and clears the session', async () => {
    const { audioRecordingActions, useAudioRecordingStore } = await import(
      'src/features/visits/shared/stores/audioRecording.store'
    );

    const onComplete = vi.fn();
    await audioRecordingActions.startRecording({ visitID: 'enc-1', oystehr, onComplete });
    audioRecordingActions.stop();

    // Session clears immediately; upload happens on the MediaRecorder onstop microtask chain.
    expect(useAudioRecordingStore.getState().session).toBeNull();
    await vi.waitFor(() => expect(createResourcesFromAudioRecording).toHaveBeenCalledOnce());
    expect(uploadAudioRecording).toHaveBeenCalledWith(oystehr, { visitID: 'enc-1' });
    expect(createResourcesFromAudioRecording).toHaveBeenCalledWith(
      oystehr,
      expect.objectContaining({ visitID: 'enc-1', z3URL: 'z3://bucket/enc-1.webm' })
    );
    expect(onComplete).toHaveBeenCalledOnce();
    expect(trackStop).toHaveBeenCalled(); // mic released
    expect(useAudioRecordingStore.getState().uploadingVisitID).toBeNull();
  });

  test('flushActiveSession saves an in-progress recording and is a no-op when idle', async () => {
    const { audioRecordingActions } = await import('src/features/visits/shared/stores/audioRecording.store');

    // No-op when nothing is recording.
    audioRecordingActions.flushActiveSession();
    expect(uploadAudioRecording).not.toHaveBeenCalled();

    // Saves when a recording is active (this is what runs on navigate-away / tab close).
    await audioRecordingActions.startRecording({ visitID: 'enc-2', oystehr });
    audioRecordingActions.flushActiveSession();
    await vi.waitFor(() => expect(uploadAudioRecording).toHaveBeenCalledWith(oystehr, { visitID: 'enc-2' }));
  });

  test('only one recording can be active at a time', async () => {
    const { audioRecordingActions, useAudioRecordingStore } = await import(
      'src/features/visits/shared/stores/audioRecording.store'
    );

    await audioRecordingActions.startRecording({ visitID: 'enc-1', oystehr });
    await audioRecordingActions.startRecording({ visitID: 'enc-2', oystehr });

    expect(useAudioRecordingStore.getState().session?.visitID).toBe('enc-1');
    expect(getUserMedia).toHaveBeenCalledOnce();
  });
});
