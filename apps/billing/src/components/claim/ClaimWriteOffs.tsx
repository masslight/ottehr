import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  InputAdornment,
  InputLabel,
  MenuItem,
  Select,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from '@mui/material';
import { DateTime } from 'luxon';
import { enqueueSnackbar } from 'notistack';
import { ReactElement, useMemo, useState } from 'react';
import { X12_ADJUSTMENT_GROUP_CODE } from 'utils/lib/types/data/billing/billing.constants';
import { ClaimDetailResponse } from 'utils/lib/types/data/billing/billing.types';
import { AR_STAGE, ArStageCode } from 'utils/lib/types/data/billing/claim-status';
import { formatCurrency } from 'utils/lib/utils/convert';
import { formatDate } from '../../utils/format';
import { DateInput } from '../DateInput';
import { ReadOnlySection, thSx } from '../ReadOnlySection';

export type WriteOffResponsibleParty = 'Patient' | 'Insurance' | 'Non-insurance';

// Maps the claim's AR stage to the default "Write-off for" party.
const AR_STAGE_PARTY: Record<ArStageCode, WriteOffResponsibleParty> = {
  [AR_STAGE.insurancePayer]: 'Insurance',
  [AR_STAGE.patient]: 'Patient',
  [AR_STAGE.nonInsurancePayer]: 'Non-insurance',
};

const round2 = (n: number): number => Math.round(n * 100) / 100;

// Reasons for insurance and non-insurance write-offs ("Other" stays last).
export const INSURANCE_WRITE_OFF_REASONS = [
  'Administrative Write Off',
  'Bundled or Inclusive',
  'Case Rate or Capitated',
  'Contractual Adjustment',
  'Credentialing or Contracting',
  'Efforts Exhausted',
  'Friends & Family Discount Adjustment',
  'Interest',
  'No Authorization Referral',
  'Non Covered Max Benefit',
  'Not Medically Necessary',
  'Out-of-Network Write Off',
  'Primary Paid Max Benefits',
  'Small Balance',
  'Stale Date',
  'Timely Filing',
  'Timely Filing Late Encounter',
  'Uncollectible or Non Billable',
  'Other',
] as const;

// Reasons for patient write-offs ("Other" stays last).
export const PATIENT_WRITE_OFF_REASONS = [
  'Bad Debt',
  'Bankruptcy',
  'Charity or Financial Assistance',
  'Collection Agency',
  'Deceased',
  'Friends & Family Discount Adjustment',
  'Out-of-Network Courtesy Adjustment',
  'Patient Experience or Service Recovery',
  'Prompt Pay Discount',
  'Small Balance',
  'Uncollectible or Non Billable',
  'Other',
] as const;

export interface WriteOffAllocation {
  cptCode: string;
  amount: number;
}

export interface ClaimWriteOff {
  id: string;
  responsibleParty: WriteOffResponsibleParty;
  // "Primary — Aetna" / non-insurance payer name / '' for patient
  payerLabel: string;
  reason: string;
  allocations: WriteOffAllocation[];
  note: string;
  date: string;
}

interface InsuranceOption {
  key: string;
  label: string;
}

function insuranceOptions(claim: ClaimDetailResponse): InsuranceOption[] {
  const options: InsuranceOption[] = [];
  if (claim.coverageFhirId) options.push({ key: 'primary', label: `Primary — ${claim.payerName}` });
  if (claim.secondaryCoverageFhirId)
    options.push({ key: 'secondary', label: `Secondary — ${claim.secondaryPayerName}` });
  if (claim.tertiaryCoverageFhirId) options.push({ key: 'tertiary', label: `Tertiary — ${claim.tertiaryPayerName}` });
  return options;
}

// Per-line money snapshot the dialog edits against.
export interface WriteOffLine {
  cptCode: string;
  billed: number;
  // billed minus the remits' non-PR adjustments (CO/OA/PI) — what's actually receivable
  adjusted: number;
  insurancePaid: number;
  patientPaid: number;
  balance: number;
}

function WriteOffDialog({
  claim,
  lines,
  remainingBalance,
  onClose,
  onSave,
}: {
  claim: ClaimDetailResponse;
  lines: WriteOffLine[];
  remainingBalance: number;
  onClose: () => void;
  onSave: (writeOff: Omit<ClaimWriteOff, 'id'>) => void;
}): ReactElement {
  const insurances = insuranceOptions(claim);
  const claimArStage = (Object.values(AR_STAGE) as string[]).includes(claim.statuses.arStage)
    ? (claim.statuses.arStage as ArStageCode)
    : AR_STAGE.insurancePayer;
  const [party, setParty] = useState<WriteOffResponsibleParty>(AR_STAGE_PARTY[claimArStage]);
  const [insuranceKey, setInsuranceKey] = useState(insurances[0]?.key ?? '');
  const [nonInsurancePayer, setNonInsurancePayer] = useState(claim.nonInsurancePayerName);
  const [reason, setReason] = useState('');
  const [note, setNote] = useState('');
  const [date, setDate] = useState(DateTime.now().toISODate());
  // Single write-off amount; defaults to the sum of the line balances.
  const [total, setTotal] = useState(() => String(round2(lines.reduce((s, l) => s + l.balance, 0))));

  const reasons = party === 'Patient' ? PATIENT_WRITE_OFF_REASONS : INSURANCE_WRITE_OFF_REASONS;
  const totalAmount = Number(total) || 0;

  // Split proportionally to line balances for display (equal when all balances are zero);
  // the last line absorbs rounding drift so the shares add up to the total exactly.
  const anyBalance = lines.some((l) => l.balance > 0);
  const weights = lines.map((l) => (anyBalance ? l.balance : 1));
  const weightSum = weights.reduce((s, w) => s + w, 0);
  let allocated = 0;
  const shares = lines.map((_, i) => {
    const share =
      i === lines.length - 1
        ? Math.max(0, round2(totalAmount - allocated))
        : round2((totalAmount * weights[i]) / weightSum);
    allocated = round2(allocated + share);
    return share;
  });

  const overBalance = totalAmount > remainingBalance + 0.005;
  const payerSelected = party === 'Patient' || (party === 'Insurance' ? !!insuranceKey : !!nonInsurancePayer);
  const canSave = payerSelected && !!reason && totalAmount > 0 && !overBalance && !!date;

  const save = (): void => {
    const payerLabel =
      party === 'Insurance'
        ? insurances.find((i) => i.key === insuranceKey)?.label ?? ''
        : party === 'Non-insurance'
        ? nonInsurancePayer
        : '';
    onSave({
      responsibleParty: party,
      payerLabel,
      reason,
      allocations: lines.map((l, i) => ({ cptCode: l.cptCode, amount: shares[i] })).filter((a) => a.amount > 0),
      note,
      date,
    });
  };

  return (
    <Dialog open onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle sx={{ fontWeight: 600, pb: 1 }}>Write-off balance</DialogTitle>
      <DialogContent>
        <Box sx={{ display: 'flex', gap: 2, mt: 1, alignItems: 'center' }}>
          <TextField
            label="Write-off amount"
            size="small"
            type="number"
            sx={{ flex: 1 }}
            value={total}
            error={overBalance}
            helperText={overBalance ? 'Exceeds the remaining claim balance' : undefined}
            onChange={(e) => setTotal(e.target.value)}
            InputProps={{ startAdornment: <InputAdornment position="start">$</InputAdornment> }}
            inputProps={{ min: 0, step: 0.01 }}
            data-testid="write-off-total"
          />
          <Box sx={{ flex: 1 }}>
            <Typography variant="caption" color="text.secondary">
              Remaining claim balance
            </Typography>
            <Typography fontWeight={600}>{formatCurrency(remainingBalance - totalAmount)}</Typography>
          </Box>
        </Box>

        <Typography fontWeight={600} variant="body2" sx={{ mt: 2, mb: 0.5 }}>
          Service lines
        </Typography>
        <TableContainer>
          <Table size="small" sx={{ '& .MuiTableCell-root': { py: 0.25 } }}>
            <TableHead>
              <TableRow>
                <TableCell sx={thSx}>CPT Code</TableCell>
                <TableCell sx={thSx} align="right">
                  Billed
                </TableCell>
                <TableCell sx={thSx} align="right">
                  Adjusted
                </TableCell>
                <TableCell sx={thSx} align="right">
                  Ins. Paid
                </TableCell>
                <TableCell sx={thSx} align="right">
                  Pt. Paid
                </TableCell>
                <TableCell sx={thSx} align="right">
                  Balance
                </TableCell>
                <TableCell sx={thSx} align="right">
                  Amount
                </TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {lines.map((line, i) => (
                <TableRow key={line.cptCode}>
                  <TableCell>{line.cptCode}</TableCell>
                  <TableCell align="right">{formatCurrency(line.billed)}</TableCell>
                  <TableCell align="right">{formatCurrency(line.adjusted)}</TableCell>
                  <TableCell align="right">{formatCurrency(line.insurancePaid)}</TableCell>
                  <TableCell align="right">{formatCurrency(line.patientPaid)}</TableCell>
                  <TableCell align="right">{formatCurrency(line.balance)}</TableCell>
                  <TableCell align="right">{formatCurrency(shares[i] ?? 0)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>

        <Box sx={{ display: 'flex', gap: 1.5, mt: 2 }}>
          <FormControl fullWidth size="small">
            <InputLabel>Write-off for</InputLabel>
            <Select
              label="Write-off for"
              value={party}
              onChange={(e) => {
                setParty(e.target.value as WriteOffResponsibleParty);
                setReason('');
              }}
              data-testid="write-off-for"
            >
              <MenuItem value="Insurance">Insurance</MenuItem>
              <MenuItem value="Non-insurance">Non-insurance</MenuItem>
              <MenuItem value="Patient">Patient</MenuItem>
            </Select>
          </FormControl>
          {party === 'Insurance' && (
            <FormControl fullWidth size="small">
              <InputLabel>Insurance</InputLabel>
              <Select
                label="Insurance"
                value={insuranceKey}
                onChange={(e) => setInsuranceKey(e.target.value)}
                data-testid="write-off-insurance"
              >
                {insurances.map((i) => (
                  <MenuItem key={i.key} value={i.key}>
                    {i.label}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          )}
          {party === 'Non-insurance' && (
            <FormControl fullWidth size="small">
              <InputLabel>Non-Insurance Payer</InputLabel>
              <Select
                label="Non-Insurance Payer"
                value={nonInsurancePayer}
                onChange={(e) => setNonInsurancePayer(e.target.value)}
                data-testid="write-off-non-insurance"
              >
                {claim.nonInsurancePayerName ? (
                  <MenuItem value={claim.nonInsurancePayerName}>{claim.nonInsurancePayerName}</MenuItem>
                ) : (
                  <MenuItem value="" disabled>
                    No non-insurance payer on this claim
                  </MenuItem>
                )}
              </Select>
            </FormControl>
          )}
        </Box>

        <Box sx={{ display: 'flex', gap: 1.5, mt: 2 }}>
          <Box sx={{ flex: 1 }}>
            <DateInput label="Write-off date" size="small" fullWidth value={date ?? ''} onChange={setDate} />
          </Box>
          <FormControl fullWidth size="small" sx={{ flex: 1.5 }}>
            <InputLabel>Reason</InputLabel>
            <Select
              label="Reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              data-testid="write-off-reason"
            >
              {reasons.map((r) => (
                <MenuItem key={r} value={r}>
                  {r}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Box>

        <TextField
          label="Notes"
          size="small"
          fullWidth
          multiline
          minRows={2}
          sx={{ mt: 2 }}
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="contained" disabled={!canSave} onClick={save} data-testid="save-write-off">
          Save write-off
        </Button>
      </DialogActions>
    </Dialog>
  );
}

export function writeOffsTotal(writeOffs: ClaimWriteOff[]): number {
  return writeOffs.reduce((sum, wo) => sum + wo.allocations.reduce((s, a) => s + a.amount, 0), 0);
}

export function WriteOffsSection({
  claim,
  writeOffs,
  onAdd,
}: {
  claim: ClaimDetailResponse;
  writeOffs: ClaimWriteOff[];
  onAdd: (writeOff: ClaimWriteOff) => void;
}): ReactElement {
  const [dialogOpen, setDialogOpen] = useState(false);

  // Per-line money for the dialog: insurance paid from remits; patient paid is claim-level only,
  // so it's prorated by charges. Session write-offs reduce balances (UI prototype; not persisted).
  const dialogLines = useMemo<WriteOffLine[]>(() => {
    const insPaid = new Map<string, number>();
    const nonPrAdjusted = new Map<string, number>();
    for (const remit of claim.remits) {
      for (const sl of remit.serviceLines) {
        if (!sl.cptCode) continue;
        insPaid.set(sl.cptCode, (insPaid.get(sl.cptCode) ?? 0) + sl.paid);
        // CO/OA/PI adjustments are no longer receivable; PR stays in the balance (patient owes it)
        const adj = sl.adjustments.reduce(
          (s, a) => s + (a.groupCode === X12_ADJUSTMENT_GROUP_CODE.patientResponsibility ? 0 : a.amount),
          0
        );
        nonPrAdjusted.set(sl.cptCode, (nonPrAdjusted.get(sl.cptCode) ?? 0) + adj);
      }
    }
    const writtenOff = new Map<string, number>();
    for (const wo of writeOffs) {
      for (const a of wo.allocations) writtenOff.set(a.cptCode, (writtenOff.get(a.cptCode) ?? 0) + a.amount);
    }
    const totalCharges = claim.serviceLines.reduce((s, sl) => s + sl.charges, 0);
    return claim.serviceLines.map((sl) => {
      const ins = round2(insPaid.get(sl.cptCode) ?? 0);
      const pt = totalCharges > 0 ? round2((claim.patientPaid * sl.charges) / totalCharges) : 0;
      const adjusted = round2(sl.charges - (nonPrAdjusted.get(sl.cptCode) ?? 0));
      const balance = round2(Math.max(0, adjusted - ins - pt - (writtenOff.get(sl.cptCode) ?? 0)));
      return { cptCode: sl.cptCode, billed: sl.charges, adjusted, insurancePaid: ins, patientPaid: pt, balance };
    });
  }, [claim, writeOffs]);

  const remainingBalance = claim.balance - writeOffsTotal(writeOffs);

  const onSave = (writeOff: Omit<ClaimWriteOff, 'id'>): void => {
    onAdd({ ...writeOff, id: crypto.randomUUID() });
    setDialogOpen(false);
    enqueueSnackbar('Write-off saved', { variant: 'success' });
  };

  return (
    <>
      <ReadOnlySection title="Write-offs" onAdd={() => setDialogOpen(true)} addLabel="Write off balance">
        {writeOffs.length === 0 ? (
          'No write-offs yet'
        ) : (
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell sx={thSx}>Date</TableCell>
                  <TableCell sx={thSx}>Responsible Party</TableCell>
                  <TableCell sx={thSx}>Payer</TableCell>
                  <TableCell sx={thSx}>Reason</TableCell>
                  <TableCell sx={thSx}>Service Lines</TableCell>
                  <TableCell sx={thSx}>Note</TableCell>
                  <TableCell sx={thSx} align="right">
                    Amount
                  </TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {writeOffs.map((wo) => (
                  <TableRow key={wo.id}>
                    <TableCell>{formatDate(wo.date) || '-'}</TableCell>
                    <TableCell>{wo.responsibleParty}</TableCell>
                    <TableCell>{wo.payerLabel || '-'}</TableCell>
                    <TableCell>{wo.reason}</TableCell>
                    <TableCell>{wo.allocations.map((a) => a.cptCode).join(', ')}</TableCell>
                    <TableCell>{wo.note || '-'}</TableCell>
                    <TableCell align="right">
                      {formatCurrency(wo.allocations.reduce((s, a) => s + a.amount, 0))}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </ReadOnlySection>
      {dialogOpen && (
        <WriteOffDialog
          claim={claim}
          lines={dialogLines}
          remainingBalance={remainingBalance}
          onClose={() => setDialogOpen(false)}
          onSave={onSave}
        />
      )}
    </>
  );
}
