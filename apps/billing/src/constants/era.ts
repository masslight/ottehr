import {
  ERA_CLAIM_STATUS_CODE,
  ERA_CLAIM_STATUS_CODES,
  ERA_PAYMENT_METHODS,
  ERA_SOURCE,
  EraClaimStatusCode,
  EraSource,
} from 'utils/lib/types/data/billing/billing.constants';
import { ClaimRemitAdjustment } from 'utils/lib/types/data/billing/billing.types';
import { formatCurrency } from 'utils/lib/utils/convert';

// Human labels for CLP02 claim status codes the ERA can carry.
export const ERA_STATUS_LABELS: Record<EraClaimStatusCode, string> = {
  [ERA_CLAIM_STATUS_CODE.primary]: 'Primary',
  [ERA_CLAIM_STATUS_CODE.secondary]: 'Secondary',
  [ERA_CLAIM_STATUS_CODE.tertiary]: 'Tertiary',
  [ERA_CLAIM_STATUS_CODE.denied]: 'Denied',
  [ERA_CLAIM_STATUS_CODE.primaryForwarded]: 'Primary (forwarded)',
  [ERA_CLAIM_STATUS_CODE.secondaryForwarded]: 'Secondary (forwarded)',
  [ERA_CLAIM_STATUS_CODE.tertiaryForwarded]: 'Tertiary (forwarded)',
  [ERA_CLAIM_STATUS_CODE.reversal]: 'Reversal',
  [ERA_CLAIM_STATUS_CODE.notOurClaimForwarded]: 'Not our claim (forwarded)',
  [ERA_CLAIM_STATUS_CODE.predetermination]: 'Predetermination',
};

export const formatAdjustment = (adj: ClaimRemitAdjustment): string =>
  `${adj.groupCode}${adj.reasonCode ? `-${adj.reasonCode}` : ''} ${formatCurrency(adj.amount)}`;

// CLP02 choices for a claim keyed in from a paper remit, in code order.
export const ERA_STATUS_OPTIONS = ERA_CLAIM_STATUS_CODES.map((code) => ({ code, label: ERA_STATUS_LABELS[code] }));

export const ERA_SOURCE_LABELS: Record<EraSource, string> = {
  [ERA_SOURCE.manual]: 'Manual',
  [ERA_SOURCE.x12Import]: 'Imported X12/835',
  [ERA_SOURCE.clearingHouse]: 'Clearing House',
};

// BPR04 code -> label; codes outside the list (older ERAs) show as-is.
export const paymentMethodLabel = (code: string): string =>
  ERA_PAYMENT_METHODS.find((method) => method.code === code)?.label ?? code;
