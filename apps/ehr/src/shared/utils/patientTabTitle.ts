export function formatPatientTabTitle(fullName?: string, room?: string): string | undefined {
  if (!fullName) {
    return undefined;
  }
  return room ? `${fullName} (${room})` : fullName;
}
