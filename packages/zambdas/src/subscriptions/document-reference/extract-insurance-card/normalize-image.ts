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
 * (reused) getImageOrientation parser only to decide whether a re-encode is needed at all.
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

  if (needsResize) {
    image.scaleToFit({ w: MAX_DIMENSION, h: MAX_DIMENSION });
  }

  // cast: jimp's Buffer type resolves against a second @types/node copy in this workspace
  const encoded = (await image.getBuffer(JimpMime.jpeg, { quality: JPEG_QUALITY })) as unknown as Uint8Array;
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
