import { Jimp, JimpMime } from 'jimp';
import { getImageOrientation, InsuranceCardRotationDegrees } from 'utils';

/** Longest allowed side of a stored card image; anything larger is downscaled (aspect preserved). */
export const MAX_DIMENSION = 2000;
/** JPEG quality used when the image has to be re-encoded. */
export const JPEG_QUALITY = 85;

/** Content types this normalizer can decode. The intake client converts HEIC to JPEG before upload. */
export const NORMALIZABLE_CONTENT_TYPES = ['image/jpeg', 'image/png'] as const;

/** Copies a Buffer's used range into a standalone ArrayBuffer (getImageOrientation wants one). */
export function toArrayBuffer(bytes: Buffer): ArrayBuffer {
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
}

/**
 * Reads the STORED (pre-EXIF-rotation) pixel dimensions straight from the JPEG's SOF segment.
 * Used to verify that Jimp.read really baked a 90-degree EXIF orientation (5-8) into the pixels:
 * jimp's EXIF pass (exif-parser) silently swallows parse errors, so it can disagree with utils'
 * getImageOrientation — and re-encoding an un-rotated bitmap would strip the EXIF tag and make the
 * mis-orientation permanent. Returns null when no SOF segment is found (treat as unverifiable).
 */
function getJpegStoredDimensions(bytes: Buffer): { width: number; height: number } | null {
  let offset = 2; // skip SOI
  // Walk marker segments: [0xFF][marker][length:2][payload]. SOFn markers are 0xC0-0xCF except
  // 0xC4 (DHT), 0xC8 (JPG extension), 0xCC (DAC); their payload is [precision:1][height:2][width:2].
  while (offset + 9 <= bytes.length) {
    if (bytes[offset] !== 0xff) return null;
    const marker = bytes[offset + 1];
    if (marker === 0xda) return null; // start-of-scan reached without a SOF: give up
    if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
      return { height: bytes.readUInt16BE(offset + 5), width: bytes.readUInt16BE(offset + 7) };
    }
    offset += 2 + bytes.readUInt16BE(offset + 2);
  }
  return null;
}

export interface NormalizedInsuranceCardImage {
  bytes: Buffer;
  contentType: string;
  /** false = the original bytes are already upright and within size; nothing was re-encoded. */
  changed: boolean;
  width: number;
  height: number;
}

/**
 * Normalizes an uploaded insurance-card image so display, OCR, and the PDF composer all get an
 * upright, right-sized image:
 *  1. bakes the EXIF orientation into the pixels (so viewers that ignore EXIF still show it upright)
 *  2. downscales when the longest side exceeds MAX_DIMENSION (aspect preserved)
 *
 * EXIF handling: jimp v1 (@jimp/core image-bitmap.ts exifRotate) automatically applies the EXIF
 * orientation tag — all eight orientations, including the mirrored ones — to the bitmap when
 * decoding a JPEG, then treats the image as orientation 1. So Jimp.read itself performs the
 * pixel baking; applying utils' getOrientationCorrection on top would DOUBLE-rotate. We use the
 * (reused) getImageOrientation parser only to decide whether a re-encode is needed at all; because
 * the two parsers can disagree (jimp swallows EXIF parse errors), 90-degree orientations (5-8) are
 * additionally verified against the JPEG's stored SOF dimensions before the bake is trusted — see
 * the parser-mismatch guard below.
 * The re-encoded output is written by jpeg-js, which emits no EXIF segment, so downstream
 * EXIF-aware viewers cannot rotate it a second time. Both facts are locked in by the corner-pixel
 * tests in ./test/normalize-image.test.ts.
 *
 * Throws when the bytes are not a decodable image; callers must treat that as non-fatal.
 */
export async function normalizeInsuranceCardImage(
  bytes: Buffer,
  contentType: string
): Promise<NormalizedInsuranceCardImage> {
  // EXIF orientation only exists in JPEGs; the parser walks JPEG markers, so gate by content type
  // (and never let a malformed EXIF block break normalization — resize may still be needed).
  let orientation = -1;
  if (contentType === 'image/jpeg') {
    try {
      orientation = getImageOrientation(toArrayBuffer(bytes));
    } catch {
      orientation = -1;
    }
  }
  const needsOrientationBake = orientation >= 2 && orientation <= 8;

  // Jimp.read bakes the EXIF orientation into the pixels (see doc comment above), so width/height
  // here are already the upright dimensions.
  const image = await Jimp.read(bytes);
  const { width, height } = image;
  const needsResize = Math.max(width, height) > MAX_DIMENSION;

  if (!needsOrientationBake && !needsResize) {
    return { bytes, contentType, changed: false, width, height };
  }

  // Parser-mismatch guard: the gate above uses utils' getImageOrientation, but the actual baking is
  // jimp's EXIF pass, which SILENTLY swallows parse errors. If jimp failed to bake, re-encoding here
  // would store an un-rotated bitmap with the EXIF tag stripped — permanently mis-oriented, with no
  // metadata left to recover from. Orientations 5-8 imply a 90-degree turn, so a successful bake is
  // verifiable: the decoded dimensions must be SWAPPED relative to the JPEG's stored SOF dimensions.
  // On mismatch (or when the stored dimensions can't be read) do NOT re-encode: return the ORIGINAL
  // bytes unchanged so EXIF-aware viewers still render the image correctly. (Square images pass
  // trivially — swapped and unswapped dimensions are identical, so the check cannot flag them.)
  if (orientation >= 5 && orientation <= 8) {
    const stored = getJpegStoredDimensions(bytes);
    const bakeApplied = stored !== null && width === stored.height && height === stored.width;
    if (!bakeApplied) {
      return { bytes, contentType, changed: false, width, height };
    }
  }

  if (needsResize) {
    image.scaleToFit({ w: MAX_DIMENSION, h: MAX_DIMENSION });
  }

  // JPEG has no alpha channel and jpeg-js simply drops it, which turns PNG transparency into black.
  // On the re-encode path only, flatten a PNG onto a white background first.
  // cast: new Jimp() and Jimp.read() instances have unrelated generic types, but both implement
  // composite/getBuffer; jimp's Buffer type also resolves against a second @types/node copy.
  let toEncode = image as { getBuffer: typeof image.getBuffer };
  if (contentType === 'image/png') {
    const flattened = new Jimp({ width: image.width, height: image.height, color: 0xffffffff });
    flattened.composite(image, 0, 0);
    toEncode = flattened as unknown as typeof toEncode;
  }

  const encoded = (await toEncode.getBuffer(JimpMime.jpeg, { quality: JPEG_QUALITY })) as unknown as Uint8Array;
  return {
    bytes: Buffer.from(encoded),
    contentType: JimpMime.jpeg,
    changed: true,
    width: image.width,
    height: image.height,
  };
}

export interface RotatedInsuranceCardImage {
  bytes: Buffer;
  contentType: string;
  width: number;
  height: number;
}

/**
 * Rotates a stored insurance-card image CLOCKWISE by the given angle and re-encodes it as JPEG
 * (same JPEG_QUALITY as normalization). Used by the staff-triggered rotate-insurance-card-image
 * zambda for manual fixed-angle rotates.
 *
 * Direction: jimp v1's rotate() spins the bitmap COUNTER-clockwise for positive angles, so the
 * clockwise request maps to rotate(360 - degrees). The direction is locked in by the corner-pixel
 * tests in src/ehr/rotate-insurance-card-image/test/.
 *
 * EXIF: Jimp.read bakes any EXIF orientation into the pixels while decoding (see the doc comment
 * on normalizeInsuranceCardImage), and the jpeg-js output carries no EXIF segment — so the stored
 * result is exactly what the staff member sees, rotated, with no second rotation possible.
 *
 * Throws when the bytes are not a decodable image; callers must report that as a rotate failure.
 */
export async function rotateImageClockwise(
  bytes: Buffer,
  degrees: InsuranceCardRotationDegrees
): Promise<RotatedInsuranceCardImage> {
  const image = await Jimp.read(bytes);
  image.rotate(360 - degrees);
  // cast: jimp's Buffer type resolves against a second @types/node copy in this workspace
  const encoded = (await image.getBuffer(JimpMime.jpeg, { quality: JPEG_QUALITY })) as unknown as Uint8Array;
  return { bytes: Buffer.from(encoded), contentType: JimpMime.jpeg, width: image.width, height: image.height };
}
