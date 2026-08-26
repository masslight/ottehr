import { describe, expect, it } from 'vitest';
import { detectMimeTypeFromBytes, getMimeType, MIME_TYPES } from './file';

const bytes = (...values: number[]): Uint8Array => new Uint8Array(values);

const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
const JPEG_SOI = [0xff, 0xd8, 0xff, 0xe0];

describe('detectMimeTypeFromBytes', () => {
  it('detects a PNG by its signature', () => {
    expect(detectMimeTypeFromBytes(bytes(...PNG_SIGNATURE, 0x00, 0x00))).toBe(MIME_TYPES.PNG);
  });

  it('detects a JPEG by its SOI marker', () => {
    expect(detectMimeTypeFromBytes(bytes(...JPEG_SOI, 0x00, 0x10, 0x4a, 0x46))).toBe(MIME_TYPES.JPEG);
  });

  it('detects a PDF header, including after a short binary preamble', () => {
    expect(detectMimeTypeFromBytes(new Uint8Array(Buffer.from('%PDF-1.7\n')))).toBe(MIME_TYPES.PDF);
    expect(
      detectMimeTypeFromBytes(new Uint8Array(Buffer.concat([Buffer.from([0x00, 0x01]), Buffer.from('%PDF-1.7')])))
    ).toBe(MIME_TYPES.PDF);
  });

  it('goes by the bytes, not by the name the file was stored under', () => {
    // The exact staging failure: a JPEG uploaded as "insurance-card-front-2.png". The url-derived
    // label says PNG; only the bytes know better.
    const mislabeled = bytes(...JPEG_SOI, 0x00, 0x10);
    expect(getMimeType('2026-08-10-insurance-card-front-2.png')).toBe(MIME_TYPES.PNG);
    expect(detectMimeTypeFromBytes(mislabeled)).toBe(MIME_TYPES.JPEG);
  });

  it('returns undefined for other formats, truncated bytes, and empty input', () => {
    expect(detectMimeTypeFromBytes(bytes(0x00, 0x00, 0x00, 0x18, 0x66, 0x74, 0x79, 0x70))).toBeUndefined(); // heic
    expect(detectMimeTypeFromBytes(bytes(...PNG_SIGNATURE.slice(0, 4)))).toBeUndefined();
    expect(detectMimeTypeFromBytes(new Uint8Array())).toBeUndefined();
  });
});
