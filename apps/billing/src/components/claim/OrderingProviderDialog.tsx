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

/** Ordering provider carried on a service line row. */
export interface ServiceLineOrderingProvider {
  name: string;
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
}

/**
 * Small dialog to attach an ordering provider to a service line: pick an existing provider
 * (individuals only: only a Practitioner can be an ordering provider) or type in a name and NPI manually.
 */
export function OrderingProviderDialog({
  open,
  value,
  onSave,
  onRemove,
  onClose,
}: OrderingProviderDialogProps): ReactElement {
  const { options: providerOptions, search } = useProviderOptionsSearch('rendering');
  const options = useMemo(() => providerOptions.filter((o) => o.kind === 'individual'), [providerOptions]);
  const [mode, setMode] = useState<'existing' | 'manual'>('existing');
  const [selected, setSelected] = useState<BillingProviderOption | null>(null);
  const [name, setName] = useState('');
  const [npi, setNpi] = useState('');

  useEffect(() => {
    if (!open) return;
    setSelected(null);
    setName(value?.name ?? '');
    setNpi(value?.npi ?? '');
    setMode(value && !value.providerId ? 'manual' : 'existing');
    search();
  }, [open, value, search]);

  const npiValid = npi.trim() === '' || isNPIValidWithChecksum(npi.trim());
  const canSave = mode === 'existing' ? !!selected : name.trim().length > 0 && npiValid;

  const handleSave = (): void => {
    if (mode === 'existing' && selected) {
      onSave({
        name: selected.name,
        ...(selected.npi ? { npi: selected.npi } : {}),
        providerId: selected.id,
      });
    } else {
      onSave({
        name: name.trim(),
        ...(npi.trim() ? { npi: npi.trim() } : {}),
      });
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
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
                  Current: {value.name}
                  {value.npi ? ` · NPI ${value.npi}` : ''}
                </Typography>
              )}
              <Autocomplete
                size="small"
                options={options}
                value={selected}
                onChange={(_, v) => setSelected(v)}
                onInputChange={(_, input) => search(input)}
                getOptionLabel={(o) => (o.npi ? `${o.name} (NPI ${o.npi})` : o.name)}
                renderOption={(props, o) => (
                  <Box component="li" {...props} key={o.id}>
                    <Box>
                      <Typography variant="body2">{o.name}</Typography>
                      <Typography variant="caption" color="text.secondary">
                        {o.npi ? `NPI ${o.npi}` : ''}
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
              <TextField
                size="small"
                label="Name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoFocus
                fullWidth
              />
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
          <Button size="small" color="error" onClick={onRemove} sx={{ mr: 'auto' }}>
            Remove
          </Button>
        )}
        <Button size="small" onClick={onClose}>
          Cancel
        </Button>
        <Button size="small" variant="contained" disabled={!canSave} onClick={handleSave}>
          Save
        </Button>
      </DialogActions>
    </Dialog>
  );
}
