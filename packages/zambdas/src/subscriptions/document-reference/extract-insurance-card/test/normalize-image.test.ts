import { Jimp } from 'jimp';
import { getImageOrientation } from 'utils';
import { describe, expect, it } from 'vitest';
import { JPEG_QUALITY, MAX_DIMENSION, normalizeInsuranceCardImage, toArrayBuffer } from '../normalize-image';
import { isRedAt, makeOrientedSceneJpeg, makePlainJpeg, makePlainPng, withExifOrientation } from './image-fixtures';

const JPEG_SOI = [0xff, 0xd8];

describe('normalizeInsuranceCardImage', () => {
  it('no-ops (changed=false, same bytes) for a small JPEG without EXIF orientation', async () => {
    const bytes = await makePlainJpeg(40, 24);
    const result = await normalizeInsuranceCardImage(bytes, 'image/jpeg');
    expect(result.changed).toBe(false);
    expect(result.bytes).toBe(bytes); // exact same buffer, no re-encode
    expect(result.contentType).toBe('image/jpeg');
    expect(result).toMatchObject({ width: 40, height: 24 });
  });

  it('no-ops for a small JPEG with explicit EXIF orientation 1', async () => {
    const bytes = await makeOrientedSceneJpeg(1);
    expect(getImageOrientation(toArrayBuffer(bytes))).toBe(1);
    const result = await normalizeInsuranceCardImage(bytes, 'image/jpeg');
    expect(result.changed).toBe(false);
    expect(result.bytes).toBe(bytes);
  });

  it('no-ops for a small PNG, preserving the PNG content type', async () => {
    const bytes = await makePlainPng(40, 24);
    const result = await normalizeInsuranceCardImage(bytes, 'image/png');
    expect(result.changed).toBe(false);
    expect(result.contentType).toBe('image/png');
  });

  // The stored fixture bitmaps are built with direct pixel math (see image-fixtures.ts), so red
  // landing in the scene's top-left quadrant after normalization PROVES the rotation direction:
  // rotating an orientation-6 image the wrong way (90 CCW instead of 90 CW) would put the red
  // quadrant at the bottom-right instead.
  it.each([3, 6, 8] as const)('bakes EXIF orientation %d into upright pixels', async (orientation) => {
    const bytes = await makeOrientedSceneJpeg(orientation, 32, 16);
    // fixture sanity: the tag is present and readable by the reused utils parser
    expect(getImageOrientation(toArrayBuffer(bytes))).toBe(orientation);

    const result = await normalizeInsuranceCardImage(bytes, 'image/jpeg');

    expect(result.changed).toBe(true);
    expect(result.contentType).toBe('image/jpeg');
    // upright scene dimensions restored (6/8 fixtures are stored 16x32)
    expect(result.width).toBe(32);
    expect(result.height).toBe(16);

    const upright = await Jimp.read(result.bytes);
    expect(upright.width).toBe(32);
    expect(upright.height).toBe(16);
    expect(isRedAt(upright, 4, 4)).toBe(true); // scene top-left quadrant
    expect(isRedAt(upright, 27, 4)).toBe(false); // top-right
    expect(isRedAt(upright, 4, 11)).toBe(false); // bottom-left
    expect(isRedAt(upright, 27, 11)).toBe(false); // bottom-right

    // the output must carry no residual EXIF orientation, or EXIF-aware viewers would double-rotate
    expect(getImageOrientation(toArrayBuffer(result.bytes))).toBe(-1);
    expect([result.bytes[0], result.bytes[1]]).toEqual(JPEG_SOI);
  });

  it('downscales an oversized image to MAX_DIMENSION preserving aspect ratio', async () => {
    const bytes = await makePlainJpeg(2200, 1100);
    const result = await normalizeInsuranceCardImage(bytes, 'image/jpeg');
    expect(result.changed).toBe(true);
    expect(result.width).toBe(MAX_DIMENSION);
    expect(result.height).toBe(MAX_DIMENSION / 2);
    const decoded = await Jimp.read(result.bytes);
    expect(Math.max(decoded.width, decoded.height)).toBeLessThanOrEqual(MAX_DIMENSION);
    expect(decoded.width / decoded.height).toBeCloseTo(2, 2);
  });

  it('downscales an oversized PNG and re-encodes it as JPEG', async () => {
    const bytes = await makePlainPng(2100, 30);
    const result = await normalizeInsuranceCardImage(bytes, 'image/png');
    expect(result.changed).toBe(true);
    expect(result.contentType).toBe('image/jpeg');
    expect(result.width).toBe(MAX_DIMENSION);
    expect([result.bytes[0], result.bytes[1]]).toEqual(JPEG_SOI);
  });

  it('rotates AND downscales an oversized rotated image in one pass', async () => {
    // stored 1100x2200 tagged orientation 6 -> upright scene 2200x1100 -> resized 2000x1000
    const stored = new Jimp({ width: 1100, height: 2200, color: 0xffffffff });
    const encoded = (await stored.getBuffer('image/jpeg', { quality: 90 })) as unknown as Uint8Array;
    const jpeg = withExifOrientation(Buffer.from(encoded), 6);
    const result = await normalizeInsuranceCardImage(jpeg, 'image/jpeg');
    expect(result.changed).toBe(true);
    expect(result.width).toBe(MAX_DIMENSION);
    expect(result.height).toBe(MAX_DIMENSION / 2);
  });

  it('re-encodes at the configured JPEG quality constant', () => {
    // guards against the constants being accidentally reconfigured
    expect(JPEG_QUALITY).toBe(85);
    expect(MAX_DIMENSION).toBe(2000);
  });

  it('throws on undecodable bytes (caller treats normalization failure as non-fatal)', async () => {
    await expect(normalizeInsuranceCardImage(Buffer.from('not-an-image'), 'image/jpeg')).rejects.toThrow();
  });
});
