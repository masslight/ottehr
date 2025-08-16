export const parseFileExtension = (fileUrl?: string): string | undefined => {
  if (!fileUrl) return;
  const filetype = fileUrl.match(/\w+$/)?.[0];
  return filetype;
};
