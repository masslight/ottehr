import {
  Alert,
  Autocomplete,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  TextField,
  Typography,
} from '@mui/material';
import { ReactElement, useEffect, useState } from 'react';
import { AllStates, CMS_PLACE_OF_SERVICE_CODES, getApiError, SaveServiceFacilityInput } from 'utils';
import { saveBillingServiceFacility } from '../api/api';
import { useApiClients } from '../hooks/useAppClients';
import { validateServiceFacilityFields } from '../utils/validation';
import { Field } from './Field';

interface AddServiceFacilityDialogProps {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
}

export function AddServiceFacilityDialog({ open, onClose, onCreated }: AddServiceFacilityDialogProps): ReactElement {
  const { oystehrZambda } = useApiClients();

  const [name, setName] = useState('');
  const [line1, setLine1] = useState('');
  const [line2, setLine2] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [zip, setZip] = useState('');
  const [zipPlus4, setZipPlus4] = useState('');
  const [npi, setNpi] = useState('');
  const [clia, setClia] = useState('');
  const [posCode, setPosCode] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setName('');
    setLine1('');
    setLine2('');
    setCity('');
    setState('');
    setZip('');
    setZipPlus4('');
    setNpi('');
    setClia('');
    setPosCode('');
    setSaving(false);
    setError(null);
  }, [open]);

  const canSave = !!name.trim() && !!line1.trim() && !!city.trim() && !!state && !!zip.trim();

  const handleSave = async (): Promise<void> => {
    if (!oystehrZambda || !canSave) return;
    const validationError = validateServiceFacilityFields({ npi, clia, zip, zipPlus4 });
    if (validationError) {
      setError(validationError);
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const payload: SaveServiceFacilityInput = {
        name: name.trim(),
        addressLine1: line1.trim(),
        ...(line2.trim() ? { addressLine2: line2.trim() } : {}),
        city: city.trim(),
        state,
        zip: zip.trim(),
        ...(zipPlus4.trim() ? { zipPlus4: zipPlus4.trim() } : {}),
        ...(npi.trim() ? { npi: npi.trim() } : {}),
        ...(clia.trim() ? { clia: clia.trim() } : {}),
        ...(posCode ? { posCode } : {}),
      };
      const data = await saveBillingServiceFacility(oystehrZambda, payload);
      if (!data.id) throw new Error('Service facility was not created');
      onCreated();
      onClose();
    } catch (err) {
      setError(getApiError({ error: err, defaultError: 'Failed to create service facility' }));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth={false} PaperProps={{ sx: { width: 980, maxWidth: '95vw' } }}>
      <DialogTitle sx={{ fontWeight: 700 }}>Add Service Facility</DialogTitle>
      <DialogContent>
        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}
        <Box sx={{ display: 'flex', gap: 5, mt: 1 }}>
          {/* Left: facility */}
          <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 2.5 }}>
            <Field label="Name">
              <TextField size="small" fullWidth value={name} onChange={(e) => setName(e.target.value)} />
            </Field>
            <Box sx={{ display: 'flex', gap: 2 }}>
              <Field label="NPI" optional sx={{ flex: 1 }}>
                <TextField size="small" fullWidth value={npi} onChange={(e) => setNpi(e.target.value)} />
              </Field>
              <Field label="CLIA Number" optional sx={{ flex: 1 }}>
                <TextField size="small" fullWidth value={clia} onChange={(e) => setClia(e.target.value)} />
              </Field>
            </Box>
            <Field label="Place of Service" optional>
              <Autocomplete
                size="small"
                options={CMS_PLACE_OF_SERVICE_CODES}
                getOptionLabel={(o) => `${o.code} - ${o.display}`}
                value={CMS_PLACE_OF_SERVICE_CODES.find((o) => o.code === posCode) ?? null}
                onChange={(_, v) => setPosCode(v?.code ?? '')}
                isOptionEqualToValue={(o, v) => o.code === v.code}
                renderInput={(params) => <TextField {...params} placeholder="Select..." />}
              />
            </Field>
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
            <Field label="Address 2" optional>
              <TextField size="small" fullWidth value={line2} onChange={(e) => setLine2(e.target.value)} />
            </Field>
            <Field label="City">
              <TextField size="small" fullWidth value={city} onChange={(e) => setCity(e.target.value)} />
            </Field>
            <Box sx={{ display: 'flex', gap: 2 }}>
              <Field label="State" sx={{ flex: 1 }}>
                <Autocomplete
                  size="small"
                  options={AllStates}
                  getOptionLabel={(o) => o.value}
                  value={AllStates.find((o) => o.value === state) ?? null}
                  onChange={(_, v) => setState(v?.value ?? '')}
                  isOptionEqualToValue={(o, v) => o.value === v.value}
                  renderInput={(params) => <TextField {...params} placeholder="Select..." />}
                />
              </Field>
              <Field label="Zip" sx={{ flex: 1 }}>
                <TextField size="small" fullWidth value={zip} onChange={(e) => setZip(e.target.value)} />
              </Field>
              <Field label="Zip+4" optional sx={{ flex: 1 }}>
                <TextField size="small" fullWidth value={zipPlus4} onChange={(e) => setZipPlus4(e.target.value)} />
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
