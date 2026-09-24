import { Box, FormControl, InputLabel, MenuItem, Select, TextField, Typography } from '@mui/material';
import { ReactElement, useId } from 'react';
import { EraClaimStatusCode, MANUAL_ERA_LIMITS } from 'utils/lib/types/data/billing/billing.constants';
import { ERA_STATUS_OPTIONS } from '../../constants/era';
import { ClaimForm, setClaimServiceDate } from '../../utils/manualEra';
import { DateInput } from '../DateInput';
import { EraServiceLinesEditor } from './EraServiceLinesEditor';

// One remit claim as a paper remit prints it: who and which claim, then its service lines. Used by
// the "Enter ERA Claim Details" dialog and by the claim cards on the manual remit page.
export function EraClaimEditor({
  claim,
  onChange,
}: {
  claim: ClaimForm;
  onChange: (claim: ClaimForm) => void;
}): ReactElement {
  const statusLabelId = useId();
  const set = (patch: Partial<ClaimForm>): void => onChange({ ...claim, ...patch });

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
        <TextField
          size="small"
          label="Patient Name"
          required
          value={claim.patientName}
          onChange={(event) => set({ patientName: event.target.value })}
          inputProps={{ maxLength: MANUAL_ERA_LIMITS.patientNameLength }}
          sx={{ flex: 3, minWidth: 240 }}
        />
        <TextField
          size="small"
          label="Member ID"
          value={claim.memberId}
          onChange={(event) => set({ memberId: event.target.value })}
          inputProps={{ maxLength: MANUAL_ERA_LIMITS.memberIdLength }}
          sx={{ flex: 2, minWidth: 180 }}
        />
        <FormControl size="small" sx={{ width: 240 }}>
          <InputLabel id={statusLabelId}>Claim Status</InputLabel>
          <Select
            labelId={statusLabelId}
            label="Claim Status"
            value={claim.statusCode}
            onChange={(event) => set({ statusCode: event.target.value as EraClaimStatusCode })}
          >
            {ERA_STATUS_OPTIONS.map((option) => (
              <MenuItem key={option.code} value={option.code}>
                {option.code} — {option.label}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
      </Box>
      <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
        <TextField
          size="small"
          label="Patient Account # (PCN)"
          value={claim.patientAccountNumber}
          onChange={(event) => set({ patientAccountNumber: event.target.value })}
          inputProps={{ maxLength: MANUAL_ERA_LIMITS.patientAccountNumberLength }}
          sx={{ flex: 2, minWidth: 200 }}
        />
        <TextField
          size="small"
          label="Payer Claim Control # (ICN)"
          value={claim.payerClaimControlNumber}
          onChange={(event) => set({ payerClaimControlNumber: event.target.value })}
          inputProps={{ maxLength: MANUAL_ERA_LIMITS.payerClaimControlNumberLength }}
          sx={{ flex: 2, minWidth: 200 }}
        />
        <Box sx={{ width: 190 }}>
          <DateInput
            label="Service Date"
            value={claim.serviceDate}
            onChange={(value) => onChange(setClaimServiceDate(claim, value))}
            fullWidth
          />
        </Box>
      </Box>
      <Typography variant="h6" color="primary.dark" fontWeight={600}>
        Service Lines
      </Typography>
      <EraServiceLinesEditor claim={claim} onChange={onChange} />
    </Box>
  );
}
