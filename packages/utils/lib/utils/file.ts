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
  TXT: 'text/plain',
} as const;

export type MimeType = (typeof MIME_TYPES)[keyof typeof MIME_TYPES];

const extensionToMime: Record<string, MimeType> = {
  pdf: MIME_TYPES.PDF,
  jpg: MIME_TYPES.JPEG,
  jpeg: MIME_TYPES.JPEG,
  png: MIME_TYPES.PNG,
  gif: MIME_TYPES.GIF,
  webp: MIME_TYPES.WEBP,
};

export function getMimeType(fileName: string): MimeType | undefined {
  const ext = fileName.split('.').pop()?.toLowerCase() ?? '';
  return extensionToMime[ext];
}
