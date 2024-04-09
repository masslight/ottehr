export function parseFiletype(fileUrl: string): string {
  const filetype = fileUrl.match(/\w+$/)?.[0];
  if (filetype) {
    return filetype;
  } else {
    throw new Error('Failed to parse filetype from url');
  }
}
