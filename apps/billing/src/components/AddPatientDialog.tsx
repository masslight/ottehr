import { Close as CloseIcon } from '@mui/icons-material';
import {
  Alert,
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
  SxProps,
  TextField,
  Theme,
  Typography,
} from '@mui/material';
import { ReactElement, ReactNode, useEffect, useState } from 'react';
import { chooseJson } from 'utils';
import { useApiClients } from '../hooks/useAppClients';

interface AddPatientDialogProps {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
}

function Field({
  label,
  optional,
  children,
  sx,
}: {
  label: string;
  optional?: boolean;
  children: ReactNode;
  sx?: SxProps<Theme>;
}): ReactElement {
  return (
    <Box sx={sx}>
      <Typography
        variant="body2"
        sx={{ color: 'text.primary', fontSize: 13, fontWeight: 500, display: 'block', mb: 0.75 }}
      >
        {label}
        {optional && (
          <Box component="span" sx={{ color: 'text.secondary', fontWeight: 400 }}>
            {' · optional'}
          </Box>
        )}
      </Typography>
      {children}
    </Box>
  );
}

export function AddPatientDialog({ open, onClose, onCreated }: AddPatientDialogProps): ReactElement {
  const { oystehrZambda } = useApiClients();

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [dob, setDob] = useState('');
  const [gender, setGender] = useState('');
  const [phone, setPhone] = useState('');
  const [line1, setLine1] = useState('');
  const [line2, setLine2] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [zip, setZip] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setFirstName('');
    setLastName('');
    setDob('');
    setGender('');
    setPhone('');
    setLine1('');
    setLine2('');
    setCity('');
    setState('');
    setZip('');
    setSaving(false);
    setError(null);
  }, [open]);

  const canSave = !!firstName.trim() && !!lastName.trim();

  const handleSave = async (): Promise<void> => {
    if (!oystehrZambda || !canSave) return;
    setSaving(true);
    setError(null);
    try {
      const address = {
        ...(line1.trim() ? { line1: line1.trim() } : {}),
        ...(line2.trim() ? { line2: line2.trim() } : {}),
        ...(city.trim() ? { city: city.trim() } : {}),
        ...(state.trim() ? { state: state.trim() } : {}),
        ...(zip.trim() ? { postalCode: zip.trim() } : {}),
      };
      const payload = {
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        ...(dob ? { dob } : {}),
        ...(gender ? { gender } : {}),
        ...(phone.trim() ? { phone: phone.trim() } : {}),
        ...(Object.keys(address).length ? { address } : {}),
      };
      const res = await oystehrZambda.zambda.execute({ id: 'create-billing-patient', ...payload });
      const data = chooseJson(res);
      if (!data?.id) throw new Error('Patient was not created');
      onCreated();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth={false} PaperProps={{ sx: { width: 480, maxWidth: '95vw' } }}>
      <DialogTitle sx={{ px: 3, pt: 3, pb: 2, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        Add patient
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
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.25, mt: 0.5 }}>
          <Box sx={{ display: 'flex', gap: 2 }}>
            <Field label="First name" sx={{ flex: 1 }}>
              <TextField
                size="small"
                fullWidth
                autoFocus
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
              />
            </Field>
            <Field label="Last name" sx={{ flex: 1 }}>
              <TextField size="small" fullWidth value={lastName} onChange={(e) => setLastName(e.target.value)} />
            </Field>
          </Box>

          <Box sx={{ display: 'flex', gap: 2 }}>
            <Field label="Date of birth" sx={{ flex: 1 }}>
              <TextField size="small" fullWidth type="date" value={dob} onChange={(e) => setDob(e.target.value)} />
            </Field>
            <Field label="Gender" sx={{ flex: 1 }}>
              <Select
                size="small"
                fullWidth
                displayEmpty
                value={gender}
                onChange={(e) => setGender(e.target.value)}
                renderValue={
                  gender
                    ? undefined
                    : () => (
                        <Box component="span" sx={{ color: 'text.disabled' }}>
                          Select...
                        </Box>
                      )
                }
              >
                <MenuItem value="male">Male</MenuItem>
                <MenuItem value="female">Female</MenuItem>
                <MenuItem value="other">Other</MenuItem>
                <MenuItem value="unknown">Unknown</MenuItem>
              </Select>
            </Field>
          </Box>

          <Field label="Phone number" optional>
            <TextField
              size="small"
              fullWidth
              placeholder="(555) 000-0000"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
            />
          </Field>

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
              Address
            </Typography>
          </Divider>

          <Field label="Address line 1">
            <TextField size="small" fullWidth value={line1} onChange={(e) => setLine1(e.target.value)} />
          </Field>
          <Field label="Address line 2" optional>
            <TextField size="small" fullWidth value={line2} onChange={(e) => setLine2(e.target.value)} />
          </Field>
          <Box sx={{ display: 'flex', gap: 2 }}>
            <Field label="City" sx={{ flex: 2 }}>
              <TextField size="small" fullWidth value={city} onChange={(e) => setCity(e.target.value)} />
            </Field>
            <Field label="State" sx={{ flex: 1 }}>
              <TextField
                size="small"
                fullWidth
                value={state}
                onChange={(e) => setState(e.target.value)}
                inputProps={{ maxLength: 2, style: { textTransform: 'uppercase' } }}
              />
            </Field>
            <Field label="ZIP" sx={{ flex: 1 }}>
              <TextField size="small" fullWidth value={zip} onChange={(e) => setZip(e.target.value)} />
            </Field>
          </Box>
        </Box>
      </DialogContent>
      <DialogActions sx={{ px: 3, py: 2.5 }}>
        <Button onClick={onClose} sx={{ color: 'text.secondary' }}>
          Cancel
        </Button>
        <Button variant="contained" onClick={() => void handleSave()} disabled={saving || !canSave}>
          {saving ? 'Saving...' : 'Save patient'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
