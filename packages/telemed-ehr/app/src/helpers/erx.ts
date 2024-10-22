export function isErxEnabled(): boolean {
  return !isBlank(import.meta.env.VITE_APP_PHOTON_CLIENT_ID) && !isBlank(import.meta.env.VITE_APP_PHOTON_ORG_ID);
}

function isBlank(str?: string): boolean {
  return !str || /^\s*$/.test(str);
}
