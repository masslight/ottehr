export function parseFiletype(fileUrl: string): string {
  const filetype = fileUrl.match(/\w+$/)?.[0];
  if (filetype) {
    return filetype;
  } else {
    throw new Error(`Failed to parse filetype from url ${fileUrl}`);
  }
}

export const MIME_TYPES = {
  PDF: 'application/pdf',
  JPEG: 'image/jpeg',
  JPG: 'image/jpg',
  PNG: 'image/png',
  GIF: 'image/gif',
  WEBP: 'image/webp',
  HEIC: 'image/heic',
  HEIF: 'image/heif',
  TXT: 'text/plain',
  XML: 'application/xml',
  ZIP: 'application/zip',
} as const;

export type MimeType = (typeof MIME_TYPES)[keyof typeof MIME_TYPES];

const extensionToMime: Record<string, MimeType> = {
  pdf: MIME_TYPES.PDF,
  jpg: MIME_TYPES.JPEG,
  jpeg: MIME_TYPES.JPEG,
  png: MIME_TYPES.PNG,
  gif: MIME_TYPES.GIF,
  webp: MIME_TYPES.WEBP,
  xml: MIME_TYPES.XML,
  heic: MIME_TYPES.HEIC,
  heif: MIME_TYPES.HEIF,
  zip: MIME_TYPES.ZIP,
};

export function getMimeType(fileName: string): MimeType | undefined {
  const ext = fileName.split('.').pop()?.toLowerCase() ?? '';
  return extensionToMime[ext];
}

// Replaces characters not allowed in a Z3 object name (notably spaces) with an underscore.
export const sanitizeFileNameForZ3 = (fileName: string): string => fileName.replace(/[^a-zA-Z0-9+!\-_'()\\.@$]/g, '_');

// Returns the final path segment (file name) of a URL, or undefined if absent or unparseable.
export const getFileNameFromUrl = (url: string | undefined): string | undefined => {
  if (!url) return undefined;
  try {
    return new URL(url).pathname.split('/').pop() || undefined;
  } catch {
    return undefined;
  }
};
