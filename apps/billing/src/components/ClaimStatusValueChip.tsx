import { Chip } from '@mui/material';
import { ReactElement } from 'react';
import { ClaimStatusFieldDef, formatClaimStatusValue } from 'utils/lib/types/data/billing/claim-status';
import { claimStatusValueColor } from '../constants/claimStatus';

export function ClaimStatusValueChip({
  field,
  code,
}: {
  field: ClaimStatusFieldDef;
  code: string;
}): ReactElement | null {
  if (!code) return null;
  return (
    <Chip
      label={formatClaimStatusValue(field, code)}
      color={claimStatusValueColor(code)}
      variant="outlined"
      size="small"
      sx={{
        borderRadius: '4px',
        fontSize: 12,
      }}
    />
  );
}
