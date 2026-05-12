const HEIC_MIME_TYPES = ['image/heic', 'image/heif'];
const HEIC_EXTENSIONS = ['heic', 'heif'];

const isHeicFile = (file: File): boolean => {
  if (file.type && HEIC_MIME_TYPES.includes(file.type.toLowerCase())) return true;
  const ext = file.name.split('.').pop()?.toLowerCase();
  return ext ? HEIC_EXTENSIONS.includes(ext) : false;
};

/**
 * Convert a HEIC/HEIF image to JPEG so all browsers (including non-Safari) can display it.
 * Non-HEIC files are returned unchanged. Imports heic2any lazily so the lib is only loaded when needed.
 */
export const convertHeicToJpegIfNeeded = async (file: File): Promise<File> => {
  if (!isHeicFile(file)) return file;
  const { default: heic2any } = await import('heic2any');
  const converted = await heic2any({ blob: file, toType: 'image/jpeg', quality: 0.92 });
  const blob = Array.isArray(converted) ? converted[0] : converted;
  const newName = file.name.replace(/\.(heic|heif)$/i, '.jpg');
  return new File([blob], newName, { type: 'image/jpeg', lastModified: Date.now() });
};
