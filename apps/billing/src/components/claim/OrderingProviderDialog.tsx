import {
  Autocomplete,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from '@mui/material';
import { ReactElement, useEffect, useMemo, useState } from 'react';
import { isNPIValidWithChecksum } from 'utils/lib/helpers/helpers';
import { BillingProviderOption } from 'utils/lib/types/data/billing/billing.types';
import { useProviderOptionsSearch } from '../../hooks/useOptionSearch';
import { formatDisplayName } from '../../utils/format';

/** Ordering provider carried on a service line row. */
export interface ServiceLineOrderingProvider {
  firstName: string;
  lastName: string;
  npi?: string;
  /** FHIR id of the Practitioner when picked from an existing provider. */
  providerId?: string;
}

interface OrderingProviderDialogProps {
  open: boolean;
  value: ServiceLineOrderingProvider | null;
  onSave: (provider: ServiceLineOrderingProvider) => void;
  onRemove?: () => void;
  onClose: () => void;
  saving?: boolean;
}

/**
 * Small dialog to attach an ordering provider to a service line: pick an existing provider
 * (individuals only: only a Practitioner can be an ordering provider) or type in a first and last name and
 * NPI manually.
 */
export function OrderingProviderDialog({
  open,
  value,
  onSave,
  onRemove,
  onClose,
  saving = false,
}: OrderingProviderDialogProps): ReactElement {
  const { options: providerOptions, search } = useProviderOptionsSearch('rendering');
  const options = useMemo(() => providerOptions.filter((o) => o.kind === 'individual'), [providerOptions]);
  const [mode, setMode] = useState<'existing' | 'manual'>('existing');
  const [selected, setSelected] = useState<BillingProviderOption | null>(null);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [npi, setNpi] = useState('');

  useEffect(() => {
    if (!open) return;
    setSelected(null);
    const manual = value && !value.providerId ? value : null;
    setFirstName(manual?.firstName ?? '');
    setLastName(manual?.lastName ?? '');
    setNpi(value?.npi ?? '');
    setMode(value && !value.providerId ? 'manual' : 'existing');
    search();
  }, [open, value, search]);

  const npiValid = npi.trim() === '' || isNPIValidWithChecksum(npi.trim());
  const canSave =
    mode === 'existing' ? !!selected : firstName.trim().length > 0 && lastName.trim().length > 0 && npiValid;
  // the ordering provider is reported by first and last name, so a provider missing either can't be one
  const hasNameParts = (o: BillingProviderOption): boolean => !!o.firstName && !!o.lastName;

  const handleSave = (): void => {
    if (mode === 'existing' && selected) {
      onSave({
        firstName: selected.firstName ?? '',
        lastName: selected.lastName ?? '',
        ...(selected.npi ? { npi: selected.npi } : {}),
        providerId: selected.id,
      });
    } else {
      onSave({
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        ...(npi.trim() ? { npi: npi.trim() } : {}),
      });
    }
  };

  return (
    <Dialog open={open} onClose={saving ? undefined : onClose} maxWidth="xs" fullWidth>
      <DialogTitle>Ordering Provider</DialogTitle>
      <DialogContent>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
          <ToggleButtonGroup
            exclusive
            size="small"
            value={mode}
            onChange={(_, next) => next && setMode(next)}
            sx={{ '& .MuiToggleButton-root': { textTransform: 'none', px: 1.5, py: 0.5 } }}
          >
            <ToggleButton value="existing">Select existing</ToggleButton>
            <ToggleButton value="manual">Enter manually</ToggleButton>
          </ToggleButtonGroup>
          {mode === 'existing' ? (
            <>
              {value && (
                <Typography variant="caption" color="text.secondary">
                  Current: {formatDisplayName(value)}
                  {value.npi ? ` · NPI ${value.npi}` : ''}
                </Typography>
              )}
              <Autocomplete
                size="small"
                options={options}
                value={selected}
                onChange={(_, v) => setSelected(v)}
                onInputChange={(_, input) => search(input)}
                getOptionDisabled={(o) => !hasNameParts(o)}
                getOptionLabel={(o) => (o.npi ? `${o.name} (NPI ${o.npi})` : o.name)}
                renderOption={(props, o) => (
                  <Box component="li" {...props} key={o.id}>
                    <Box>
                      <Typography variant="body2">{o.name}</Typography>
                      <Typography variant="caption" color="text.secondary">
                        {hasNameParts(o) ? (o.npi ? `NPI ${o.npi}` : '') : 'Missing first or last name'}
                      </Typography>
                    </Box>
                  </Box>
                )}
                isOptionEqualToValue={(o, v) => o.id === v.id}
                renderInput={(p) => <TextField {...p} label="Provider" autoFocus />}
              />
            </>
          ) : (
            <>
              <Box sx={{ display: 'flex', gap: 2 }}>
                <TextField
                  size="small"
                  label="First name"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  autoFocus
                  fullWidth
                />
                <TextField
                  size="small"
                  label="Last name"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  fullWidth
                />
              </Box>
              <TextField
                size="small"
                label="NPI"
                value={npi}
                onChange={(e) => setNpi(e.target.value.replace(/\D/g, '').slice(0, 10))}
                error={!npiValid}
                helperText={npiValid ? undefined : 'NPI must be 10 digits with a valid check digit'}
                sx={{ width: 160 }}
              />
            </>
          )}
        </Box>
      </DialogContent>
      <DialogActions>
        {onRemove && (
          <Button size="small" color="error" onClick={onRemove} disabled={saving} sx={{ mr: 'auto' }}>
            Remove
          </Button>
        )}
        <Button size="small" onClick={onClose} disabled={saving}>
          Cancel
        </Button>
        <Button size="small" variant="contained" disabled={!canSave || saving} onClick={handleSave}>
          {saving ? 'Saving...' : 'Save'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
