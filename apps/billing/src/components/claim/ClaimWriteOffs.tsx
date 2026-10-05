import {
  Box,
  Button,
  Checkbox,
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
import { ClaimDetailResponse } from 'utils/lib/types/data/billing/billing.types';
import { formatCurrency } from 'utils/lib/utils/convert';
import { formatDate } from '../../utils/format';
import { DateInput } from '../DateInput';
import { ReadOnlySection, thSx } from '../ReadOnlySection';

export const WRITE_OFF_RESPONSIBLE_PARTIES = ['Patient', 'Insurance', 'Non-insurance'] as const;
export type WriteOffResponsibleParty = (typeof WRITE_OFF_RESPONSIBLE_PARTIES)[number];

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

interface LineState {
  cptCode: string;
  billed: number;
  balance: number;
  checked: boolean;
  amount: string;
}

function WriteOffDialog({
  claim,
  lineBalances,
  remainingBalance,
  onClose,
  onSave,
}: {
  claim: ClaimDetailResponse;
  lineBalances: Map<string, number>;
  remainingBalance: number;
  onClose: () => void;
  onSave: (writeOff: Omit<ClaimWriteOff, 'id'>) => void;
}): ReactElement {
  const [party, setParty] = useState<WriteOffResponsibleParty | ''>('');
  const [insuranceKey, setInsuranceKey] = useState('');
  const [nonInsurancePayer, setNonInsurancePayer] = useState('');
  const [reason, setReason] = useState('');
  const [note, setNote] = useState('');
  const [date, setDate] = useState(DateTime.now().toISODate());
  const [lines, setLines] = useState<LineState[]>(() =>
    claim.serviceLines.map((sl) => ({
      cptCode: sl.cptCode,
      billed: sl.charges,
      balance: lineBalances.get(sl.cptCode) ?? sl.charges,
      checked: false,
      amount: '',
    }))
  );

  const insurances = insuranceOptions(claim);
  const reasons = party === 'Patient' ? PATIENT_WRITE_OFF_REASONS : INSURANCE_WRITE_OFF_REASONS;

  const totalAdjusted = useMemo(
    () => lines.reduce((sum, l) => sum + (l.checked ? Number(l.amount) || 0 : 0), 0),
    [lines]
  );

  const setLine = (cptCode: string, patch: Partial<LineState>): void =>
    setLines((prev) => prev.map((l) => (l.cptCode === cptCode ? { ...l, ...patch } : l)));

  const toggleLine = (line: LineState, checked: boolean): void =>
    setLine(line.cptCode, { checked, amount: checked ? String(line.balance) : '' });

  const toggleAll = (checked: boolean): void =>
    setLines((prev) => prev.map((l) => ({ ...l, checked, amount: checked ? String(l.balance) : '' })));

  const overAllocated = lines.some((l) => l.checked && (Number(l.amount) || 0) > l.balance);
  const payerSelected = party === 'Patient' || (party === 'Insurance' ? !!insuranceKey : !!nonInsurancePayer);
  const canSave = !!party && payerSelected && !!reason && totalAdjusted > 0 && !overAllocated && !!date;

  const save = (): void => {
    const payerLabel =
      party === 'Insurance'
        ? insurances.find((i) => i.key === insuranceKey)?.label ?? ''
        : party === 'Non-insurance'
        ? nonInsurancePayer
        : '';
    onSave({
      responsibleParty: party as WriteOffResponsibleParty,
      payerLabel,
      reason,
      allocations: lines
        .filter((l) => l.checked && (Number(l.amount) || 0) > 0)
        .map((l) => ({ cptCode: l.cptCode, amount: Number(l.amount) })),
      note,
      date,
    });
  };

  const allChecked = lines.length > 0 && lines.every((l) => l.checked);

  return (
    <Dialog open onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle sx={{ fontWeight: 600 }}>Write-off balance</DialogTitle>
      <DialogContent>
        <Box sx={{ display: 'flex', gap: 2, mt: 1 }}>
          <FormControl fullWidth size="small">
            <InputLabel>Responsible party</InputLabel>
            <Select
              label="Responsible party"
              value={party}
              onChange={(e) => {
                setParty(e.target.value as WriteOffResponsibleParty);
                setReason('');
                setInsuranceKey('');
                setNonInsurancePayer('');
              }}
              data-testid="write-off-party"
            >
              {WRITE_OFF_RESPONSIBLE_PARTIES.map((p) => (
                <MenuItem key={p} value={p}>
                  {p}
                </MenuItem>
              ))}
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

        <FormControl fullWidth size="small" sx={{ mt: 2 }}>
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

        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mt: 3, mb: 1 }}>
          <Typography fontWeight={600}>Select Service Lines</Typography>
        </Box>
        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell padding="checkbox">
                  <Checkbox
                    size="small"
                    checked={allChecked}
                    indeterminate={!allChecked && lines.some((l) => l.checked)}
                    onChange={(e) => toggleAll(e.target.checked)}
                  />
                </TableCell>
                <TableCell sx={thSx}>CPT Code</TableCell>
                <TableCell sx={thSx} align="right">
                  Billed
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
              {lines.map((line) => {
                const over = line.checked && (Number(line.amount) || 0) > line.balance;
                return (
                  <TableRow key={line.cptCode}>
                    <TableCell padding="checkbox">
                      <Checkbox
                        size="small"
                        checked={line.checked}
                        onChange={(e) => toggleLine(line, e.target.checked)}
                      />
                    </TableCell>
                    <TableCell>{line.cptCode}</TableCell>
                    <TableCell align="right">{formatCurrency(line.billed)}</TableCell>
                    <TableCell align="right">{formatCurrency(line.balance)}</TableCell>
                    <TableCell align="right" sx={{ width: 160 }}>
                      <TextField
                        size="small"
                        type="number"
                        value={line.amount}
                        disabled={!line.checked}
                        error={over}
                        helperText={over ? 'Exceeds balance' : undefined}
                        onChange={(e) => setLine(line.cptCode, { amount: e.target.value })}
                        InputProps={{
                          startAdornment: <InputAdornment position="start">$</InputAdornment>,
                        }}
                        inputProps={{ min: 0, step: 0.01, style: { textAlign: 'right' } }}
                      />
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </TableContainer>

        <Box sx={{ display: 'flex', gap: 2, mt: 3 }}>
          <TextField
            label="Total adjusted amount"
            size="small"
            fullWidth
            value={formatCurrency(totalAdjusted)}
            InputProps={{ readOnly: true }}
          />
          <TextField
            label="Remaining claim balance"
            size="small"
            fullWidth
            value={formatCurrency(remainingBalance - totalAdjusted)}
            InputProps={{ readOnly: true }}
          />
        </Box>

        <TextField
          label="Note"
          size="small"
          fullWidth
          multiline
          minRows={2}
          sx={{ mt: 2 }}
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />

        <Box sx={{ mt: 2 }}>
          <DateInput label="Date" size="small" fullWidth value={date ?? ''} onChange={setDate} />
        </Box>
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

  // Per-line balance after subtracting this session's write-offs (UI prototype; not persisted).
  const lineBalances = useMemo(() => {
    const balances = new Map<string, number>(claim.serviceLines.map((sl) => [sl.cptCode, sl.charges]));
    for (const wo of writeOffs) {
      for (const alloc of wo.allocations) {
        balances.set(alloc.cptCode, Math.max(0, (balances.get(alloc.cptCode) ?? 0) - alloc.amount));
      }
    }
    return balances;
  }, [claim.serviceLines, writeOffs]);

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
          lineBalances={lineBalances}
          remainingBalance={remainingBalance}
          onClose={() => setDialogOpen(false)}
          onSave={onSave}
        />
      )}
    </>
  );
}
