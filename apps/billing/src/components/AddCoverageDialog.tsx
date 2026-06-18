import { Close as CloseIcon } from '@mui/icons-material';
import {
  Alert,
  Autocomplete,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  IconButton,
  MenuItem,
  Select,
  TextField,
  Typography,
} from '@mui/material';
import { ReactElement, useCallback, useEffect, useRef, useState } from 'react';
import {
  BillingCoverageOption,
  BillingInsuranceType,
  BillingPayerOption,
  CreateBillingCoverageInput,
  getApiError,
  UpdateBillingCoverageInput,
  VALUE_SETS,
} from 'utils';
import { createBillingCoverage, searchBillingPayers } from '../api/api';
import { useApiClients } from '../hooks/useAppClients';
import { buildAddressInput } from '../utils/format';
import { Field } from './Field';

type BirthSex = 'Male' | 'Female' | 'Intersex';

const INSURANCE_TYPE_OPTIONS: { value: BillingInsuranceType; label: string }[] = [
  { value: 'primary', label: 'Primary' },
  { value: 'secondary', label: 'Secondary' },
  { value: 'workersComp', label: "Worker's Comp" },
];

function insuranceTypeLabel(type: BillingInsuranceType): string {
  return INSURANCE_TYPE_OPTIONS.find((o) => o.value === type)?.label ?? type;
}

export interface CoverageFormState {
  payer: BillingPayerOption | null;
  memberId: string;
  insuranceType: BillingInsuranceType;
  relationship: string;
  firstName: string;
  middleName: string;
  lastName: string;
  dob: string;
  birthSex: BirthSex | '';
  line1: string;
  line2: string;
  city: string;
  state: string;
  zip: string;
}

export function emptyCoverageForm(insuranceType: BillingInsuranceType = 'primary'): CoverageFormState {
  return {
    payer: null,
    memberId: '',
    insuranceType,
    relationship: 'Self',
    firstName: '',
    middleName: '',
    lastName: '',
    dob: '',
    birthSex: '',
    line1: '',
    line2: '',
    city: '',
    state: '',
    zip: '',
  };
}

// Prefill a form from an existing coverage. The payer autocomplete starts empty (placeholder shows the
// current payer); a payer is only re-pointed when the user explicitly picks one.
export function coverageFormFromOption(option: BillingCoverageOption): CoverageFormState {
  const ph = option.policyHolder;
  const addr = ph?.addressParts;
  return {
    payer: null,
    memberId: option.memberId ?? option.subscriberId ?? '',
    insuranceType: option.insuranceType ?? 'primary',
    relationship: option.relationship || 'Self',
    firstName: ph?.firstName ?? '',
    middleName: ph?.middleName ?? '',
    lastName: ph?.lastName ?? '',
    dob: ph?.dob ?? '',
    birthSex: (ph?.birthSex as BirthSex) || '',
    line1: addr?.line1 ?? '',
    line2: addr?.line2 ?? '',
    city: addr?.city ?? '',
    state: addr?.state ?? '',
    zip: addr?.postalCode ?? '',
  };
}

export function validateCoverageForm(
  state: CoverageFormState,
  payerRequired: boolean,
  unavailableTypes: BillingInsuranceType[] = []
): string | null {
  if (payerRequired && !state.payer) return 'Choose a payer';
  if (!state.memberId.trim()) return 'Member / Subscriber ID is required';
  if (unavailableTypes.includes(state.insuranceType))
    return `This patient already has a ${insuranceTypeLabel(state.insuranceType)} coverage.`;
  if (!state.relationship) return 'Choose the relationship to insured';
  if (state.relationship !== 'Self') {
    if (!state.firstName.trim() || !state.lastName.trim()) return "Policy holder's first and last name are required";
    if (!state.dob) return "Policy holder's date of birth is required";
    if (!state.birthSex) return "Policy holder's birth sex is required";
    if (!buildAddressInput(state.line1, state.line2, state.city, state.state, state.zip))
      return "Policy holder's address is required";
  }
  return null;
}

function policyHolderPayload(state: CoverageFormState): CreateBillingCoverageInput['policyHolder'] | undefined {
  if (state.relationship === 'Self') return undefined;
  const address = buildAddressInput(state.line1, state.line2, state.city, state.state, state.zip);
  return {
    firstName: state.firstName.trim(),
    ...(state.middleName.trim() ? { middleName: state.middleName.trim() } : {}),
    lastName: state.lastName.trim(),
    dob: state.dob,
    birthSex: state.birthSex as BirthSex,
    ...(address ? { address } : {}),
  };
}

export function coverageToCreateInput(state: CoverageFormState, patientId: string): CreateBillingCoverageInput {
  return {
    patientId,
    payerId: state.payer!.id,
    memberId: state.memberId.trim(),
    insuranceType: state.insuranceType,
    relationship: state.relationship as CreateBillingCoverageInput['relationship'],
    ...(policyHolderPayload(state) ? { policyHolder: policyHolderPayload(state) } : {}),
  };
}

export function coverageToUpdateInput(state: CoverageFormState, coverageId: string): UpdateBillingCoverageInput {
  return {
    coverageId,
    // Only re-point the payer when the user picked a new one.
    ...(state.payer ? { payerId: state.payer.id } : {}),
    memberId: state.memberId.trim(),
    insuranceType: state.insuranceType,
    relationship: state.relationship as UpdateBillingCoverageInput['relationship'],
    ...(policyHolderPayload(state) ? { policyHolder: policyHolderPayload(state) } : {}),
  };
}

interface CoverageFormFieldsProps {
  value: CoverageFormState;
  onChange: (next: CoverageFormState) => void;
  // Placeholder for the payer autocomplete (e.g. the current payer when editing).
  payerPlaceholder?: string;
  // Insurance types already held by other active coverages (disabled in the Insurance Type dropdown).
  unavailableTypes?: BillingInsuranceType[];
}

export function CoverageFormFields({
  value,
  onChange,
  payerPlaceholder,
  unavailableTypes = [],
}: CoverageFormFieldsProps): ReactElement {
  const { oystehrZambda } = useApiClients();
  const [payerOptions, setPayerOptions] = useState<BillingPayerOption[]>([]);
  const searchTimer = useRef<ReturnType<typeof setTimeout>>();

  const set = useCallback(
    <K extends keyof CoverageFormState>(key: K, v: CoverageFormState[K]): void => onChange({ ...value, [key]: v }),
    [value, onChange]
  );

  const searchPayers = useCallback(
    (query?: string): void => {
      if (!oystehrZambda) return;
      if (searchTimer.current) clearTimeout(searchTimer.current);
      searchTimer.current = setTimeout(async () => {
        const res = await searchBillingPayers(oystehrZambda, query ? { name: query } : {});
        setPayerOptions(res.payers ?? []);
      }, 300);
    },
    [oystehrZambda]
  );

  const isSelf = value.relationship === 'Self';

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.25 }}>
      <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2.25 }}>
        <Field label="Payer">
          <Autocomplete
            size="small"
            options={payerOptions}
            value={value.payer}
            onChange={(_, v) => set('payer', v)}
            onInputChange={(_, val, reason) => {
              if (reason === 'input') searchPayers(val || undefined);
            }}
            onOpen={() => searchPayers()}
            filterOptions={(x) => x}
            getOptionLabel={(o) => o.name}
            renderOption={(props, o) => (
              <Box component="li" {...props} key={o.id}>
                <Box>
                  <Typography variant="body2" fontWeight={500}>
                    {o.name}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    Payer ID: {o.payerId}
                  </Typography>
                </Box>
              </Box>
            )}
            renderInput={(p) => <TextField {...p} size="small" placeholder={payerPlaceholder || 'Choose payer...'} />}
            isOptionEqualToValue={(o, v) => o.id === v.id}
          />
        </Field>
        <Field label="Member / Subscriber ID">
          <TextField size="small" fullWidth value={value.memberId} onChange={(e) => set('memberId', e.target.value)} />
        </Field>
        <Field label="Insurance Type">
          <Select
            size="small"
            fullWidth
            value={value.insuranceType}
            onChange={(e) => set('insuranceType', e.target.value as BillingInsuranceType)}
          >
            {INSURANCE_TYPE_OPTIONS.map((o) => (
              <MenuItem key={o.value} value={o.value} disabled={unavailableTypes.includes(o.value)}>
                {o.label}
                {unavailableTypes.includes(o.value) ? ' (already on file)' : ''}
              </MenuItem>
            ))}
          </Select>
        </Field>
      </Box>

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
                value={value.birthSex}
                onChange={(e) => set('birthSex', e.target.value as BirthSex)}
                renderValue={
                  value.birthSex
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

interface AddCoverageDialogProps {
  open: boolean;
  patientId: string;
  defaultType: BillingInsuranceType;
  // Insurance types already held by active coverages (disabled / blocked in the form).
  unavailableTypes?: BillingInsuranceType[];
  onClose: () => void;
  onCreated: () => void;
}

export function AddCoverageDialog({
  open,
  patientId,
  defaultType,
  unavailableTypes = [],
  onClose,
  onCreated,
}: AddCoverageDialogProps): ReactElement {
  const { oystehrZambda } = useApiClients();
  const [form, setForm] = useState<CoverageFormState>(emptyCoverageForm(defaultType));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setForm(emptyCoverageForm(defaultType));
    setSaving(false);
    setError(null);
  }, [open, defaultType]);

  const handleSave = async (): Promise<void> => {
    if (!oystehrZambda) return;
    const validationError = validateCoverageForm(form, true, unavailableTypes);
    if (validationError) {
      setError(validationError);
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const data = await createBillingCoverage(oystehrZambda, coverageToCreateInput(form, patientId));
      if (!data.id) throw new Error('Coverage was not created');
      onCreated();
      onClose();
    } catch (err) {
      setError(getApiError({ error: err, defaultError: 'Failed to create coverage' }));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth={false} PaperProps={{ sx: { width: 680, maxWidth: '95vw' } }}>
      <DialogTitle sx={{ px: 3, pt: 3, pb: 2, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        Add insurance coverage
        <IconButton size="small" onClick={onClose} aria-label="Close">
          <CloseIcon fontSize="small" />
        </IconButton>
      </DialogTitle>
      <DialogContent sx={{ px: 3, pb: 0 }}>
        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}
        <Box sx={{ mt: 0.5 }}>
          <CoverageFormFields value={form} onChange={setForm} unavailableTypes={unavailableTypes} />
        </Box>
      </DialogContent>
      <DialogActions sx={{ px: 3, py: 2.5 }}>
        <Button onClick={onClose} sx={{ color: 'text.secondary' }}>
          Cancel
        </Button>
        <Button variant="contained" onClick={() => void handleSave()} disabled={saving}>
          {saving ? 'Saving...' : 'Save coverage'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
