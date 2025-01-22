export function getFileTypeFromFile(file: string): string {
  const items = file.split('.');
  return items[items.length - 1];
}
