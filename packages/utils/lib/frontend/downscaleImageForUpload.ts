/**
 * Longest allowed side (px) of an uploaded card image; anything larger is downscaled in the browser
 * before upload. Mirrors MAX_DIMENSION in the server-side normalizer
 * (packages/zambdas/src/subscriptions/document-reference/extract-insurance-card/normalize-image.ts,
 * not importable from the frontend) — keep the two values in sync.
 */
export const UPLOAD_IMAGE_MAX_DIMENSION = 2000;

/** JPEG quality for the client-side re-encode (canvas.toBlob's 0-1 scale). */
export const UPLOAD_IMAGE_JPEG_QUALITY = 0.9;

interface DecodedImage {
  source: CanvasImageSource;
  width: number;
  height: number;
  close: () => void;
}

/**
 * Decodes an image blob with its EXIF orientation applied, so a phone photo drawn to a canvas comes
 * out upright. Prefers createImageBitmap (imageOrientation: 'from-image' bakes the EXIF rotation);
 * falls back to an <img> decode — which browsers also EXIF-orient by default — when
 * createImageBitmap is unavailable or rejects. Throws when the blob is not a decodable image.
 */
async function decodeImage(blob: Blob): Promise<DecodedImage> {
  if (typeof createImageBitmap === 'function') {
    try {
      const bitmap = await createImageBitmap(blob, { imageOrientation: 'from-image' });
      return { source: bitmap, width: bitmap.width, height: bitmap.height, close: () => bitmap.close() };
    } catch {
      // fall through to the <img> path (e.g. older Safari rejecting the options bag)
    }
  }
  const url = URL.createObjectURL(blob);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    return { source: img, width: img.naturalWidth, height: img.naturalHeight, close: () => undefined };
  } finally {
    // decode() already rasterized the image, so the object URL can be released before drawing
    URL.revokeObjectURL(url);
  }
}

export async function downscaleImageForUpload(file: File): Promise<File>;
export async function downscaleImageForUpload(file: Blob): Promise<Blob>;
/**
 * Shrinks an oversized raster image in the browser before upload: when the longest side exceeds
 * UPLOAD_IMAGE_MAX_DIMENSION it is drawn to a canvas at the capped size (aspect preserved, EXIF
 * orientation applied — see decodeImage) and re-encoded as JPEG. Images already within the cap,
 * PDFs, and any non-image input are returned untouched. A File in yields a File out (renamed .jpg
 * when re-encoded).
 *
 * Fail-safe: any decode/encode failure logs a warning and returns the ORIGINAL file — a failed
 * downscale must never block or drop the upload (the server-side normalizer re-caps it anyway).
 */
export async function downscaleImageForUpload(file: File | Blob): Promise<File | Blob> {
  // Only raster images can be drawn to a canvas; pass PDFs and anything else through untouched.
  if (!file.type.startsWith('image/')) {
    return file;
  }

  try {
    const decoded = await decodeImage(file);
    try {
      const { width, height } = decoded;
      const longestSide = Math.max(width, height);
      if (longestSide <= UPLOAD_IMAGE_MAX_DIMENSION) {
        return file;
      }

      const scale = UPLOAD_IMAGE_MAX_DIMENSION / longestSide;
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round(width * scale));
      canvas.height = Math.max(1, Math.round(height * scale));
      const context = canvas.getContext('2d');
      if (!context) {
        console.warn('downscaleImageForUpload: no 2d canvas context; uploading the original image');
        return file;
      }
      // JPEG has no alpha channel; flatten any PNG transparency onto white instead of black
      context.fillStyle = '#ffffff';
      context.fillRect(0, 0, canvas.width, canvas.height);
      context.drawImage(decoded.source, 0, 0, canvas.width, canvas.height);

      const encoded = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob(resolve, 'image/jpeg', UPLOAD_IMAGE_JPEG_QUALITY)
      );
      if (!encoded) {
        console.warn('downscaleImageForUpload: canvas.toBlob returned null; uploading the original image');
        return file;
      }

      if (file instanceof File) {
        const newName = file.name.replace(/\.[^./\\]+$/, '') + '.jpg';
        return new File([encoded], newName, { type: 'image/jpeg', lastModified: Date.now() });
      }
      return encoded;
    } finally {
      decoded.close();
    }
  } catch (error) {
    console.warn('downscaleImageForUpload: falling back to the original image', error);
    return file;
  }
}
