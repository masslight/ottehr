import { describe, expect, test, vi } from 'vitest';
import { detectAudioContainerType } from './audio-container.helper';

const blobOf = (...bytes: number[]): Blob => new Blob([new Uint8Array(bytes)]);

const EBML = [0x1a, 0x45, 0xdf, 0xa3, 0x01, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00]; // WebM
const FTYP = [0x00, 0x00, 0x00, 0x20, 0x66, 0x74, 0x79, 0x70, 0x69, 0x73, 0x6f, 0x6d]; // `....ftypisom`
const RIFF_WAVE = [0x52, 0x49, 0x46, 0x46, 0x24, 0x00, 0x00, 0x00, 0x57, 0x41, 0x56, 0x45]; // `RIFF....WAVE`
const ID3 = [0x49, 0x44, 0x33, 0x03, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00]; // MP3 with an ID3v2 tag
const MP3_FRAME_SYNC = [0xff, 0xfb, 0x90, 0x44, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00]; // bare MP3 frame

describe('detectAudioContainerType', () => {
  // Every type MIME_TYPES lets MediaRecorder pick: a narrower list throws away valid audio.
  test.each([
    ['webm', EBML, 'audio/webm'],
    ['mp4', FTYP, 'audio/mp4'],
    ['wav', RIFF_WAVE, 'audio/wav'],
    ['mp3 (ID3 tag)', ID3, 'audio/mpeg'],
    ['mp3 (frame sync)', MP3_FRAME_SYNC, 'audio/mpeg'],
  ])('recognises %s', async (_name, header, expected) => {
    await expect(detectAudioContainerType(blobOf(...header), expected)).resolves.toBe(expected);
  });

  test('rejects a buffer that starts mid-stream', async () => {
    // The production failure: a bare `moof` fragment where the init segment should be.
    const moofFragment = [0x00, 0x00, 0x01, 0x24, 0x6d, 0x6f, 0x6f, 0x66, 0x00, 0x00, 0x00, 0x00];

    await expect(detectAudioContainerType(blobOf(...moofFragment), 'audio/mp4')).rejects.toThrow(
      /no audio\/mp4 container header \(first bytes: 00 00 01 24 6d 6f 6f 66/
    );
  });

  test('rejects an empty recording', async () => {
    await expect(detectAudioContainerType(new Blob([]), 'audio/webm')).rejects.toThrow('recording is empty');
  });

  test('rejects a buffer too short to hold a header', async () => {
    // A truncated first chunk can look like the start of a container without being one.
    await expect(detectAudioContainerType(blobOf(0x1a, 0x45), 'audio/webm')).rejects.toThrow(
      /no audio\/webm container header \(first bytes: 1a 45\)/
    );
  });

  test('an unrecognised declared type passes through instead of failing the recording', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);

    // When none of MIME_TYPES is supported startRecording lets the browser choose, so the recorder can
    // legitimately hand us a container we have no signature for. Rejecting it would destroy the only copy.
    const oggPage = [0x4f, 0x67, 0x67, 0x53, 0x00, 0x02, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00]; // `OggS`

    await expect(detectAudioContainerType(blobOf(...oggPage), 'audio/ogg;codecs=opus')).resolves.toBe('audio/ogg');
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('Unrecognised audio container'));

    warn.mockRestore();
  });

  test('the bytes win over a disagreeing declared type', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);

    // Storing audio/webm here would reach Vertex as inlineData.mimeType — another opaque 400 on readable audio.
    await expect(detectAudioContainerType(blobOf(...FTYP), 'audio/webm;codecs=opus')).resolves.toBe('audio/mp4');
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('declared audio/webm but the recording is audio/mp4'));

    warn.mockRestore();
  });

  test('a codecs suffix on an agreeing declared type is not a disagreement', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);

    await expect(detectAudioContainerType(blobOf(...EBML), 'audio/webm;codecs=opus')).resolves.toBe('audio/webm');
    // Nor is `audio/mp3` for what is really `audio/mpeg` — MIME_TYPES lists both spellings.
    await expect(detectAudioContainerType(blobOf(...ID3), 'audio/mp3')).resolves.toBe('audio/mpeg');
    expect(warn).not.toHaveBeenCalled();

    warn.mockRestore();
  });
});
