import { Add as AddIcon, Close as CloseIcon, WarningAmberRounded as WarningIcon } from '@mui/icons-material';
import { Box, Button, IconButton, TextField, Tooltip, Typography } from '@mui/material';
import { ReactElement } from 'react';
import { formatCurrency } from 'utils/lib/utils/convert';
import {
  addAdjustment,
  bucketIsLocked,
  bucketValue,
  ClaimForm,
  emptyServiceLine,
  isMoneyText,
  lineImbalanceCents,
  newKey,
  parseMoneyToCents,
  PatientRespBucket,
  removeAdjustment,
  ServiceLineForm,
  setBucketValue,
  setLineServiceDate,
  syncContractual,
  updateAdjustment,
} from '../../utils/manualEra';
import { DateInput } from '../DateInput';
import { ProcedureCodeAutocomplete } from '../ProcedureCodeAutocomplete';
import { AdjustmentGroupSelect } from './AdjustmentGroupSelect';
import { RemitCodeAutocomplete } from './RemitCodeAutocomplete';

const headSx = { color: 'primary.dark', fontWeight: 700, fontSize: 14 };
const AMOUNT_WIDTH = 104;
// where adjustment rows line up: under the DOS column
const INDENT = 5;

function AmountField({
  label,
  value,
  onChange,
  disabled,
  helper,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  helper?: string;
}): ReactElement {
  const field = (
    <TextField
      size="small"
      label={label}
      value={value}
      onChange={(event) => onChange(event.target.value)}
      error={!isMoneyText(value)}
      disabled={disabled}
      inputProps={{ inputMode: 'decimal', style: { textAlign: 'right' }, 'aria-label': label }}
      sx={{ width: AMOUNT_WIDTH }}
    />
  );
  return helper ? (
    <Tooltip title={helper}>
      <span>{field}</span>
    </Tooltip>
  ) : (
    field
  );
}

const paidCents = (line: ServiceLineForm): number => parseMoneyToCents(line.paid) ?? 0;

const BUCKETS: { bucket: PatientRespBucket; label: string }[] = [
  { bucket: 'deductible', label: 'Deductible' },
  { bucket: 'coinsurance', label: 'Co-Ins' },
  { bucket: 'copay', label: 'Co-Pay' },
];

// The service lines of one remit claim, the way a paper remit lays them out: date, procedure, billed and
// the adjudication, then the line's CARC adjustments and RARC remarks. Billed − Allowed keeps a CO-45 row
// up to date until the biller changes it; Deductible / Co-Ins / Co-Pay are the PR-1 / 2 / 3 rows.
export function EraServiceLinesEditor({
  claim,
  onChange,
}: {
  claim: ClaimForm;
  onChange: (claim: ClaimForm) => void;
}): ReactElement {
  const setLine = (key: string, update: (line: ServiceLineForm) => ServiceLineForm): void =>
    onChange({ ...claim, serviceLines: claim.serviceLines.map((line) => (line.key === key ? update(line) : line)) });

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
      <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'center', pl: 1 }}>
        <Typography sx={{ ...headSx, width: 28 }}>#</Typography>
        <Typography sx={{ ...headSx, width: 170 }}>DOS</Typography>
        <Typography sx={{ ...headSx, width: 150 }}>Procedure</Typography>
        <Typography sx={{ ...headSx, width: AMOUNT_WIDTH, textAlign: 'right' }}>Billed</Typography>
        <Typography sx={headSx}>Adjudication</Typography>
      </Box>

      {claim.serviceLines.map((line, index) => {
        const imbalance = lineImbalanceCents(line);
        return (
          <Box
            key={line.key}
            data-testid={`service-line-${index + 1}`}
            sx={{
              display: 'flex',
              flexDirection: 'column',
              gap: 1,
              py: 1,
              pl: 1,
              borderTop: index ? 1 : 0,
              borderColor: 'divider',
            }}
          >
            <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'center', flexWrap: 'wrap' }}>
              <Typography sx={{ width: 28 }}>{index + 1}</Typography>
              <Box sx={{ width: 170 }}>
                <DateInput
                  label="DOS"
                  value={line.serviceDate}
                  onChange={(value) => onChange(setLineServiceDate(claim, line.key, value))}
                  fullWidth
                />
              </Box>
              <ProcedureCodeAutocomplete
                label="CPT/HCPCS"
                value={line.procedureCode}
                onChange={(code) => setLine(line.key, (current) => ({ ...current, procedureCode: code }))}
                width={150}
              />
              <AmountField
                label="Billed"
                value={line.billed}
                onChange={(value) => setLine(line.key, (current) => syncContractual({ ...current, billed: value }))}
              />
              <AmountField
                label="Allowed"
                value={line.allowed}
                onChange={(value) => setLine(line.key, (current) => syncContractual({ ...current, allowed: value }))}
              />
              <AmountField
                label="Ins Paid"
                value={line.paid}
                onChange={(value) => setLine(line.key, (current) => ({ ...current, paid: value }))}
              />
              {BUCKETS.map(({ bucket, label }) => (
                <AmountField
                  key={bucket}
                  label={label}
                  value={bucketValue(line, bucket)}
                  onChange={(value) => setLine(line.key, (current) => setBucketValue(current, bucket, value))}
                  disabled={bucketIsLocked(line, bucket)}
                  helper={
                    bucketIsLocked(line, bucket)
                      ? 'This line has more than one row with this code; edit the rows below'
                      : undefined
                  }
                />
              ))}
              {claim.serviceLines.length > 1 && (
                <Tooltip title="Remove line">
                  <IconButton
                    size="small"
                    aria-label={`Remove line ${index + 1}`}
                    onClick={() =>
                      onChange({ ...claim, serviceLines: claim.serviceLines.filter((l) => l.key !== line.key) })
                    }
                  >
                    <CloseIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
              )}
            </Box>

            {line.adjustments.map((row) => (
              <Box key={row.key} sx={{ display: 'flex', gap: 1.5, alignItems: 'center', pl: INDENT }}>
                <AdjustmentGroupSelect
                  value={row.groupCode}
                  onChange={(groupCode) =>
                    setLine(line.key, (current) => updateAdjustment(current, row.key, { groupCode }))
                  }
                  error={!row.groupCode}
                />
                <RemitCodeAutocomplete
                  kind="carc"
                  value={row.reasonCode}
                  onChange={(reasonCode) =>
                    setLine(line.key, (current) => updateAdjustment(current, row.key, { reasonCode }))
                  }
                  error={!row.reasonCode}
                />
                <AmountField
                  label="Amount"
                  value={row.amount}
                  onChange={(amount) => setLine(line.key, (current) => updateAdjustment(current, row.key, { amount }))}
                />
                <Box sx={{ flexGrow: 1 }} />
                <IconButton
                  size="small"
                  aria-label={`Remove ${row.groupCode || 'CARC'}-${row.reasonCode}`}
                  onClick={() => setLine(line.key, (current) => removeAdjustment(current, row.key))}
                >
                  <CloseIcon fontSize="small" />
                </IconButton>
              </Box>
            ))}

            {line.remarkCodes.map((row) => (
              <Box key={row.key} sx={{ display: 'flex', gap: 1.5, alignItems: 'center', pl: INDENT }}>
                <RemitCodeAutocomplete
                  kind="rarc"
                  value={row.code}
                  width={200}
                  error={!row.code}
                  onChange={(code) =>
                    setLine(line.key, (current) => ({
                      ...current,
                      remarkCodes: current.remarkCodes.map((remark) =>
                        remark.key === row.key ? { ...remark, code } : remark
                      ),
                    }))
                  }
                />
                <Box sx={{ flexGrow: 1 }} />
                <IconButton
                  size="small"
                  aria-label={`Remove RARC ${row.code}`}
                  onClick={() =>
                    setLine(line.key, (current) => ({
                      ...current,
                      remarkCodes: current.remarkCodes.filter((remark) => remark.key !== row.key),
                    }))
                  }
                >
                  <CloseIcon fontSize="small" />
                </IconButton>
              </Box>
            ))}

            <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', pl: INDENT - 1 }}>
              <Button size="small" startIcon={<AddIcon />} onClick={() => setLine(line.key, addAdjustment)}>
                CARC
              </Button>
              <Button
                size="small"
                startIcon={<AddIcon />}
                onClick={() =>
                  setLine(line.key, (current) => ({
                    ...current,
                    remarkCodes: [...current.remarkCodes, { key: newKey(), code: '' }],
                  }))
                }
              >
                RARC
              </Button>
              {imbalance !== null && (
                <Typography
                  variant="caption"
                  color="warning.main"
                  sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}
                >
                  <WarningIcon fontSize="inherit" />
                  Billed less adjustments is {formatCurrency((paidCents(line) + imbalance) / 100)}, not the{' '}
                  {formatCurrency(paidCents(line) / 100)} paid
                </Typography>
              )}
            </Box>
          </Box>
        );
      })}

      <Box>
        <Button
          size="small"
          startIcon={<AddIcon />}
          onClick={() => onChange({ ...claim, serviceLines: [...claim.serviceLines, emptyServiceLine(claim)] })}
        >
          Add Line
        </Button>
      </Box>
    </Box>
  );
}
