import { downscaleImageForUpload, UPLOAD_IMAGE_JPEG_QUALITY, UPLOAD_IMAGE_MAX_DIMENSION } from 'utils/lib/frontend';
import { afterEach, beforeEach, describe, expect, it, MockInstance, vi } from 'vitest';

/**
 * jsdom implements neither createImageBitmap nor a real 2d canvas, so the pixel path is exercised
 * here with a stubbed createImageBitmap + canvas: the tests verify the BRANCHING and the geometry
 * (pass-through rules, cap, aspect ratio, JPEG re-encode parameters, fail-safe fallback). Actual
 * pixel decoding/re-encoding (including EXIF orientation and the byte-size reduction) needs a real
 * browser and is flagged for in-browser verification.
 */

/** Stubbed encoder output; small on purpose — jsdom cannot produce real JPEG bytes. */
const ENCODED_JPEG_BYTES = new Uint8Array([0xff, 0xd8, 0xff, 0xd9]);

interface ToBlobCall {
  width: number;
  height: number;
  type: string | undefined;
  quality: number | undefined;
}

describe('downscaleImageForUpload', () => {
  let toBlobCalls: ToBlobCall[];
  let warnSpy: MockInstance;

  const stubBitmap = (width: number, height: number): { close: ReturnType<typeof vi.fn> } => {
    const close = vi.fn();
    vi.stubGlobal(
      'createImageBitmap',
      vi.fn(async () => ({ width, height, close }))
    );
    return { close };
  };

  beforeEach(() => {
    toBlobCalls = [];
    warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
      fillStyle: '',
      fillRect: vi.fn(),
      drawImage: vi.fn(),
    } as unknown as CanvasRenderingContext2D);
    vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation(function (
      this: HTMLCanvasElement,
      callback: BlobCallback,
      type?: string,
      quality?: unknown
    ) {
      toBlobCalls.push({ width: this.width, height: this.height, type, quality: quality as number | undefined });
      callback(new Blob([ENCODED_JPEG_BYTES], { type: 'image/jpeg' }));
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('passes a non-image (PDF) through untouched', async () => {
    const pdf = new Blob(['%PDF-1.4 fake'], { type: 'application/pdf' });
    const result = await downscaleImageForUpload(pdf);
    expect(result).toBe(pdf);
    expect(toBlobCalls).toHaveLength(0);
  });

  it('returns an already-small image unchanged without re-encoding', async () => {
    const { close } = stubBitmap(1200, 800);
    const original = new Blob([new Uint8Array(10_000)], { type: 'image/png' });
    const result = await downscaleImageForUpload(original);
    expect(result).toBe(original);
    expect(toBlobCalls).toHaveLength(0);
    expect(close).toHaveBeenCalled();
  });

  it(`treats exactly ${UPLOAD_IMAGE_MAX_DIMENSION}px as within the cap`, async () => {
    stubBitmap(UPLOAD_IMAGE_MAX_DIMENSION, 1300);
    const original = new Blob([new Uint8Array(10_000)], { type: 'image/jpeg' });
    await expect(downscaleImageForUpload(original)).resolves.toBe(original);
    expect(toBlobCalls).toHaveLength(0);
  });

  it('downscales an oversized landscape image to the cap, aspect preserved, re-encoded as JPEG', async () => {
    const { close } = stubBitmap(4000, 3000);
    const original = new Blob([new Uint8Array(500_000)], { type: 'image/png' });
    const result = await downscaleImageForUpload(original);

    expect(result).not.toBe(original);
    expect(result.type).toBe('image/jpeg');
    expect(result.size).toBe(ENCODED_JPEG_BYTES.length);
    expect(result.size).toBeLessThan(original.size);
    expect(toBlobCalls).toEqual([
      { width: UPLOAD_IMAGE_MAX_DIMENSION, height: 1500, type: 'image/jpeg', quality: UPLOAD_IMAGE_JPEG_QUALITY },
    ]);
    expect(close).toHaveBeenCalled();
  });

  it('downscales an oversized portrait image with the long side capped', async () => {
    stubBitmap(1500, 5000);
    await downscaleImageForUpload(new Blob([new Uint8Array(500_000)], { type: 'image/jpeg' }));
    expect(toBlobCalls).toEqual([
      { width: 600, height: UPLOAD_IMAGE_MAX_DIMENSION, type: 'image/jpeg', quality: UPLOAD_IMAGE_JPEG_QUALITY },
    ]);
  });

  it('returns a renamed .jpg File when the input is an oversized File', async () => {
    stubBitmap(4000, 3000);
    const original = new File([new Uint8Array(500_000)], 'huge-card.photo.png', { type: 'image/png' });
    const result = await downscaleImageForUpload(original);
    expect(result).toBeInstanceOf(File);
    expect((result as File).name).toBe('huge-card.photo.jpg');
    expect(result.type).toBe('image/jpeg');
  });

  it('falls back to the original file when decoding fails, without throwing', async () => {
    vi.stubGlobal(
      'createImageBitmap',
      vi.fn(async () => {
        throw new Error('undecodable');
      })
    );
    // The <img> fallback also fails in jsdom (no object-URL decoding), driving the outer fail-safe.
    const original = new Blob([new Uint8Array([1, 2, 3])], { type: 'image/jpeg' });
    const result = await downscaleImageForUpload(original);
    expect(result).toBe(original);
    expect(warnSpy).toHaveBeenCalled();
  });

  it('falls back to the original file when the canvas encoder returns null', async () => {
    stubBitmap(4000, 3000);
    vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation((callback: BlobCallback) => callback(null));
    const original = new Blob([new Uint8Array(500_000)], { type: 'image/png' });
    const result = await downscaleImageForUpload(original);
    expect(result).toBe(original);
    expect(warnSpy).toHaveBeenCalled();
  });
});
