export function formatPatientTabTitle(fullName?: string, room?: string): string | undefined {
  if (!fullName) {
    return undefined;
  }
  return room ? `${fullName} (${room})` : fullName;
}

export const DEFAULT_TAB_TITLE = import.meta.env.VITE_APP_NAME;
