// Enough bytes to cover the furthest-out signature below (WAV's `WAVE` at offset 8).
const CONTAINER_HEADER_BYTES = 12;

const ascii = (head: Uint8Array, offset: number, length: number): string =>
  String.fromCharCode(...head.subarray(offset, offset + length));

// One entry per container MediaRecorder may produce (see MIME_TYPES in audioRecording.store), mapping magic
// bytes to the MIME type those bytes *are*. MP4 carries `ftyp` in the second word; the others lead with theirs.
// `aliases` are other spellings MIME_TYPES uses for the same container: a recording declared one of those is
// still a recording we have a signature for, so a missing header has to fail rather than pass through.
const CONTAINERS: { mimeType: string; aliases?: string[]; matches: (head: Uint8Array) => boolean }[] = [
  { mimeType: 'audio/mp4', matches: (head) => ascii(head, 4, 4) === 'ftyp' }, // iOS Safari
  {
    mimeType: 'audio/webm', // desktop
    matches: (head) => head[0] === 0x1a && head[1] === 0x45 && head[2] === 0xdf && head[3] === 0xa3,
  },
  { mimeType: 'audio/wav', matches: (head) => ascii(head, 0, 4) === 'RIFF' && ascii(head, 8, 4) === 'WAVE' },
  {
    mimeType: 'audio/mpeg',
    aliases: ['audio/mp3'],
    matches: (head) => ascii(head, 0, 3) === 'ID3' || (head[0] === 0xff && (head[1] & 0xe0) === 0xe0),
  },
];

/**
 * Returns the Content-Type an Ambient Scribe recording should be uploaded as, read from its own bytes.
 *
 * The bytes decide rather than `MediaRecorder.mimeType`, because the stored Content-Type is what the backend
 * forwards to Vertex as `inlineData.mimeType`, and a type disagreeing with the actual container earns the
 * same opaque 400 INVALID_ARGUMENT as an unparseable one. Throws when the buffer doesn't start at the
 * declared container's boundary — the production failure, where the init segment ended up mid-file — so the
 * caller can tell the provider instead of losing the note to a backend error.
 */
export const detectAudioContainerType = async (blob: Blob, declaredType: string): Promise<string> => {
  if (blob.size === 0) {
    throw new Error('recording is empty');
  }
  const head = new Uint8Array(await blob.slice(0, CONTAINER_HEADER_BYTES).arrayBuffer());
  const container = CONTAINERS.find(({ matches }) => matches(head));
  // Worthless on its own (`audio/mp3` is really `audio/mpeg`), but it tells the two no-match cases apart.
  const normalizedDeclared = declaredType.split(';')[0].trim();
  const declared = CONTAINERS.find(
    ({ mimeType, aliases }) => mimeType === normalizedDeclared || aliases?.includes(normalizedDeclared)
  );

  if (container) {
    if (declared && declared !== container) {
      console.warn(
        `Recorder declared ${declared.mimeType} but the recording is ${container.mimeType}; uploading as the latter`
      );
    }
    return container.mimeType;
  }

  const hex = Array.from(head)
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join(' ');
  // No match only proves corruption when the recorder named a container we have a signature for. Otherwise
  // startRecording let the browser pick one we don't recognise, and those transcribed fine before this check
  // existed — pass the declared type through rather than destroying the only copy over a gap in this list.
  if (declared) {
    throw new Error(`recording has no ${declared.mimeType} container header (first bytes: ${hex})`);
  }
  const fallbackType = normalizedDeclared || 'audio/webm';
  console.warn(`Unrecognised audio container (first bytes: ${hex}); uploading as declared ${fallbackType}`);
  return fallbackType;
};
