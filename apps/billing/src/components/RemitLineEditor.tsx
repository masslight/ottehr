import { Add as AddIcon, Close as CloseIcon } from '@mui/icons-material';
import {
  Autocomplete,
  Box,
  Button,
  Chip,
  FormControl,
  IconButton,
  InputLabel,
  Menu,
  MenuItem,
  Select,
  Stack,
  TableCell,
  TableRow,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import { ReactElement, useState } from 'react';
import { X12_ADJUSTMENT_GROUP_CODE, X12AdjustmentGroupCode } from 'utils/lib/types/data/billing/billing.constants';
import { CARC_DESCRIPTIONS, carcDescription, X12_ADJUSTMENT_GROUP_LABELS } from 'utils/lib/types/data/billing/carc';
import { RARC_DESCRIPTIONS, rarcDescription } from 'utils/lib/types/data/billing/rarc';
import { formatCurrency } from 'utils/lib/utils/convert';
import { formatDate } from '../utils/format';
import { DateInput } from './DateInput';
import { WarningIconWithTooltip } from './WarningIconWithTooltip';

export interface RemitAdjustment {
  groupCode: X12AdjustmentGroupCode;
  carc: string;
  amount: string;
}

export interface RemitLine {
  sequence: number;
  cptCode: string;
  description: string;
  modifiers: string[];
  units: number;
  serviceDate: string;
  billed: number;
  allowed: string;
  paid: string;
  deductible: string;
  coinsurance: string;
  copay: string;
  adjustments: RemitAdjustment[];
  remarks: string[];
}

export const emptyRemitLine = (sequence: number, serviceDate = ''): RemitLine => ({
  sequence,
  cptCode: '',
  description: '',
  modifiers: [],
  units: 1,
  serviceDate,
  billed: 0,
  allowed: '',
  paid: '',
  deductible: '',
  coinsurance: '',
  copay: '',
  adjustments: [],
  remarks: [],
});

export const num = (value: string): number => {
  const parsed = parseFloat(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

// Each amount field drives one derived adjustment row: deductible → PR-1, coinsurance → PR-2,
// copay → PR-3, billed/allowed → CO-45 (billed - allowed). Only the row for the edited field is
// upserted (in place, or removed when its amount clears), so manual tweaks to the others survive.
const applyAutoAdjustment = (line: RemitLine, key: keyof RemitLine): RemitLine => {
  const upsert = (groupCode: X12AdjustmentGroupCode, carc: string, amount: number): RemitLine => {
    const isRow = (a: RemitAdjustment): boolean => a.groupCode === groupCode && a.carc === carc;
    if (amount <= 0.005) return { ...line, adjustments: line.adjustments.filter((a) => !isRow(a)) };
    const value = String(Math.round(amount * 100) / 100);
    const adjustments = line.adjustments.some(isRow)
      ? line.adjustments.map((a) => (isRow(a) ? { ...a, amount: value } : a))
      : [...line.adjustments, { groupCode, carc, amount: value }];
    return { ...line, adjustments };
  };

  const pr = X12_ADJUSTMENT_GROUP_CODE.patientResponsibility;
  switch (key) {
    case 'deductible':
      return upsert(pr, '1', num(line.deductible));
    case 'coinsurance':
      return upsert(pr, '2', num(line.coinsurance));
    case 'copay':
      return upsert(pr, '3', num(line.copay));
    case 'billed':
    case 'allowed': {
      const allowed = num(line.allowed);
      const contractual = line.billed > 0 && allowed > 0 ? line.billed - allowed : 0;
      return upsert(X12_ADJUSTMENT_GROUP_CODE.contractualObligation, '45', contractual);
    }
    default:
      return line;
  }
};

const GROUP_CODES = Object.values(X12_ADJUSTMENT_GROUP_CODE);

const carcOptions = Object.keys(CARC_DESCRIPTIONS);
const rarcOptions = Object.keys(RARC_DESCRIPTIONS);

function CodeAutocomplete({
  label,
  options,
  describe,
  value,
  onChange,
  disabled,
  width,
}: {
  label: string;
  options: string[];
  describe: (code: string) => string | undefined;
  value: string;
  onChange: (code: string) => void;
  disabled?: boolean;
  width: number;
}): ReactElement {
  return (
    <Autocomplete
      size="small"
      options={options}
      value={value || null}
      onChange={(_, v) => onChange(v ?? '')}
      renderInput={(params) => <TextField {...params} label={label} />}
      renderOption={(props, code) => (
        <Box component="li" {...props} key={code} sx={{ display: 'block !important', py: 0.75 }}>
          <Typography variant="body2" fontWeight={600}>
            {code}
          </Typography>
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', whiteSpace: 'normal' }}>
            {describe(code) ?? 'No description available'}
          </Typography>
        </Box>
      )}
      disabled={disabled}
      sx={{ width }}
      componentsProps={{ popper: { style: { width: 440 } } }}
    />
  );
}

function MoneyInput({
  label,
  value,
  onChange,
  disabled,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}): ReactElement {
  return (
    <TextField
      size="small"
      label={label}
      type="number"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      disabled={disabled}
      inputProps={{ step: '0.01', min: 0 }}
      sx={{
        flex: 1,
        minWidth: 96,
        '& input': { textAlign: 'right' },
        // no spinner arrows on money fields
        '& input[type=number]': { MozAppearance: 'textfield' },
        '& input[type=number]::-webkit-outer-spin-button, & input[type=number]::-webkit-inner-spin-button': {
          WebkitAppearance: 'none',
          margin: 0,
        },
      }}
    />
  );
}

// One adjudicated service line: amounts + CARC/RARC adjustments. With editableProcedure the
// DOS/CPT/billed cells become inputs (manual ERA entry); otherwise they display the claim's line.
export function LineEditor({
  line,
  onChange,
  disabled,
  editableProcedure,
  onRemoveLine,
}: {
  line: RemitLine;
  onChange: (line: RemitLine) => void;
  disabled: boolean;
  editableProcedure?: boolean;
  onRemoveLine?: () => void;
}): ReactElement {
  const [rarcMenuAnchor, setRarcMenuAnchor] = useState<HTMLElement | null>(null);

  const set = <K extends keyof RemitLine>(key: K, value: RemitLine[K]): void => onChange({ ...line, [key]: value });

  // amount edits upsert their derived adjustment row (PR-1/2/3, CO-45)
  const setAmount = <K extends keyof RemitLine>(key: K, value: RemitLine[K]): void =>
    onChange(applyAutoAdjustment({ ...line, [key]: value }, key));

  const setAdjustment = (idx: number, adjustment: RemitAdjustment): void =>
    set(
      'adjustments',
      line.adjustments.map((a, i) => (i === idx ? adjustment : a))
    );

  const codeWithModifiers = [line.cptCode, ...line.modifiers].filter(Boolean).join(':');

  // allowed must fully split into ins paid + patient responsibility once both sides are entered
  const patientResp = num(line.deductible) + num(line.coinsurance) + num(line.copay);
  const lineImbalance =
    line.allowed !== '' && line.paid !== '' ? num(line.allowed) - (num(line.paid) + patientResp) : 0;
  const lineOutOfBalance = Math.abs(lineImbalance) > 0.005;

  return (
    <>
      <TableRow sx={{ '& > td': { borderBottom: 'none', verticalAlign: 'top', pt: 1.5 } }}>
        <TableCell sx={{ width: 40 }}>
          <Stack direction="row" alignItems="center" spacing={0.5}>
            <span>{line.sequence}</span>
            {onRemoveLine && !disabled && (
              <IconButton size="small" aria-label="Remove line" onClick={onRemoveLine}>
                <CloseIcon fontSize="small" />
              </IconButton>
            )}
          </Stack>
        </TableCell>
        <TableCell sx={{ width: editableProcedure ? 170 : 110 }}>
          {editableProcedure ? (
            <DateInput
              label="DOS"
              size="small"
              fullWidth
              value={line.serviceDate}
              onChange={(value) => set('serviceDate', value)}
            />
          ) : (
            formatDate(line.serviceDate) || '-'
          )}
        </TableCell>
        <TableCell sx={{ minWidth: 180 }}>
          {editableProcedure ? (
            <TextField
              size="small"
              label="CPT/HCPCS"
              value={line.cptCode}
              onChange={(e) => set('cptCode', e.target.value.toUpperCase())}
              disabled={disabled}
              fullWidth
            />
          ) : (
            <>
              <Typography variant="body2" fontWeight={600}>
                {codeWithModifiers}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {line.description}
              </Typography>
            </>
          )}
        </TableCell>
        <TableCell align="right" sx={{ width: editableProcedure ? 130 : 90, pt: editableProcedure ? 1.5 : 2.5 }}>
          {editableProcedure ? (
            <MoneyInput
              label="Billed"
              value={line.billed ? String(line.billed) : ''}
              onChange={(v) => setAmount('billed', num(v))}
              disabled={disabled}
            />
          ) : (
            formatCurrency(line.billed)
          )}
        </TableCell>
        <TableCell colSpan={2}>
          <Stack direction="row" spacing={1} flexWrap="nowrap" alignItems="center">
            <MoneyInput
              label="Allowed"
              value={line.allowed}
              onChange={(v) => setAmount('allowed', v)}
              disabled={disabled}
            />
            <MoneyInput label="Ins Paid" value={line.paid} onChange={(v) => set('paid', v)} disabled={disabled} />
            <MoneyInput
              label="Deductible"
              value={line.deductible}
              onChange={(v) => setAmount('deductible', v)}
              disabled={disabled}
            />
            <MoneyInput
              label="Co-Ins"
              value={line.coinsurance}
              onChange={(v) => setAmount('coinsurance', v)}
              disabled={disabled}
            />
            <MoneyInput label="Co-Pay" value={line.copay} onChange={(v) => setAmount('copay', v)} disabled={disabled} />
            {lineOutOfBalance && (
              <WarningIconWithTooltip
                tooltipText={`Allowed ${formatCurrency(
                  num(line.allowed)
                )} should equal Ins Paid + Deductible + Co-Ins + Co-Pay (${formatCurrency(
                  num(line.paid) + patientResp
                )}) — off by ${formatCurrency(lineImbalance)}`}
              />
            )}
          </Stack>
        </TableCell>
      </TableRow>
      <TableRow sx={{ '& > td': { pt: 0 } }}>
        <TableCell />
        <TableCell colSpan={5}>
          <Stack spacing={1} sx={{ pb: 1 }}>
            {line.adjustments.map((adjustment, idx) => (
              <Stack key={idx} direction="row" spacing={1} alignItems="center">
                <FormControl size="small" sx={{ width: 110 }} disabled={disabled}>
                  <InputLabel>Group</InputLabel>
                  <Select
                    value={adjustment.groupCode}
                    label="Group"
                    renderValue={(v) => String(v)}
                    onChange={(e) => {
                      const groupCode = e.target.value as X12AdjustmentGroupCode;
                      setAdjustment(idx, {
                        ...adjustment,
                        groupCode,
                        // CO's overwhelmingly common code
                        carc:
                          groupCode === X12_ADJUSTMENT_GROUP_CODE.contractualObligation && !adjustment.carc
                            ? '45'
                            : adjustment.carc,
                      });
                    }}
                  >
                    {GROUP_CODES.map((code) => (
                      <MenuItem key={code} value={code}>
                        {code} — {X12_ADJUSTMENT_GROUP_LABELS[code]}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
                <CodeAutocomplete
                  label="CARC"
                  options={carcOptions}
                  describe={carcDescription}
                  value={adjustment.carc}
                  onChange={(code) => setAdjustment(idx, { ...adjustment, carc: code })}
                  disabled={disabled}
                  width={140}
                />
                <Box sx={{ width: 140, display: 'flex' }}>
                  <MoneyInput
                    label="Amount"
                    value={adjustment.amount}
                    onChange={(v) => setAdjustment(idx, { ...adjustment, amount: v })}
                    disabled={disabled}
                  />
                </Box>
                <Box sx={{ flex: 1 }} />
                {!disabled && (
                  <IconButton
                    size="small"
                    aria-label="Remove adjustment"
                    onClick={() =>
                      set(
                        'adjustments',
                        line.adjustments.filter((_, i) => i !== idx)
                      )
                    }
                  >
                    <CloseIcon fontSize="small" />
                  </IconButton>
                )}
              </Stack>
            ))}
            <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
              {line.remarks.map((code, idx) => (
                <Tooltip key={`${code}-${idx}`} title={rarcDescription(code) ?? 'No description available'}>
                  <Chip
                    label={`RARC ${code}`}
                    size="small"
                    variant="outlined"
                    sx={{ borderRadius: '4px', fontSize: 12 }}
                    onDelete={
                      disabled
                        ? undefined
                        : () =>
                            set(
                              'remarks',
                              line.remarks.filter((_, i) => i !== idx)
                            )
                    }
                  />
                </Tooltip>
              ))}
              {!disabled && (
                <>
                  <Button
                    size="small"
                    startIcon={<AddIcon fontSize="small" />}
                    onClick={() =>
                      set('adjustments', [
                        ...line.adjustments,
                        { groupCode: X12_ADJUSTMENT_GROUP_CODE.contractualObligation, carc: '45', amount: '' },
                      ])
                    }
                  >
                    CARC
                  </Button>
                  <Button
                    size="small"
                    startIcon={<AddIcon fontSize="small" />}
                    onClick={(e) => setRarcMenuAnchor(e.currentTarget)}
                  >
                    RARC
                  </Button>
                  <Menu
                    anchorEl={rarcMenuAnchor}
                    open={!!rarcMenuAnchor}
                    onClose={() => setRarcMenuAnchor(null)}
                    PaperProps={{ sx: { maxHeight: 380, width: 480 } }}
                  >
                    {rarcOptions
                      .filter((code) => !line.remarks.includes(code))
                      .map((code) => (
                        <MenuItem
                          key={code}
                          onClick={() => {
                            setRarcMenuAnchor(null);
                            set('remarks', [...line.remarks, code]);
                          }}
                          sx={{ display: 'block', whiteSpace: 'normal', py: 0.75 }}
                        >
                          <Typography variant="body2" fontWeight={600}>
                            {code}
                          </Typography>
                          <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                            {rarcDescription(code) ?? 'No description available'}
                          </Typography>
                        </MenuItem>
                      ))}
                  </Menu>
                </>
              )}
            </Stack>
          </Stack>
        </TableCell>
      </TableRow>
    </>
  );
}
