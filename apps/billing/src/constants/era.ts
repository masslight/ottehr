import { ERA_CLAIM_STATUS_CODE, EraClaimStatusCode } from 'utils/lib/types/data/billing/billing.constants';
import { ClaimRemitAdjustment } from 'utils/lib/types/data/billing/billing.types';
import { carcDescription, X12_ADJUSTMENT_GROUP_LABELS } from 'utils/lib/types/data/billing/carc';
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

// CLP02 statuses a biller must not miss; the ERA screens show them in the error color
export const isAdverseRemitStatus = (statusCode: EraClaimStatusCode | ''): boolean =>
  statusCode === ERA_CLAIM_STATUS_CODE.denied || statusCode === ERA_CLAIM_STATUS_CODE.reversal;

// 'CO-45'; just the group when the payer sent no reason code
export const adjustmentCode = (adj: Pick<ClaimRemitAdjustment, 'groupCode' | 'reasonCode'>): string =>
  `${adj.groupCode}${adj.reasonCode ? `-${adj.reasonCode}` : ''}`;

export const formatAdjustment = (adj: ClaimRemitAdjustment): string =>
  `${adjustmentCode(adj)} ${formatCurrency(adj.amount)}`;

export const adjustmentDescription = (adjustment: ClaimRemitAdjustment): string => {
  const groupLabel = X12_ADJUSTMENT_GROUP_LABELS[adjustment.groupCode] ?? adjustment.groupCode;
  if (!adjustment.reasonCode) return groupLabel;
  return `${groupLabel} — ${carcDescription(adjustment.reasonCode) ?? 'No description available'}`;
};
