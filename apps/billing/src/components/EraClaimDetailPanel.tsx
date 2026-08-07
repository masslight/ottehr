import {
  Box,
  Chip,
  Divider,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tooltip,
  Typography,
} from '@mui/material';
import { Fragment, ReactElement } from 'react';
import {
  carcDescription,
  ClaimRemitAdjustment,
  ERA_CLAIM_STATUS_CODE,
  EraClaimListItem,
  EraClaimRemit,
  EraRemitServiceLine,
  formatCurrency,
  X12_ADJUSTMENT_GROUP_LABELS,
} from 'utils';
import { ERA_STATUS_LABELS } from '../constants/era';
import { Meta } from '../pages/ClaimDetail';
import { otherColors } from '../themes/ottehr/colors';
import { formatDate } from '../utils/format';
import { thSx } from './ReadOnlySection';

// One CAS adjustment as a chip, with the group + CARC explanation in the tooltip.
export function AdjustmentChip({ adjustment }: { adjustment: ClaimRemitAdjustment }): ReactElement {
  const groupLabel = X12_ADJUSTMENT_GROUP_LABELS[adjustment.groupCode] ?? adjustment.groupCode;
  const reasonText = adjustment.reasonCode ? carcDescription(adjustment.reasonCode) ?? 'No description available' : '';
  const label = `${adjustment.groupCode}${adjustment.reasonCode ? `-${adjustment.reasonCode}` : ''} ${formatCurrency(
    adjustment.amount
  )}`;
  return (
    <Tooltip title={[groupLabel, reasonText].filter(Boolean).join(' — ')} arrow>
      <Chip label={label} variant="outlined" size="small" sx={{ borderRadius: '4px', fontSize: 12 }} />
    </Tooltip>
  );
}

const currencyOrDash = (value: number | null): string => (value === null ? '-' : formatCurrency(value));
// PR buckets are sums of CAS adjustments; 0 means the payer reported none in that bucket.
const bucketOrDash = (value: number): string => (value === 0 ? '-' : formatCurrency(value));

function ServiceLinesTable({ lines }: { lines: EraRemitServiceLine[] }): ReactElement {
  if (lines.length === 0) {
    return (
      <Typography variant="body2" color="text.secondary">
        No service line detail on this remit
      </Typography>
    );
  }
  return (
    <TableContainer>
      <Table size="small">
        <TableHead>
          <TableRow>
            <TableCell sx={thSx}>Date of Service</TableCell>
            <TableCell sx={thSx}>CPT Code</TableCell>
            <TableCell sx={thSx}>Modifiers</TableCell>
            <TableCell sx={thSx} align="right">
              Units
            </TableCell>
            <TableCell sx={thSx} align="right">
              Billed
            </TableCell>
            <TableCell sx={thSx} align="right">
              Allowed
            </TableCell>
            <TableCell sx={thSx} align="right">
              Deductible
            </TableCell>
            <TableCell sx={thSx} align="right">
              Coinsurance
            </TableCell>
            <TableCell sx={thSx} align="right">
              Copay
            </TableCell>
            <TableCell sx={thSx}>Adjustments</TableCell>
            <TableCell sx={thSx} align="right">
              Paid
            </TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {lines.map((line, idx) => (
            <TableRow key={line.itemSequence ?? `add-${idx}`}>
              {line.isClaimLevel ? (
                <TableCell colSpan={4} sx={{ fontStyle: 'italic', color: 'text.secondary' }}>
                  Claim-level adjustments
                </TableCell>
              ) : (
                <>
                  <TableCell>{formatDate(line.serviceDate) || '-'}</TableCell>
                  <TableCell>{line.cptCode || '-'}</TableCell>
                  <TableCell>{line.modifiers.join(', ') || '-'}</TableCell>
                  <TableCell align="right">{line.units ?? '-'}</TableCell>
                </>
              )}
              <TableCell align="right">{currencyOrDash(line.billed)}</TableCell>
              <TableCell align="right">{currencyOrDash(line.allowed)}</TableCell>
              <TableCell align="right">{bucketOrDash(line.deductible)}</TableCell>
              <TableCell align="right">{bucketOrDash(line.coinsurance)}</TableCell>
              <TableCell align="right">{bucketOrDash(line.copay)}</TableCell>
              <TableCell>
                {line.adjustments.length === 0 ? (
                  '-'
                ) : (
                  <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap sx={{ py: 0.25 }}>
                    {line.adjustments.map((adjustment, adjIdx) => (
                      <AdjustmentChip key={adjIdx} adjustment={adjustment} />
                    ))}
                  </Stack>
                )}
              </TableCell>
              <TableCell align="right">{formatCurrency(line.paid)}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  );
}

function RemitDetail({ remit, claim }: { remit: EraClaimRemit; claim: EraClaimListItem }): ReactElement {
  return (
    <Box>
      <Stack direction="row" spacing={1.5} alignItems="center" sx={{ mb: 1.5 }}>
        {remit.eraStatusCode && (
          <Chip
            label={ERA_STATUS_LABELS[remit.eraStatusCode]}
            color={remit.eraStatusCode === ERA_CLAIM_STATUS_CODE.denied ? 'error' : 'default'}
            variant="outlined"
            size="small"
            sx={{ borderRadius: '4px', fontSize: 12 }}
          />
        )}
        <Typography variant="body2" color="text.secondary">
          {[remit.outcome, formatDate(remit.created), remit.disposition].filter(Boolean).join(' · ')}
        </Typography>
      </Stack>

      <Stack direction="row" spacing={4} flexWrap="wrap" useFlexGap sx={{ mb: 1.5 }}>
        <Meta label="Patient account #" value={claim.patientAccountNumber} copyable />
        {remit.payerClaimControlNumber && (
          <Meta label="Payer claim control #" value={remit.payerClaimControlNumber} copyable />
        )}
        <Box>
          <Typography variant="caption" color="text.secondary">
            Patient responsibility
          </Typography>
          <Stack direction="row" spacing={0.5} alignItems="center" flexWrap="wrap" useFlexGap>
            <Typography variant="body2" fontWeight={500}>
              {currencyOrDash(remit.patientResp)}
            </Typography>
            {remit.patientRespAdjustments.map((adjustment, idx) => (
              <AdjustmentChip key={idx} adjustment={adjustment} />
            ))}
          </Stack>
        </Box>
        <Meta label="Insurance paid" value={formatCurrency(remit.paid)} />
      </Stack>

      <ServiceLinesTable lines={remit.serviceLines} />

      {remit.notes.length > 0 && (
        <Box sx={{ mt: 1.5 }}>
          <Typography variant="caption" color="text.secondary">
            Payer remarks
          </Typography>
          {remit.notes.map((note, idx) => (
            <Typography key={idx} variant="body2">
              {note}
            </Typography>
          ))}
        </Box>
      )}
    </Box>
  );
}

// Expanded-row content for one ERA claim: every remit (ClaimResponse) the ERA carries for it, each
// with its adjudicated service lines and coded adjustments.
export function EraClaimDetailPanel({ claim }: { claim: EraClaimListItem }): ReactElement {
  return (
    <Box sx={{ px: 3, py: 2, bgcolor: otherColors.formCardBg, borderBottom: `1px solid ${otherColors.lightDivider}` }}>
      {claim.remits.length === 0 ? (
        <Typography variant="body2" color="text.secondary">
          No remit detail available for this claim
        </Typography>
      ) : (
        claim.remits.map((remit, idx) => (
          <Fragment key={remit.claimResponseId || idx}>
            {idx > 0 && <Divider sx={{ my: 2 }} />}
            <RemitDetail remit={remit} claim={claim} />
          </Fragment>
        ))
      )}
    </Box>
  );
}
