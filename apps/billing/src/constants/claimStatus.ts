import { AR_STAGE } from 'utils';

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

export type ClaimStatusChipColor = 'warning' | 'info' | 'error' | 'success' | 'primary' | 'default';

// Semantic chip color for the new claim-status indicator values (AR Stage, Insurance Status, paid
// statuses, etc.). Codes are shared across fields where they mean the same thing (e.g. "finalized").
const CLAIM_STATUS_VALUE_COLORS: Record<string, ClaimStatusChipColor> = {
  // positive / complete
  'fully-paid': 'success',
  approved: 'success',
  finalized: 'success',
  // in progress
  submitted: 'info',
  adjudicated: 'info',
  invoiced: 'info',
  created: 'info',
  'ready-to-invoice': 'warning',
  'partially-paid': 'warning',
  // negative
  denied: 'error',
  rejected: 'error',
  // AR stage
  [AR_STAGE.insurancePayer]: 'info',
  [AR_STAGE.patient]: 'success',
  [AR_STAGE.nonInsurancePayer]: 'warning',
  // neutral defaults
  unpaid: 'default',
  'not-invoiced': 'default',
};

export function claimStatusValueColor(code: string): ClaimStatusChipColor {
  return CLAIM_STATUS_VALUE_COLORS[code] ?? 'default';
}
