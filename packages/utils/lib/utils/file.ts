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

/**
 * Detects a file's real format from its leading bytes (PDF header, PNG signature, JPEG SOI).
 * Returns undefined for anything else.
 *
 * A declared contentType is only ever as good as whatever produced it: the browser derives
 * File.type from the file extension, and our own attachment metadata is derived from the extension
 * of the stored z3 object name (see getMimeType). A JPEG saved as "card.png" therefore travels all
 * the way to FHIR labelled image/png. Anything that has to DECODE the bytes (embedding an image in
 * a PDF, re-encoding) must go by the bytes instead of the label.
 */
export function detectMimeTypeFromBytes(bytes: Uint8Array): MimeType | undefined {
  // The PDF header may legally appear after a short binary preamble, but must be within the first 1024 bytes.
  const pdfHeaderEnd = Math.min(bytes.length - 3, 1024);
  for (let index = 0; index < pdfHeaderEnd; index++) {
    if (bytes[index] === 0x25 && bytes[index + 1] === 0x50 && bytes[index + 2] === 0x44 && bytes[index + 3] === 0x46) {
      return MIME_TYPES.PDF;
    }
  }
  if (
    bytes.length >= 8 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47 &&
    bytes[4] === 0x0d &&
    bytes[5] === 0x0a &&
    bytes[6] === 0x1a &&
    bytes[7] === 0x0a
  ) {
    return MIME_TYPES.PNG;
  }
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return MIME_TYPES.JPEG;
  }
  return undefined;
}

/**
 * Formats a fax packet can render. Anything else (zip archives, XML, HEIC, …) is left out, so the
 * EHR and the fax builder agree on which documents offer a "Send Fax" action.
 */
export const FAXABLE_MIME_TYPES: string[] = [MIME_TYPES.PDF, MIME_TYPES.PNG, MIME_TYPES.JPEG, MIME_TYPES.JPG];

/** Attachments don't always carry a contentType; fall back to the file extension of the URL. */
export const isFaxableAttachment = (attachment: { url?: string; contentType?: string }): boolean => {
  const mimeType = attachment.contentType ?? (attachment.url ? getMimeType(attachment.url) : undefined);
  return FAXABLE_MIME_TYPES.includes(mimeType ?? '');
};

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
