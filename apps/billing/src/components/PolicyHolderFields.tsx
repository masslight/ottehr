import { Box, Divider, MenuItem, Select, TextField, Typography } from '@mui/material';
import { ReactElement } from 'react';
import { BillingPolicyHolder, BillingPolicyHolderSummary, VALUE_SETS } from 'utils';
import { buildAddressInput } from '../utils/format';
import { Field } from './Field';

// Relationship + policy-holder fields for the claim insurance editor.
export interface PolicyHolderState {
  relationship: string;
  firstName: string;
  middleName: string;
  lastName: string;
  dob: string;
  gender: string;
  line1: string;
  line2: string;
  city: string;
  state: string;
  zip: string;
}

// Prefill from the structured policy-holder summary the API returns (claim detail / coverage option).
export function policyHolderStateFromSummary(
  relationship: string,
  summary: BillingPolicyHolderSummary | null | undefined
): PolicyHolderState {
  const addr = summary?.addressParts;
  return {
    relationship: relationship || 'Self',
    firstName: summary?.firstName ?? '',
    middleName: summary?.middleName ?? '',
    lastName: summary?.lastName ?? '',
    dob: summary?.dob ?? '',
    gender: summary?.gender || '',
    line1: addr?.line1 ?? '',
    line2: addr?.line2 ?? '',
    city: addr?.city ?? '',
    state: addr?.state ?? '',
    zip: addr?.postalCode ?? '',
  };
}

export function validatePolicyHolder(state: PolicyHolderState): string | null {
  if (!state.relationship) return 'Choose the relationship to insured';
  if (state.relationship !== 'Self') {
    if (!state.firstName.trim() || !state.lastName.trim()) return "Policy holder's first and last name are required";
    if (!state.dob) return "Policy holder's date of birth is required";
    if (!state.gender) return "Policy holder's gender is required";
    if (!buildAddressInput(state.line1, state.line2, state.city, state.state, state.zip))
      return "Policy holder's address is required";
  }
  return null;
}

export function policyHolderPayload(state: PolicyHolderState): BillingPolicyHolder | undefined {
  if (state.relationship === 'Self') return undefined;
  const address = buildAddressInput(state.line1, state.line2, state.city, state.state, state.zip);
  return {
    firstName: state.firstName.trim(),
    ...(state.middleName.trim() ? { middleName: state.middleName.trim() } : {}),
    lastName: state.lastName.trim(),
    dob: state.dob,
    gender: state.gender as BillingPolicyHolder['gender'],
    ...(address ? { address } : {}),
  };
}

export function PolicyHolderFields({
  value,
  onChange,
}: {
  value: PolicyHolderState;
  onChange: (next: PolicyHolderState) => void;
}): ReactElement {
  const set = <K extends keyof PolicyHolderState>(key: K, v: PolicyHolderState[K]): void =>
    onChange({ ...value, [key]: v });
  const isSelf = value.relationship === 'Self';

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.25 }}>
      <Field label="Patient's relationship to insured">
        <Select size="small" fullWidth value={value.relationship} onChange={(e) => set('relationship', e.target.value)}>
          {VALUE_SETS.relationshipToInsuredOptions.map((o) => (
            <MenuItem key={o.value} value={o.value}>
              {o.label}
            </MenuItem>
          ))}
        </Select>
      </Field>

      {!isSelf && (
        <>
          <Divider textAlign="left">
            <Typography
              variant="body2"
              sx={{
                color: 'text.secondary',
                fontSize: 12,
                fontWeight: 500,
                letterSpacing: '0.04em',
                textTransform: 'uppercase',
              }}
            >
              Policy holder
            </Typography>
          </Divider>
          <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 2.25 }}>
            <Field label="First name">
              <TextField
                size="small"
                fullWidth
                value={value.firstName}
                onChange={(e) => set('firstName', e.target.value)}
              />
            </Field>
            <Field label="Middle name" optional>
              <TextField
                size="small"
                fullWidth
                value={value.middleName}
                onChange={(e) => set('middleName', e.target.value)}
              />
            </Field>
            <Field label="Last name">
              <TextField
                size="small"
                fullWidth
                value={value.lastName}
                onChange={(e) => set('lastName', e.target.value)}
              />
            </Field>
            <Field label="Date of birth">
              <TextField
                size="small"
                fullWidth
                type="date"
                value={value.dob}
                onChange={(e) => set('dob', e.target.value)}
              />
            </Field>
            <Field label="Birth sex">
              <Select
                size="small"
                fullWidth
                displayEmpty
                value={value.gender}
                onChange={(e) => set('gender', e.target.value)}
                renderValue={
                  value.gender
                    ? undefined
                    : () => (
                        <Box component="span" sx={{ color: 'text.disabled' }}>
                          Select...
                        </Box>
                      )
                }
              >
                <MenuItem value="Male">Male</MenuItem>
                <MenuItem value="Female">Female</MenuItem>
                <MenuItem value="Intersex">Intersex</MenuItem>
              </Select>
            </Field>
          </Box>

          <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2.25 }}>
            <Field label="Address line 1">
              <TextField size="small" fullWidth value={value.line1} onChange={(e) => set('line1', e.target.value)} />
            </Field>
            <Field label="Address line 2" optional>
              <TextField size="small" fullWidth value={value.line2} onChange={(e) => set('line2', e.target.value)} />
            </Field>
            <Field label="City">
              <TextField size="small" fullWidth value={value.city} onChange={(e) => set('city', e.target.value)} />
            </Field>
            <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2 }}>
              <Field label="State">
                <TextField
                  size="small"
                  fullWidth
                  value={value.state}
                  onChange={(e) => set('state', e.target.value)}
                  inputProps={{ maxLength: 2, style: { textTransform: 'uppercase' } }}
                />
              </Field>
              <Field label="ZIP">
                <TextField size="small" fullWidth value={value.zip} onChange={(e) => set('zip', e.target.value)} />
              </Field>
            </Box>
          </Box>
        </>
      )}
    </Box>
  );
}
