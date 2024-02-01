// For now assuming timestamp will be in ISO format
export function getRelativeTime(timestamp: string): string {
  const now = new Date();
  const queuedDate = new Date(timestamp);

  if (isNaN(now.getTime()) || isNaN(queuedDate.getTime())) {
    // Handle invalid input - for now return invalid time
    return 'Invalid time';
  }

  const difference = now.getTime() - queuedDate.getTime();

  const minutes = Math.floor(difference / (60 * 1000));
  const hours = Math.floor(minutes / 60);

  if (hours < 0 || minutes < 0 || minutes >= 60) {
    // Handle invalid input - for now return invalid time
    return 'Invalid time';
  }

  const formattedHours = hours === 1 ? '1 hour' : hours > 1 ? `${hours} hours` : '';
  const formattedMinutes = minutes === 1 ? '1 minute' : minutes > 1 ? `${minutes} minutes` : '';

  if (formattedHours && formattedMinutes) {
    return `${formattedHours} and ${formattedMinutes}`;
  } else {
    return formattedHours || formattedMinutes || '0 minutes';
  }
}
