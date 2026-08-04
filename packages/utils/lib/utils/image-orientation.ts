// Shared EXIF-orientation helpers, extracted from pdf.ts so server-side image
// normalization (packages/zambdas extract-insurance-card) can reuse them.

// Get the image's EXIF orientation
// https://github.com/Hopding/pdf-lib/issues/1284
// https://stackoverflow.com/a/32490603
// Returns either the image orientation (1-8) or -1 if none found
export function getImageOrientation(file: ArrayBuffer): number {
  const view = new DataView(file);

  const length = view.byteLength;
  let offset = 2;

  while (offset < length) {
    if (view.getUint16(offset + 2, false) <= 8) return -1;
    const marker = view.getUint16(offset, false);
    offset += 2;

    // If EXIF buffer segment exists find the orientation
    if (marker == 0xffe1) {
      if (view.getUint32((offset += 2), false) != 0x45786966) {
        return -1;
      }

      const little = view.getUint16((offset += 6), false) == 0x4949;
      offset += view.getUint32(offset + 4, little);
      const tags = view.getUint16(offset, little);
      offset += 2;
      for (let i = 0; i < tags; i++) {
        if (view.getUint16(offset + i * 12, little) == 0x0112) {
          return view.getUint16(offset + i * 12 + 8, little);
        }
      }
    } else if ((marker & 0xff00) != 0xff00) {
      break;
    } else {
      offset += view.getUint16(offset, false);
    }
  }
  return -1;
}

// Get rotation in degrees from EXIF orientation
// https://sirv.com/help/articles/rotate-photos-to-be-upright/#exif-orientation-values
// x-mirrored: the image is flipped horizontally
// y-mirrored: the image is flipped vertically
// NOTE: this degrees/mirror mapping is tuned for pdf-lib draw-time correction (positive degrees =
// counter-clockwise, mirror applied to the page coordinate system). Do not assume it translates
// 1:1 to a pixel-manipulation library without verifying the rotation direction.
export function getOrientationCorrection(orientation: number): { degrees: number; mirrored?: 'x' | 'y' } {
  switch (orientation) {
    case 2:
      return { degrees: 0, mirrored: 'x' };
    case 3:
      return { degrees: -180 };
    case 4:
      return { degrees: 180, mirrored: 'x' };
    case 5:
      return { degrees: 90, mirrored: 'y' };
    case 6:
      return { degrees: -90 };
    case 7:
      return { degrees: -90, mirrored: 'y' };
    case 8:
      return { degrees: 90 };
    default:
      return { degrees: 0 };
  }
}
