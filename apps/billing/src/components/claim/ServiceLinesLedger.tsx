import {
  KeyboardArrowDown as KeyboardArrowDownIcon,
  KeyboardArrowRight as KeyboardArrowRightIcon,
} from '@mui/icons-material';
import {
  Box,
  Collapse,
  Divider,
  IconButton,
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
import { ReactElement, ReactNode, useMemo, useState } from 'react';
import { ClaimDetailResponse } from 'utils/lib/types/data/billing/billing.types';
import { carcDescription, X12_ADJUSTMENT_GROUP_LABELS } from 'utils/lib/types/data/billing/carc';
import { formatCurrency } from 'utils/lib/utils/convert';
import { adjustmentCode, ERA_STATUS_LABELS, isAdverseRemitStatus } from '../../constants/era';
import { otherColors } from '../../themes/ottehr/colors';
import {
  adjustmentColumn,
  groupRemitLines,
  insurancePaidByDesignation,
  ledgerAmounts,
  LedgerColumn,
  RemitLineEntry,
} from '../../utils/claimRemits';
import { formatDate } from '../../utils/format';
import { AdjustmentChip, AmountChip, EraStatusChip } from '../EraChips';
import { thSx } from '../ReadOnlySection';
import { useRemitHighlightTarget } from './RemitHighlight';

type ServiceLine = ClaimDetailResponse['serviceLines'][number];

const PATIENT_RESP_COLUMNS: { key: Exclude<LedgerColumn, 'insuranceAdjustment'>; label: string }[] = [
  { key: 'deductible', label: 'Deductible' },
  { key: 'coinsurance', label: 'Co-ins' },
  { key: 'copay', label: 'Copay' },
  { key: 'otherPatientResp', label: 'Other PR' },
];

// Date, Type, Billed, Allowed, Ins adj, Ins paid, then the patient responsibility buckets
const LEDGER_COLUMN_COUNT = 6 + PATIENT_RESP_COLUMNS.length;

const ledgerThSx = { ...thSx, fontSize: 12, borderBottom: 'none' };
const ledgerRowSx = { '& > td': { borderBottom: 'none', py: 0.5 } };

const remitCardSx = {
  bgcolor: 'background.paper',
  color: 'text.primary',
  border: 1,
  borderColor: 'divider',
  borderRadius: 2,
  boxShadow: 3,
  p: 2,
  minWidth: 320,
  maxWidth: 440,
};

// The claim's service lines. Once an ERA is matched, each line also lists its transactions: the
// charge, then every remit's response to it with the CAS adjustments behind that response.
export function ServiceLinesTable({ claim }: { claim: ClaimDetailResponse }): ReactElement {
  const hasRemits = claim.remits.length > 0;
  const { byClaimLine, other } = useMemo(
    () =>
      groupRemitLines(
        claim.remits,
        claim.serviceLines.map((line) => line.sequence)
      ),
    [claim.remits, claim.serviceLines]
  );
  const institutional = claim.type === 'institutional';
  const columnCount = (institutional ? 9 : 8) + (hasRemits ? 1 : 0);
  // the charge is dated by when it was first sent to the payer
  const chargeDate = claim.firstSubmittedDate || claim.created;

  const dxCode = (sequence: number): string =>
    claim.diagnoses.find((dx) => dx.sequence === sequence)?.code ?? String(sequence);

  const lineCells = (line: ServiceLine): ReactElement => (
    <>
      <TableCell>{line.sequence}</TableCell>
      <TableCell>{line.serviceDate}</TableCell>
      <TableCell>{line.cptCode}</TableCell>
      <TableCell>{line.modifiers.join(', ') || '-'}</TableCell>
      <TableCell>{line.diagnosisPointers.map(dxCode).join(', ') || '-'}</TableCell>
      <TableCell>{line.placeOfService || '-'}</TableCell>
      {institutional && <TableCell>{line.revenueCode || '-'}</TableCell>}
      <TableCell>{line.units} UN</TableCell>
      <TableCell align="right">{formatCurrency(line.charges)}</TableCell>
    </>
  );

  return (
    <TableContainer>
      <Table size="small">
        <TableHead>
          <TableRow>
            {hasRemits && <TableCell sx={{ ...thSx, width: 40 }} />}
            <TableCell sx={thSx}>#</TableCell>
            <TableCell sx={thSx}>Date of Service</TableCell>
            <TableCell sx={thSx}>CPT Code</TableCell>
            <TableCell sx={thSx}>Modifiers</TableCell>
            <TableCell sx={thSx}>Dx</TableCell>
            <TableCell sx={thSx}>POS</TableCell>
            {institutional && <TableCell sx={thSx}>Rev Code</TableCell>}
            <TableCell sx={thSx}>Qty</TableCell>
            <TableCell sx={thSx} align="right">
              Billed
            </TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {claim.serviceLines.map((line) =>
            hasRemits ? (
              <ExpandableLedgerRows
                key={line.sequence}
                toggleLabel={`Toggle remit details for line ${line.sequence}`}
                columnCount={columnCount}
                summary={lineCells(line)}
                ledger={
                  <RemitLedger
                    label={`Remit details for line ${line.sequence}`}
                    charge={{ date: chargeDate, amount: line.charges }}
                    entries={byClaimLine.get(line.sequence) ?? []}
                    claimLineUnits={line.units}
                  />
                }
              />
            ) : (
              <TableRow key={line.sequence}>{lineCells(line)}</TableRow>
            )
          )}
          {hasRemits && other.length > 0 && (
            <ExpandableLedgerRows
              toggleLabel="Toggle claim-level and unmatched remit lines"
              columnCount={columnCount}
              summary={
                <TableCell colSpan={columnCount - 1}>
                  <Typography variant="body2" sx={{ fontStyle: 'italic', color: 'text.secondary' }}>
                    Claim-level &amp; unmatched remit lines
                  </Typography>
                </TableCell>
              }
              ledger={<RemitLedger label="Claim-level and unmatched remit lines" entries={other} />}
            />
          )}
        </TableBody>
      </Table>
    </TableContainer>
  );
}

function ExpandableLedgerRows({
  toggleLabel,
  columnCount,
  summary,
  ledger,
}: {
  toggleLabel: string;
  columnCount: number;
  summary: ReactNode;
  ledger: ReactNode;
}): ReactElement {
  const [expanded, setExpanded] = useState(true);
  return (
    <>
      <TableRow sx={{ '& > td': { borderBottom: 'none' } }}>
        <TableCell sx={{ width: 40, py: 0.5 }}>
          <IconButton
            size="small"
            onClick={() => setExpanded((prev) => !prev)}
            aria-expanded={expanded}
            aria-label={toggleLabel}
          >
            {expanded ? <KeyboardArrowDownIcon fontSize="small" /> : <KeyboardArrowRightIcon fontSize="small" />}
          </IconButton>
        </TableCell>
        {summary}
      </TableRow>
      <TableRow>
        <TableCell colSpan={columnCount} sx={{ py: 0 }}>
          <Collapse in={expanded} timeout="auto" unmountOnExit>
            {ledger}
          </Collapse>
        </TableCell>
      </TableRow>
    </>
  );
}

function RemitLedger({
  label,
  charge,
  entries,
  claimLineUnits,
}: {
  label: string;
  charge?: { date: string; amount: number };
  entries: RemitLineEntry[];
  claimLineUnits?: number;
}): ReactElement {
  return (
    <Box sx={{ my: 1, ml: 5, py: 0.5, bgcolor: otherColors.formCardBg, borderRadius: 1 }}>
      {/* fixed layout so every line's ledger lines its columns up with the others */}
      <Table size="small" aria-label={label} sx={{ tableLayout: 'fixed' }}>
        <TableHead>
          <TableRow>
            <TableCell sx={{ ...ledgerThSx, width: 110 }}>Date</TableCell>
            <TableCell sx={{ ...ledgerThSx, width: '26%' }}>Type</TableCell>
            <TableCell sx={ledgerThSx} align="right">
              Billed
            </TableCell>
            <TableCell sx={ledgerThSx} align="right">
              Allowed
            </TableCell>
            <TableCell sx={ledgerThSx} align="right">
              Ins adj
            </TableCell>
            <TableCell sx={ledgerThSx} align="right">
              Ins paid
            </TableCell>
            {PATIENT_RESP_COLUMNS.map(({ key, label: columnLabel }) => (
              <TableCell key={key} sx={ledgerThSx} align="right">
                {columnLabel}
              </TableCell>
            ))}
          </TableRow>
        </TableHead>
        {charge && (
          <TableBody>
            <TableRow sx={ledgerRowSx}>
              <TableCell>{formatDate(charge.date) || '-'}</TableCell>
              <TableCell>Charge</TableCell>
              <TableCell align="right">{formatCurrency(charge.amount)}</TableCell>
              <TableCell colSpan={LEDGER_COLUMN_COUNT - 3} />
            </TableRow>
          </TableBody>
        )}
        {entries.map((entry) => (
          <LedgerGroup key={entry.key} entry={entry} claimLineUnits={claimLineUnits} />
        ))}
        {entries.length === 0 && (
          <TableBody>
            <TableRow sx={ledgerRowSx}>
              <TableCell colSpan={LEDGER_COLUMN_COUNT}>
                <Typography variant="body2" color="text.secondary">
                  No remit detail for this line
                </Typography>
              </TableCell>
            </TableRow>
          </TableBody>
        )}
      </Table>
    </Box>
  );
}

function PatientRespAmount({ amount }: { amount: number }): ReactElement {
  return (
    <Typography
      variant="body2"
      component="span"
      sx={amount !== 0 ? { color: 'warning.main', fontWeight: 600 } : undefined}
    >
      {formatCurrency(amount)}
    </Typography>
  );
}

// One remit's response to a line and the adjustments behind it. Hovering (or focusing) it opens the
// line's card and lights up its remit and check further down the page.
function LedgerGroup({ entry, claimLineUnits }: { entry: RemitLineEntry; claimLineUnits?: number }): ReactElement {
  const { remit, line } = entry;
  const { open, onOpen, onClose } = useRemitHighlightTarget({
    key: entry.key,
    claimResponseId: remit.claimResponseId,
    paymentReconciliationId: remit.paymentReconciliationId,
  });
  const amounts = ledgerAmounts(line.adjustments);
  const date = formatDate(remit.date) || '-';

  return (
    <Tooltip
      open={open}
      onOpen={onOpen}
      onClose={onClose}
      title={<RemitLineCard entry={entry} claimLineUnits={claimLineUnits} />}
      describeChild
      disableInteractive
      enterDelay={150}
      placement="bottom-start"
      slotProps={{ tooltip: { sx: remitCardSx } }}
    >
      <TableBody tabIndex={0} sx={{ bgcolor: open ? 'action.hover' : undefined }}>
        <TableRow sx={ledgerRowSx}>
          <TableCell>{date}</TableCell>
          <TableCell>
            <Stack direction="row" spacing={1} alignItems="center">
              <Typography variant="body2" fontWeight={600} noWrap sx={{ maxWidth: 220 }}>
                {remit.payerName || 'Unknown payer'}
              </Typography>
              {remit.eraStatusCode && isAdverseRemitStatus(remit.eraStatusCode) && (
                <EraStatusChip statusCode={remit.eraStatusCode} />
              )}
            </Stack>
          </TableCell>
          <TableCell align="right">{line.billed === null ? '-' : formatCurrency(line.billed)}</TableCell>
          <TableCell align="right">
            {line.allowed === null ? '-' : <AmountChip label={formatCurrency(line.allowed)} color="success" />}
          </TableCell>
          <TableCell align="right">{formatCurrency(amounts.insuranceAdjustment)}</TableCell>
          <TableCell align="right">
            <AmountChip label={formatCurrency(line.paid)} color="primary" />
          </TableCell>
          {PATIENT_RESP_COLUMNS.map(({ key }) => (
            <TableCell key={key} align="right">
              <PatientRespAmount amount={amounts[key]} />
            </TableCell>
          ))}
        </TableRow>
        {line.adjustments.map((adjustment, index) => {
          const column = adjustmentColumn(adjustment);
          const amountIn = (key: LedgerColumn): string => (column === key ? formatCurrency(adjustment.amount) : '');
          return (
            <TableRow key={index} sx={ledgerRowSx}>
              <TableCell>{date}</TableCell>
              <TableCell>
                <AdjustmentChip groupCode={adjustment.groupCode} label={adjustmentCode(adjustment)} />
              </TableCell>
              <TableCell />
              <TableCell />
              <TableCell align="right">{amountIn('insuranceAdjustment')}</TableCell>
              <TableCell />
              {PATIENT_RESP_COLUMNS.map(({ key }) => (
                <TableCell key={key} align="right">
                  {amountIn(key)}
                </TableCell>
              ))}
            </TableRow>
          );
        })}
      </TableBody>
    </Tooltip>
  );
}

function RemitLineCard({ entry, claimLineUnits }: { entry: RemitLineEntry; claimLineUnits?: number }): ReactElement {
  const { remit, line } = entry;
  const reportedUnits =
    line.units !== null && claimLineUnits !== undefined && line.units !== claimLineUnits ? line.units : null;

  return (
    <Stack spacing={1.25} divider={<Divider flexItem />}>
      <Box>
        <Typography variant="subtitle1" fontWeight={700} lineHeight={1.3}>
          {remit.payerName || 'Unknown payer'}
        </Typography>
        {remit.eraStatusCode && (
          <Typography variant="body2" color="text.secondary">
            {ERA_STATUS_LABELS[remit.eraStatusCode]}
          </Typography>
        )}
      </Box>
      {line.adjustments.length > 0 ? (
        <Stack spacing={1}>
          {line.adjustments.map((adjustment, index) => (
            <Stack key={index} direction="row" spacing={1.5} alignItems="center">
              <AdjustmentChip groupCode={adjustment.groupCode} label={adjustmentCode(adjustment)} />
              <Typography variant="body2" noWrap sx={{ flex: 1, minWidth: 0 }}>
                {carcDescription(adjustment.reasonCode) ??
                  X12_ADJUSTMENT_GROUP_LABELS[adjustment.groupCode] ??
                  adjustment.groupCode}
              </Typography>
              <Typography variant="body2" fontWeight={700}>
                {formatCurrency(adjustment.amount)}
              </Typography>
            </Stack>
          ))}
        </Stack>
      ) : (
        <Typography variant="body2" color="text.secondary">
          No adjustments
        </Typography>
      )}
      <Stack direction="row" spacing={1} alignItems="baseline">
        <Typography variant="body2" fontWeight={700}>
          Check
        </Typography>
        <Typography variant="body2" sx={{ flex: 1 }}>
          {remit.checkNumber || '-'}
        </Typography>
        <Typography variant="body2" color="text.secondary">
          {formatDate(remit.checkDate)}
        </Typography>
      </Stack>
      <Box>
        <Typography variant="body2" color="text.secondary">
          Remit date {formatDate(remit.date) || '-'}
        </Typography>
        {line.isClaimLevel ? (
          <Typography variant="body2" color="text.secondary">
            Claim-level adjustment
          </Typography>
        ) : (
          line.cptCode && (
            <Typography variant="body2" color="text.secondary">
              Adjudicated as {line.cptCode}
              {reportedUnits !== null && ` (${reportedUnits} UN)`}
            </Typography>
          )
        )}
      </Box>
    </Stack>
  );
}

// The claim's money once a payer has adjudicated it. Insurance paid is split by the payer rank each
// remit was processed as; the rest are the same claim totals as the header.
export function RemitTotals({ claim }: { claim: ClaimDetailResponse }): ReactElement {
  const insurancePaid = useMemo(() => insurancePaidByDesignation(claim.remits), [claim.remits]);
  return (
    <Box
      role="group"
      aria-label="Remit totals"
      sx={{
        mt: 2,
        px: 2,
        py: 1.5,
        bgcolor: otherColors.formCardBg,
        borderRadius: 2,
        display: 'flex',
        gap: 4,
        flexWrap: 'wrap',
        alignItems: 'flex-end',
      }}
    >
      <Total label="Allowed" value={formatCurrency(claim.allowed)} />
      <Total
        label="Ins Paid"
        value={
          <Stack direction="row" spacing={2} alignItems="center" flexWrap="wrap" useFlexGap>
            {insurancePaid.map(({ designation, amount }) => (
              <Stack key={designation} direction="row" spacing={1} alignItems="center">
                <AmountChip label={designation} color="primary" />
                <Typography variant="body1" fontWeight={700}>
                  {formatCurrency(amount)}
                </Typography>
              </Stack>
            ))}
          </Stack>
        }
      />
      <Total label="Patient Resp" value={formatCurrency(claim.patientResp)} />
      <Total label="Patient Paid" value={formatCurrency(claim.patientPaid)} />
      <Total label="Balance" value={formatCurrency(claim.balance)} />
    </Box>
  );
}

function Total({ label, value }: { label: string; value: ReactNode }): ReactElement {
  return (
    <Box>
      <Typography variant="caption" color="text.secondary" display="block">
        {label}
      </Typography>
      {typeof value === 'string' ? (
        <Typography variant="body1" fontWeight={700}>
          {value}
        </Typography>
      ) : (
        value
      )}
    </Box>
  );
}
