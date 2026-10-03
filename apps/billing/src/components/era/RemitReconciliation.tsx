import { Box, Chip, Stack, Tooltip, Typography } from '@mui/material';
import { ReactElement } from 'react';
import { formatCurrency } from 'utils/lib/utils/convert';
import { RemitReconciliation as Reconciliation } from '../../utils/manualEra';

function Amount({ label, cents }: { label: string; cents: number }): ReactElement {
  return (
    <Typography variant="body1" component="span">
      <Box component="span" sx={{ color: 'text.secondary' }}>
        {label}:{' '}
      </Box>
      <Box component="span" sx={{ fontWeight: 700 }}>
        {formatCurrency(cents / 100)}
      </Box>
    </Typography>
  );
}

// Whether what the claims say was paid adds up to the check: "Balanced", or how far off it is.
export function RemitBalanceChip({ differenceCents }: Pick<Reconciliation, 'differenceCents'>): ReactElement {
  if (differenceCents === 0) {
    return <Chip label="Balanced" color="success" variant="outlined" size="small" sx={{ borderRadius: '4px' }} />;
  }
  return (
    <Tooltip
      title={
        differenceCents > 0
          ? 'The check is more than the claims on this remit paid'
          : 'The claims on this remit paid more than the check'
      }
    >
      <Chip
        label={`Off by ${formatCurrency(Math.abs(differenceCents) / 100)}`}
        color="warning"
        variant="outlined"
        size="small"
        sx={{ borderRadius: '4px' }}
      />
    </Tooltip>
  );
}

// The bottom line of a keyed remit: does what the claims say was paid add up to the check?
export function RemitReconciliation({ reconciliation }: { reconciliation: Reconciliation }): ReactElement {
  const { checkAmountCents, claimsPaidCents, differenceCents } = reconciliation;
  return (
    <Stack
      direction="row"
      spacing={4}
      alignItems="center"
      flexWrap="wrap"
      useFlexGap
      data-testid="remit-reconciliation"
    >
      <Amount label="Check Amount" cents={checkAmountCents} />
      <Amount label="Claims Ins Paid" cents={claimsPaidCents} />
      <RemitBalanceChip differenceCents={differenceCents} />
    </Stack>
  );
}
