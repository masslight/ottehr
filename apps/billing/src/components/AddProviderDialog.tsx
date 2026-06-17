import {
  Alert,
  Autocomplete,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  MenuItem,
  Select,
  Switch,
  TextField,
  Typography,
} from '@mui/material';
import { ReactElement, useEffect, useState } from 'react';
import { CreateBillingProviderInput, getApiError, PractitionerQualificationCodesDisplay } from 'utils';
import { createBillingProvider } from '../api/api';
import { useApiClients } from '../hooks/useAppClients';
import { buildAddressInput } from '../utils/format';
import { validateProviderFields } from '../utils/validation';
import { Field } from './Field';

type ProviderKind = 'individual' | 'organization';

interface AddProviderDialogProps {
  open: boolean;
  defaultRole: 'billing' | 'rendering';
  onClose: () => void;
  onCreated: () => void;
}

export function AddProviderDialog({ open, defaultRole, onClose, onCreated }: AddProviderDialogProps): ReactElement {
  const { oystehrZambda } = useApiClients();

  const [kind, setKind] = useState<ProviderKind>('individual');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [orgName, setOrgName] = useState('');
  const [npi, setNpi] = useState('');
  const [licenseType, setLicenseType] = useState('');
  const [taxonomyCode, setTaxonomyCode] = useState('');
  const [taxId, setTaxId] = useState('');
  const [line1, setLine1] = useState('');
  const [line2, setLine2] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [zip, setZip] = useState('');
  const [renders, setRenders] = useState(false);
  const [bills, setBills] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setKind('individual');
    setFirstName('');
    setLastName('');
    setOrgName('');
    setNpi('');
    setLicenseType('');
    setTaxonomyCode('');
    setTaxId('');
    setLine1('');
    setLine2('');
    setCity('');
    setState('');
    setZip('');
    setRenders(defaultRole === 'rendering');
    setBills(defaultRole === 'billing');
    setSaving(false);
    setError(null);
  }, [open, defaultRole]);

  const nameValid = kind === 'individual' ? !!firstName.trim() && !!lastName.trim() : !!orgName.trim();
  const canSave = nameValid && (renders || bills);

  const handleSave = async (): Promise<void> => {
    if (!oystehrZambda || !canSave) return;
    const validationError = validateProviderFields({ npi, taxId, taxonomyCode, zip });
    if (validationError) {
      setError(validationError);
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const roles = [...(bills ? ['billing'] : []), ...(renders ? ['rendering'] : [])];
      const address = buildAddressInput(line1, line2, city, state, zip);
      const common = {
        roles,
        ...(npi.trim() ? { npi: npi.trim() } : {}),
        ...(taxonomyCode.trim() ? { taxonomyCode: taxonomyCode.trim() } : {}),
        ...(taxId.trim() ? { taxId: taxId.trim() } : {}),
        ...(address ? { address } : {}),
      };
      const payload =
        kind === 'individual'
          ? {
              kind,
              firstName: firstName.trim(),
              lastName: lastName.trim(),
              ...(licenseType ? { licenseType } : {}),
              ...common,
            }
          : { kind, name: orgName.trim(), ...common };

      const data = await createBillingProvider(oystehrZambda, payload as CreateBillingProviderInput);
      if (!data.id) throw new Error('Provider was not created');
      onCreated();
      onClose();
    } catch (err) {
      setError(getApiError({ error: err, defaultError: 'Failed to create provider' }));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth={false} PaperProps={{ sx: { width: 980, maxWidth: '95vw' } }}>
      <DialogTitle sx={{ fontWeight: 700 }}>Add Provider</DialogTitle>
      <DialogContent>
        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}
        <Box sx={{ display: 'flex', gap: 5, mt: 1 }}>
          {/* Left: provider */}
          <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 2.5 }}>
            <Field label="Provider Type">
              <Select size="small" fullWidth value={kind} onChange={(e) => setKind(e.target.value as ProviderKind)}>
                <MenuItem value="individual">Individual</MenuItem>
                <MenuItem value="organization">Organization</MenuItem>
              </Select>
            </Field>

            {kind === 'individual' ? (
              <Box sx={{ display: 'flex', gap: 2 }}>
                <Field label="First Name" sx={{ flex: 1 }}>
                  <TextField size="small" fullWidth value={firstName} onChange={(e) => setFirstName(e.target.value)} />
                </Field>
                <Field label="Last Name" sx={{ flex: 1 }}>
                  <TextField size="small" fullWidth value={lastName} onChange={(e) => setLastName(e.target.value)} />
                </Field>
              </Box>
            ) : (
              <Field label="Organization Name">
                <TextField size="small" fullWidth value={orgName} onChange={(e) => setOrgName(e.target.value)} />
              </Field>
            )}

            <Box sx={{ display: 'flex', gap: 2 }}>
              <Field label="NPI" sx={{ flex: 1 }}>
                <TextField size="small" fullWidth value={npi} onChange={(e) => setNpi(e.target.value)} />
              </Field>
              <Field label="Tax ID" sx={{ flex: 1 }}>
                <TextField size="small" fullWidth value={taxId} onChange={(e) => setTaxId(e.target.value)} />
              </Field>
            </Box>

            <Box sx={{ display: 'flex', gap: 2 }}>
              {kind === 'individual' && (
                <Field label="License Type" sx={{ flex: 1 }}>
                  <Autocomplete
                    size="small"
                    options={PractitionerQualificationCodesDisplay}
                    getOptionLabel={(o) => o.label}
                    value={PractitionerQualificationCodesDisplay.find((o) => o.value === licenseType) ?? null}
                    onChange={(_, v) => setLicenseType(v?.value ?? '')}
                    isOptionEqualToValue={(o, v) => o.value === v.value}
                    renderInput={(params) => <TextField {...params} placeholder="Select..." />}
                  />
                </Field>
              )}
              <Field label="Taxonomy Code" sx={{ flex: 1 }}>
                <TextField
                  size="small"
                  fullWidth
                  value={taxonomyCode}
                  onChange={(e) => setTaxonomyCode(e.target.value)}
                />
              </Field>
            </Box>

            <Box sx={{ display: 'flex', gap: 4 }}>
              <FormControlLabel
                control={<Switch checked={renders} onChange={(e) => setRenders(e.target.checked)} />}
                label="Renders medical services"
              />
              <FormControlLabel
                control={<Switch checked={bills} onChange={(e) => setBills(e.target.checked)} />}
                label="Bills medical services"
              />
            </Box>
          </Box>

          {/* Right: address */}
          <Box
            sx={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              gap: 2.5,
              borderLeft: 1,
              borderColor: 'divider',
              pl: 5,
            }}
          >
            <Typography variant="caption" sx={{ color: 'text.secondary' }}>
              Address
            </Typography>
            <Field label="Address 1">
              <TextField size="small" fullWidth value={line1} onChange={(e) => setLine1(e.target.value)} />
            </Field>
            <Field label="Address 2 (Optional)">
              <TextField size="small" fullWidth value={line2} onChange={(e) => setLine2(e.target.value)} />
            </Field>
            <Field label="City">
              <TextField size="small" fullWidth value={city} onChange={(e) => setCity(e.target.value)} />
            </Field>
            <Box sx={{ display: 'flex', gap: 2 }}>
              <Field label="State" sx={{ flex: 1 }}>
                <TextField size="small" fullWidth value={state} onChange={(e) => setState(e.target.value)} />
              </Field>
              <Field label="Zip Code" sx={{ flex: 1 }}>
                <TextField size="small" fullWidth value={zip} onChange={(e) => setZip(e.target.value)} />
              </Field>
            </Box>
          </Box>
        </Box>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="contained" onClick={() => void handleSave()} disabled={saving || !canSave}>
          {saving ? 'Saving...' : 'Save'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
