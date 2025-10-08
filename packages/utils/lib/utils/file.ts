export function parseFiletype(fileUrl: string): string {
  const filetype = fileUrl.match(/\w+$/)?.[0];
  if (filetype) {
    return filetype;
  } else {
    throw new Error(`Failed to parse filetype from url ${fileUrl}`);
  }
}

export const mimeTypes: Record<string, string> = {
  pdf: 'application/pdf',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  gif: 'image/gif',
  webp: 'image/webp',
};
