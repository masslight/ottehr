import { Chip } from '@mui/material';
import { ReactElement } from 'react';
import {
  EraClaimStatusCode,
  X12_ADJUSTMENT_GROUP_CODE,
  X12AdjustmentGroupCode,
} from 'utils/lib/types/data/billing/billing.constants';
import { ERA_STATUS_LABELS, isAdverseRemitStatus } from '../constants/era';

// The chip styling and colors the ERA screens share, so remit money and adjustments read the same
// wherever they appear.
const chipSx = { borderRadius: '4px', fontSize: 12 };

export type EraChipColor = 'success' | 'primary' | 'warning' | 'error' | 'default';

// Allowed in success, paid in primary, patient responsibility in warning.
export function AmountChip({ label, color }: { label: string; color: EraChipColor }): ReactElement {
  return <Chip label={label} color={color} variant="outlined" size="small" sx={chipSx} />;
}

// A CAS adjustment, in warning when the patient owes it.
export function AdjustmentChip({
  groupCode,
  label,
}: {
  groupCode: X12AdjustmentGroupCode;
  label: string;
}): ReactElement {
  return (
    <AmountChip
      label={label}
      color={groupCode === X12_ADJUSTMENT_GROUP_CODE.patientResponsibility ? 'warning' : 'default'}
    />
  );
}

// The CLP02 status the payer processed the claim under, in error when it's a denial or reversal.
export function EraStatusChip({ statusCode }: { statusCode: EraClaimStatusCode }): ReactElement {
  return (
    <AmountChip label={ERA_STATUS_LABELS[statusCode]} color={isAdverseRemitStatus(statusCode) ? 'error' : 'default'} />
  );
}
