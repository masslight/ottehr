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

const enqueueSnackbar = vi.fn();
vi.mock('notistack', () => ({
  enqueueSnackbar: (...args: unknown[]) => enqueueSnackbar(...args),
}));

// The marker a WebM file opens with — a healthy desktop recording.
const EBML_HEADER = [0x1a, 0x45, 0xdf, 0xa3, 0x01, 0x00, 0x00, 0x00];
// Copied from the recording that broke transcription in production: a chunk from the middle of a recording,
// with no opening marker, because a second recorder's chunks were mixed in and pushed the header mid-file.
const HEADERLESS_CHUNK = [0x00, 0x00, 0x01, 0x24, 0x6d, 0x6f, 0x6f, 0x66];
// The marker an MP4 file carries in bytes 4-8 (`ftyp`) — what iOS Safari produces.
const FTYP_HEADER = [0x00, 0x00, 0x00, 0x20, 0x66, 0x74, 0x79, 0x70, 0x69, 0x73, 0x6f, 0x6d];

// Minimal MediaRecorder/getUserMedia stubs — jsdom/node don't provide the media capture APIs.
const trackStop = vi.fn();
class MockMediaRecorder {
  static instances: MockMediaRecorder[] = [];
  static isTypeSupported = (): boolean => true;
  state: 'inactive' | 'recording' | 'paused' = 'inactive';
  mimeType = 'audio/webm';
  ondataavailable: ((event: { data: Blob }) => void) | null = null;
  onstop: (() => void) | null = null;
  onpause: (() => void) | null = null;
  onerror: ((event: unknown) => void) | null = null;
  constructor() {
    MockMediaRecorder.instances.push(this);
  }
  // Stand-in for a `dataavailable` tick, to control which bytes land in which buffer.
  emit(bytes: number[]): void {
    this.ondataavailable?.({ data: new Blob([new Uint8Array(bytes)]) });
  }
  start(): void {
    this.state = 'recording';
  }
  stop(): void {
    this.state = 'inactive';
    this.emit(EBML_HEADER); // real recorders flush a final chunk before onstop
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

const mockStream = (): MediaStream =>
  ({
    getTracks: () => [{ stop: trackStop, addEventListener: vi.fn(), removeEventListener: vi.fn() }],
  }) as unknown as MediaStream;

const getUserMedia = vi.fn(async () => mockStream());

const lastPut = (): { body: Blob; headers: Record<string, string> } => {
  const calls = (
    globalThis.fetch as unknown as { mock: { calls: [string, { body: Blob; headers: Record<string, string> }][] } }
  ).mock.calls;
  return calls[calls.length - 1][1];
};

// Hex of the blob handed to the presigned PUT, for asserting *which* chunks made it in.
const uploadedHex = async (): Promise<string> => {
  const bytes = new Uint8Array(await lastPut().body.arrayBuffer());
  return Array.from(bytes)
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
};

// The Content-Type stored on the Z3 object is what the backend forwards to Vertex as inlineData.mimeType.
const uploadedContentType = (): string => lastPut().headers['Content-Type'];

beforeEach(() => {
  MockMediaRecorder.instances = [];
  vi.stubGlobal('MediaRecorder', MockMediaRecorder);
  vi.stubGlobal('navigator', { mediaDevices: { getUserMedia } });
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => ({ ok: true }))
  );
  uploadAudioRecording.mockClear();
  createResourcesFromAudioRecording.mockClear();
  enqueueSnackbar.mockClear();
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

  test('a start cancelled while the mic is opening releases it', async () => {
    const { audioRecordingActions, useAudioRecordingStore } = await import(
      'src/features/visits/shared/stores/audioRecording.store'
    );

    let resolveStream: (stream: MediaStream) => void = () => undefined;
    getUserMedia.mockImplementationOnce(
      () =>
        new Promise<MediaStream>((resolve) => {
          resolveStream = resolve;
        })
    );

    // Navigating away while the permission prompt is still up: there is no session yet, so flush has nothing
    // to stop — but the mic is about to open behind us, with no recorder anything can reach.
    const starting = audioRecordingActions.startRecording({ visitID: 'enc-1', oystehr });
    audioRecordingActions.flushActiveSession();
    resolveStream(mockStream());
    await starting;

    expect(trackStop).toHaveBeenCalled(); // mic released rather than left live
    expect(MockMediaRecorder.instances).toHaveLength(0);
    expect(useAudioRecordingStore.getState().session).toBeNull();
    expect(audioRecordingActions.getStream()).toBeNull();
    expect(uploadAudioRecording).not.toHaveBeenCalled();

    // And the abandoned attempt must not wedge the single-recording slot.
    await audioRecordingActions.startRecording({ visitID: 'enc-1', oystehr });
    expect(useAudioRecordingStore.getState().session?.visitID).toBe('enc-1');
  });

  test('a denied microphone tells the provider instead of failing silently', async () => {
    const { audioRecordingActions, useAudioRecordingStore } = await import(
      'src/features/visits/shared/stores/audioRecording.store'
    );

    getUserMedia.mockRejectedValueOnce(new Error('NotAllowedError'));

    await audioRecordingActions.startRecording({ visitID: 'enc-1', oystehr });

    // A silent no-op reads as a dead Record button, and the provider keeps talking to a mic that never opened.
    expect(enqueueSnackbar).toHaveBeenCalledWith(expect.stringContaining('microphone'), { variant: 'error' });
    expect(useAudioRecordingStore.getState().session).toBeNull();

    await audioRecordingActions.startRecording({ visitID: 'enc-1', oystehr });
    expect(useAudioRecordingStore.getState().session?.visitID).toBe('enc-1');
  });

  test("a stale recorder's failure cannot stop the next recording for the same visit", async () => {
    const { audioRecordingActions, useAudioRecordingStore } = await import(
      'src/features/visits/shared/stores/audioRecording.store'
    );
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);

    await audioRecordingActions.startRecording({ visitID: 'enc-1', oystehr });
    const first = MockMediaRecorder.instances[0];
    audioRecordingActions.stop();
    await vi.waitFor(() => expect(uploadAudioRecording).toHaveBeenCalledWith(oystehr, { visitID: 'enc-1' }));

    await audioRecordingActions.startRecording({ visitID: 'enc-1', oystehr });
    // The dead recorder reports what killed it (or its track fires `ended`) after the provider has already
    // pressed Record again. Keyed on visitID rather than capture identity, this stopped the *new* recording.
    first.onerror?.({ error: new Error('device lost') });

    expect(useAudioRecordingStore.getState().session).toMatchObject({ visitID: 'enc-1', status: 'RECORDING' });
    expect(MockMediaRecorder.instances[1].state).toBe('recording');

    warn.mockRestore();
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

  test('concurrent startRecording calls create only one recorder', async () => {
    const { audioRecordingActions, useAudioRecordingStore } = await import(
      'src/features/visits/shared/stores/audioRecording.store'
    );

    // A double-tap on Record: both get past a `session`-based guard, since `session` isn't written until
    // after the getUserMedia await. The second recorder would hold the mic forever.
    await Promise.all([
      audioRecordingActions.startRecording({ visitID: 'enc-1', oystehr }),
      audioRecordingActions.startRecording({ visitID: 'enc-1', oystehr }),
    ]);

    expect(getUserMedia).toHaveBeenCalledOnce();
    expect(MockMediaRecorder.instances).toHaveLength(1);
    expect(useAudioRecordingStore.getState().session?.visitID).toBe('enc-1');
  });

  test('a recorder that outlives its session cannot write into the next recording', async () => {
    const { audioRecordingActions } = await import('src/features/visits/shared/stores/audioRecording.store');

    await audioRecordingActions.startRecording({ visitID: 'enc-1', oystehr });
    const first = MockMediaRecorder.instances[0];
    audioRecordingActions.stop();
    await vi.waitFor(() => expect(uploadAudioRecording).toHaveBeenCalledWith(oystehr, { visitID: 'enc-1' }));

    await audioRecordingActions.startRecording({ visitID: 'enc-2', oystehr });
    const second = MockMediaRecorder.instances[1];
    expect(second).not.toBe(first);

    // A late fragment from the stale recorder. It used to land in enc-2's buffer via the shared
    // `capture.chunks`, producing two interleaved streams no decoder could read.
    first.emit([0xde, 0xad, 0xbe, 0xef]);
    second.emit([...EBML_HEADER, 0x11, 0x22]);
    audioRecordingActions.stop();
    await vi.waitFor(() => expect(uploadAudioRecording).toHaveBeenCalledWith(oystehr, { visitID: 'enc-2' }));

    const hex = await uploadedHex();
    expect(hex).not.toContain('deadbeef'); // the stale recorder's bytes stayed out
    expect(hex.startsWith('1a45dfa3')).toBe(true); // enc-2 still begins with its own opening marker
  });

  test('a recording with no container header is not uploaded', async () => {
    const { audioRecordingActions, useAudioRecordingStore } = await import(
      'src/features/visits/shared/stores/audioRecording.store'
    );

    await audioRecordingActions.startRecording({ visitID: 'enc-1', oystehr });
    // A chunk from mid-recording, where the opening marker should be: uploading it buys an opaque Vertex
    // 400 and no note.
    MockMediaRecorder.instances[0].emit(HEADERLESS_CHUNK);
    audioRecordingActions.stop();

    await vi.waitFor(() => expect(enqueueSnackbar).toHaveBeenCalled());
    expect(uploadAudioRecording).not.toHaveBeenCalled();
    expect(createResourcesFromAudioRecording).not.toHaveBeenCalled();
    expect(trackStop).toHaveBeenCalled(); // mic still released
    expect(useAudioRecordingStore.getState().uploadingVisitID).toBeNull();
  });

  // Which containers are recognised is audio-container.helper.test.ts's job; this covers only the wiring.
  test('the detected container type is what gets uploaded', async () => {
    const { audioRecordingActions } = await import('src/features/visits/shared/stores/audioRecording.store');

    await audioRecordingActions.startRecording({ visitID: 'enc-1', oystehr });
    const recorder = MockMediaRecorder.instances[0];
    recorder.mimeType = 'audio/webm;codecs=opus'; // claims webm...
    recorder.emit(FTYP_HEADER); // ...but produces MP4
    audioRecordingActions.stop();

    await vi.waitFor(() => expect(uploadAudioRecording).toHaveBeenCalledWith(oystehr, { visitID: 'enc-1' }));
    expect(uploadedContentType()).toBe('audio/mp4');
    expect(enqueueSnackbar).not.toHaveBeenCalled(); // usable audio, just mislabelled — upload it
  });

  test('a recorder that inactivated itself still uploads what it captured', async () => {
    const { audioRecordingActions, useAudioRecordingStore } = await import(
      'src/features/visits/shared/stores/audioRecording.store'
    );

    await audioRecordingActions.startRecording({ visitID: 'enc-1', oystehr });
    const recorder = MockMediaRecorder.instances[0];
    recorder.emit(EBML_HEADER);
    // A fatal error inactivates the recorder and fires `error` before the queued `stop`, so stop() finds it
    // already inactive and onstop never arrives. Discarding the buffer here would lose the whole recording.
    recorder.state = 'inactive';
    audioRecordingActions.stop();

    await vi.waitFor(() => expect(createResourcesFromAudioRecording).toHaveBeenCalledOnce());
    expect(uploadAudioRecording).toHaveBeenCalledWith(oystehr, { visitID: 'enc-1' });
    expect((await uploadedHex()).startsWith('1a45dfa3')).toBe(true);
    expect(trackStop).toHaveBeenCalled(); // mic released
    expect(useAudioRecordingStore.getState().session).toBeNull();
    expect(useAudioRecordingStore.getState().uploadingVisitID).toBeNull();
  });

  test('a recorder that ends itself tears the session down and keeps its duration', async () => {
    const { audioRecordingActions, useAudioRecordingStore } = await import(
      'src/features/visits/shared/stores/audioRecording.store'
    );
    const now = vi.spyOn(performance, 'now');

    // Tracks all ending (revoked permission, unplug, iOS interruption) stops the recorder itself, firing
    // onstop with no stop() in front of it.
    now.mockReturnValue(1_000);
    await audioRecordingActions.startRecording({ visitID: 'enc-1', oystehr });
    now.mockReturnValue(61_000);
    MockMediaRecorder.instances[0].stop();

    await vi.waitFor(() => expect(createResourcesFromAudioRecording).toHaveBeenCalledOnce());
    // Unfrozen, this persists as 0 for a full-length visit.
    expect(createResourcesFromAudioRecording).toHaveBeenCalledWith(
      oystehr,
      expect.objectContaining({ duration: 60_000 })
    );
    // The UI must not be left ticking on an already-released mic.
    expect(useAudioRecordingStore.getState().session).toBeNull();
    expect(audioRecordingActions.getStream()).toBeNull();
    expect(trackStop).toHaveBeenCalled();
    await vi.waitFor(() => expect(useAudioRecordingStore.getState().uploadingVisitID).toBeNull());
    // Pause used to reach an inactive MediaRecorder and throw InvalidStateError out of the click handler.
    expect(() => audioRecordingActions.pause()).not.toThrow();

    now.mockRestore();
  });

  test('a recorder that cannot be constructed releases the mic', async () => {
    const { audioRecordingActions, useAudioRecordingStore } = await import(
      'src/features/visits/shared/stores/audioRecording.store'
    );

    vi.stubGlobal(
      'MediaRecorder',
      class {
        static isTypeSupported = (): boolean => true;
        constructor() {
          throw new Error('NotSupportedError');
        }
      }
    );

    await audioRecordingActions.startRecording({ visitID: 'enc-1', oystehr });

    expect(trackStop).toHaveBeenCalled();
    expect(useAudioRecordingStore.getState().session).toBeNull();
    expect(audioRecordingActions.getStream()).toBeNull();
    expect(enqueueSnackbar).toHaveBeenCalled();
    // The failed attempt must not wedge the single-recording slot.
    vi.stubGlobal('MediaRecorder', MockMediaRecorder);
    await audioRecordingActions.startRecording({ visitID: 'enc-1', oystehr });
    expect(useAudioRecordingStore.getState().session?.visitID).toBe('enc-1');
  });
});
