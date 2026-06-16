export const CLAIM_STATUS_COLORS: Record<string, 'warning' | 'info' | 'error' | 'success' | 'primary' | 'default'> = {
  open: 'warning',
  sent: 'info',
  denied: 'error',
  'partly-paid': 'success',
  locked: 'primary',
  'returned-billing': 'warning',
  'returned-coding': 'warning',
  'returned-credentialing-hold': 'warning',
  'credential-hold': 'warning',
};

export function formatAntCaseString(value?: string): string {
  if (!value) return '';
  return value
    .split('-')
    .map((substr) => substr.charAt(0).toUpperCase() + substr.slice(1))
    .join(' ');
}
