// For now assuming timestamp will be in ISO format
export function getRelativeTime(timestamp: string): string {
  const now = new Date();
  const queuedDate = new Date(timestamp);

  const difference = now.getTime() - queuedDate.getTime();

  const minutes = Math.floor(difference / (60 * 1000));
  const hours = Math.floor(minutes / 60);

  if (hours > 0) return `${hours} hours`;
  return `${minutes} mins`;
}
