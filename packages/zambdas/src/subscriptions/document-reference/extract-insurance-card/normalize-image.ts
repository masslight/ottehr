import { Jimp, JimpMime } from 'jimp';
import { InsuranceCardRotationDegrees } from 'utils';

/** JPEG quality used when the image has to be re-encoded. */
export const JPEG_QUALITY = 85;

/** Content types the rotate-insurance-card-image zambda can decode and re-encode. */
export const NORMALIZABLE_CONTENT_TYPES = ['image/jpeg', 'image/png'] as const;

export interface RotatedInsuranceCardImage {
  bytes: Buffer;
  contentType: string;
  width: number;
  height: number;
}

/**
 * Rotates a stored insurance-card image CLOCKWISE by the given angle and re-encodes it as JPEG.
 * Used by the staff-triggered rotate-insurance-card-image zambda for manual fixed-angle rotates.
 *
 * Direction: jimp v1's rotate() spins the bitmap COUNTER-clockwise for positive angles, so the
 * clockwise request maps to rotate(360 - degrees). The direction is locked in by the corner-pixel
 * tests in src/ehr/rotate-insurance-card-image/test/.
 *
 * EXIF: Jimp.read bakes any EXIF orientation into the pixels while decoding, and the jpeg-js
 * output carries no EXIF segment — so the stored result is exactly what the staff member sees,
 * rotated, with no second rotation possible.
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
