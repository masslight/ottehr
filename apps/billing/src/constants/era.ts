import { ClaimRemitAdjustment, ERA_CLAIM_STATUS_CODE, EraClaimStatusCode, formatCurrency } from 'utils';

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
