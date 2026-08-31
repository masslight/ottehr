export const parseFileExtension = (fileUrl?: string): string | undefined => {
  if (!fileUrl) return;
  const filetype = fileUrl.match(/\w+$/)?.[0];
  return filetype;
};

export const stripFileExtension = (fileName: string): string => {
  const lastDot = fileName.lastIndexOf('.');
  if (lastDot <= 0) return fileName;
  return fileName.substring(0, lastDot);
};
