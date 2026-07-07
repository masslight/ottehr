import { intToRGBA, Jimp, JimpMime, rgbaToInt } from 'jimp';

export const RED = rgbaToInt(255, 0, 0, 255);
export const WHITE = rgbaToInt(255, 255, 255, 255);

/**
 * Splices a minimal EXIF APP1 segment carrying only the Orientation tag (little-endian TIFF)
 * directly after the JPEG SOI marker. Compatible with both utils' getImageOrientation parser
 * and jimp's exif-parser.
 */
export function withExifOrientation(jpeg: Buffer, orientation: number): Buffer {
  const app1 = Buffer.from([
    0xff,
    0xe1, // APP1 marker
    0x00,
    0x22, // segment length (34, big-endian)
    0x45,
    0x78,
    0x69,
    0x66,
    0x00,
    0x00, // "Exif\0\0"
    0x49,
    0x49,
    0x2a,
    0x00, // TIFF header: "II" little-endian, 42
    0x08,
    0x00,
    0x00,
    0x00, // IFD0 offset (8)
    0x01,
    0x00, // 1 tag
    0x12,
    0x01, // tag 0x0112 (Orientation)
    0x03,
    0x00, // type SHORT
    0x01,
    0x00,
    0x00,
    0x00, // count 1
    orientation,
    0x00,
    0x00,
    0x00, // value
    0x00,
    0x00,
    0x00,
    0x00, // next IFD offset (none)
  ]);
  // cast: two @types/node copies in this workspace disagree about Buffer/Uint8Array
  return Buffer.concat([jpeg.subarray(0, 2), app1, jpeg.subarray(2)] as unknown as Uint8Array[]);
}

/**
 * Builds a JPEG whose PIXELS are the given EXIF orientation's stored form of a canonical upright
 * "scene" (sceneWidth x sceneHeight, red block filling the scene's top-left quadrant, white
 * elsewhere), tagged with that orientation. The stored bitmap is derived with direct pixel math —
 * independent of jimp's own rotate — so tests using it genuinely prove the rotation DIRECTION of
 * the EXIF baking: a wrong direction would put the red quadrant in a different corner.
 *
 * Supported orientations: 1 (identity), 3 (rotate 180), 6 (stored = scene rotated 90 CCW; viewer
 * must rotate 90 CW), 8 (stored = scene rotated 90 CW; viewer must rotate 90 CCW).
 */
export async function makeOrientedSceneJpeg(
  orientation: 1 | 3 | 6 | 8,
  sceneWidth = 32,
  sceneHeight = 16
): Promise<Buffer> {
  const swapped = orientation === 6 || orientation === 8;
  const image = new Jimp({
    width: swapped ? sceneHeight : sceneWidth,
    height: swapped ? sceneWidth : sceneHeight,
    color: WHITE,
  });
  for (let y = 0; y < sceneHeight; y++) {
    for (let x = 0; x < sceneWidth; x++) {
      if (!(x < sceneWidth / 2 && y < sceneHeight / 2)) continue; // scene top-left quadrant only
      let storedX: number;
      let storedY: number;
      switch (orientation) {
        case 3: // stored = scene rotated 180
          storedX = sceneWidth - 1 - x;
          storedY = sceneHeight - 1 - y;
          break;
        case 6: // stored = scene rotated 90 CCW
          storedX = y;
          storedY = sceneWidth - 1 - x;
          break;
        case 8: // stored = scene rotated 90 CW
          storedX = sceneHeight - 1 - y;
          storedY = x;
          break;
        default: // 1: identity
          storedX = x;
          storedY = y;
      }
      image.setPixelColor(RED, storedX, storedY);
    }
  }
  const jpeg = (await image.getBuffer(JimpMime.jpeg, { quality: 100 })) as unknown as Uint8Array;
  return withExifOrientation(Buffer.from(jpeg), orientation);
}

/** Plain white JPEG with no EXIF segment. */
export async function makePlainJpeg(width: number, height: number): Promise<Buffer> {
  const image = new Jimp({ width, height, color: WHITE });
  return Buffer.from((await image.getBuffer(JimpMime.jpeg, { quality: 90 })) as unknown as Uint8Array);
}

/** Plain white PNG. */
export async function makePlainPng(width: number, height: number): Promise<Buffer> {
  const image = new Jimp({ width, height, color: WHITE });
  return Buffer.from((await image.getBuffer(JimpMime.png)) as unknown as Uint8Array);
}

/** True when the pixel at (x, y) is red-ish (tolerant of JPEG lossiness). */
// structural param type: Jimp.read's return type and new Jimp()'s instance type are unrelated generics
export function isRedAt(image: { getPixelColor(x: number, y: number): number }, x: number, y: number): boolean {
  const { r, g, b } = intToRGBA(image.getPixelColor(x, y));
  return r > 150 && g < 100 && b < 100;
}
