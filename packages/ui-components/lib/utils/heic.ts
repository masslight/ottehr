/**
 * Convert a HEIC/HEIF image to JPEG so all browsers (including non-Safari) can display it.
 * Non-HEIC files are returned unchanged. Imports heic-to lazily so the lib is only loaded when needed.
 *
 * Uses `heic-to` rather than `heic2any`: the latter is unmaintained and bundles an old libheif
 * that fails on many real-world iPhone/Android files with "ERR_LIBHEIF format not supported".
 */
export const convertHeicToJpegIfNeeded = async (file: File): Promise<File> => {
  const { heicTo, isHeic } = await import('heic-to');
  // isHeic inspects the file's contents, which is more reliable than extension/MIME sniffing
  // (browsers frequently report an empty file.type for HEIC).
  if (!(await isHeic(file))) return file;
  const blob = await heicTo({ blob: file, type: 'image/jpeg', quality: 0.92 });
  const newName = file.name.replace(/\.(heic|heif)$/i, '.jpg');
  return new File([blob], newName, { type: 'image/jpeg', lastModified: Date.now() });
};
