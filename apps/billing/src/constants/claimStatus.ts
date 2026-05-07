export const CLAIM_STATUS_COLORS: Record<string, 'warning' | 'info' | 'error' | 'success' | 'primary' | 'default'> = {
  open: 'warning',
  sent: 'info',
  denied: 'error',
  'partly-paid': 'success',
  locked: 'primary',
  'returned-billing': 'warning',
  'returned-coding': 'warning',
};

export function formatClaimStatus(status: string): string {
  if (!status) return '';
  return status.charAt(0).toUpperCase() + status.slice(1).replace(/-/g, ' ');
}
