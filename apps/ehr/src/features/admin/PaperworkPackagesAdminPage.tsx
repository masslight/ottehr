// UI-only mockup for the Paperwork Packages admin tab. Hardcoded sample data;
// no API calls, no FHIR persistence. Intended as a visual sketch of how
// associating a base intake Questionnaire with practice-managed forms could
// look in a single admin surface — independent of (and not yet pulling in) the
// group-scheduling branch's Services model.
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import EditIcon from '@mui/icons-material/Edit';
import {
  Box,
  Button,
  Checkbox,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  FormControlLabel,
  IconButton,
  InputLabel,
  ListItemText,
  MenuItem,
  OutlinedInput,
  Paper,
  Select,
  Stack,
  Switch,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import { FC, useMemo, useState } from 'react';

// ── Sample reference data (would come from FHIR in the real version) ─────────

const BASE_PAPERWORK_OPTIONS = [
  { value: 'in-person', label: 'In-person intake (full)' },
  { value: 'virtual', label: 'Virtual intake (full)' },
  { value: 'consent-only', label: 'Consent only (lite)' },
] as const;

type BaseCanonical = (typeof BASE_PAPERWORK_OPTIONS)[number]['value'];

const PRACTICE_FORM_OPTIONS = [
  { id: 'aap-oral-health', label: 'AAP Oral Health Risk Assessment' },
  { id: 'audit-c', label: 'AUDIT-C (Alcohol Use)' },
  { id: 'gad-7', label: 'GAD-7 (Generalized Anxiety)' },
  { id: 'massage-intake', label: 'Massage Intake Form' },
  { id: 'phq-2', label: 'PHQ-2 (Depression Screen)' },
  { id: 'phq-9', label: 'PHQ-9 (Depression Severity)' },
  { id: 'vanderbilt-parent', label: 'Vanderbilt ADHD (Parent)' },
  { id: 'wc-followup', label: 'Workers Comp Follow-up Form' },
];

interface PaperworkPackage {
  id: string;
  name: string;
  code: string;
  active: boolean;
  base: BaseCanonical;
  formIds: string[];
}

// Sample packages shown on first render — read-only mock state.
const SAMPLE_PACKAGES: PaperworkPackage[] = [
  {
    id: 'pkg-1',
    name: '90 Minute Massage',
    code: 'massage-90',
    active: true,
    base: 'consent-only',
    formIds: ['massage-intake'],
  },
  {
    id: 'pkg-2',
    name: 'Workers Comp Follow-up',
    code: 'wc-followup',
    active: true,
    base: 'consent-only',
    formIds: ['wc-followup'],
  },
  {
    id: 'pkg-3',
    name: 'New Patient Annual',
    code: 'new-patient-annual',
    active: true,
    base: 'in-person',
    formIds: ['phq-9', 'audit-c', 'gad-7'],
  },
  {
    id: 'pkg-4',
    name: 'Telehealth Mental Health Intake',
    code: 'telehealth-mh',
    active: true,
    base: 'virtual',
    formIds: ['phq-9', 'gad-7'],
  },
  {
    id: 'pkg-5',
    name: 'Pediatric Well-Child',
    code: 'peds-well-child',
    active: false,
    base: 'in-person',
    formIds: ['aap-oral-health', 'vanderbilt-parent'],
  },
];

const BLANK_PACKAGE: PaperworkPackage = {
  id: '',
  name: '',
  code: '',
  active: true,
  base: 'consent-only',
  formIds: [],
};

// ── Edit dialog ──────────────────────────────────────────────────────────────

const PackageDialog: FC<{
  open: boolean;
  initial?: PaperworkPackage;
  onClose: () => void;
  onSave: (value: PaperworkPackage) => void;
}> = ({ open, initial, onClose, onSave }) => {
  const [value, setValue] = useState<PaperworkPackage>(initial ?? BLANK_PACKAGE);

  // Reset internal state when the dialog opens with a new initial value.
  // This is a UI-only mockup, so we cheat with a key-based remount in the parent;
  // here we just sync on initial change.
  useMemo(() => {
    setValue(initial ?? BLANK_PACKAGE);
  }, [initial]);

  const bookingUrlPreview = value.code
    ? `https://patient.example.com/book?package=${value.code}`
    : 'https://patient.example.com/book?package=<code>';

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>{initial?.id ? 'Edit paperwork package' : 'New paperwork package'}</DialogTitle>
      <DialogContent>
        <Stack spacing={2.5} sx={{ mt: 1 }}>
          <TextField
            label="Name"
            placeholder="e.g. 90 Minute Massage"
            value={value.name}
            onChange={(e) => setValue({ ...value, name: e.target.value })}
            fullWidth
          />
          <TextField
            label="Code"
            placeholder="kebab-case, e.g. massage-90"
            value={value.code}
            onChange={(e) => setValue({ ...value, code: e.target.value })}
            helperText="Used in the booking URL and Appointment.serviceCategory."
            fullWidth
          />
          <FormControlLabel
            control={
              <Switch checked={value.active} onChange={(e) => setValue({ ...value, active: e.target.checked })} />
            }
            label="Active (offered for booking)"
          />

          <Box>
            <Typography variant="subtitle2" sx={{ mb: 1 }}>
              Paperwork
            </Typography>
            <Stack spacing={2}>
              <FormControl fullWidth>
                <InputLabel id="base-paperwork-label">Base paperwork</InputLabel>
                <Select
                  labelId="base-paperwork-label"
                  label="Base paperwork"
                  value={value.base}
                  onChange={(e) => setValue({ ...value, base: e.target.value as BaseCanonical })}
                >
                  {BASE_PAPERWORK_OPTIONS.map((opt) => (
                    <MenuItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>

              <FormControl fullWidth>
                <InputLabel id="practice-forms-label">Practice forms</InputLabel>
                <Select
                  labelId="practice-forms-label"
                  multiple
                  value={value.formIds}
                  onChange={(e) =>
                    setValue({
                      ...value,
                      formIds: typeof e.target.value === 'string' ? e.target.value.split(',') : e.target.value,
                    })
                  }
                  input={<OutlinedInput label="Practice forms" />}
                  renderValue={(selected) =>
                    (selected as string[])
                      .map((id) => PRACTICE_FORM_OPTIONS.find((f) => f.id === id)?.label ?? id)
                      .join(', ')
                  }
                >
                  {PRACTICE_FORM_OPTIONS.map((opt) => (
                    <MenuItem key={opt.id} value={opt.id}>
                      <Checkbox checked={value.formIds.includes(opt.id)} />
                      <ListItemText primary={opt.label} />
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Stack>
          </Box>

          <Box>
            <Typography variant="subtitle2" sx={{ mb: 0.5 }}>
              Booking URL preview
            </Typography>
            <Paper
              variant="outlined"
              sx={{ p: 1, fontFamily: 'monospace', fontSize: 13, color: 'text.secondary', wordBreak: 'break-all' }}
            >
              {bookingUrlPreview}
            </Paper>
          </Box>
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="contained" onClick={() => onSave(value)} disabled={!value.name || !value.code}>
          Save
        </Button>
      </DialogActions>
    </Dialog>
  );
};

// ── List page ────────────────────────────────────────────────────────────────

const PaperworkPackagesAdminPage: FC = () => {
  const [packages, setPackages] = useState<PaperworkPackage[]>(SAMPLE_PACKAGES);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<PaperworkPackage | undefined>(undefined);

  const openNew = (): void => {
    setEditing(undefined);
    setDialogOpen(true);
  };

  const openEdit = (pkg: PaperworkPackage): void => {
    setEditing(pkg);
    setDialogOpen(true);
  };

  const handleSave = (saved: PaperworkPackage): void => {
    setPackages((prev) => {
      if (saved.id) {
        return prev.map((p) => (p.id === saved.id ? saved : p));
      }
      return [...prev, { ...saved, id: `pkg-${Date.now()}` }];
    });
    setDialogOpen(false);
  };

  const handleDelete = (id: string): void => {
    setPackages((prev) => prev.filter((p) => p.id !== id));
  };

  const baseLabel = (b: BaseCanonical): string => BASE_PAPERWORK_OPTIONS.find((o) => o.value === b)?.label ?? b;

  return (
    <Box sx={{ p: 3 }}>
      <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1 }}>
        <Typography variant="h4">Paperwork Packages</Typography>
        <Button variant="contained" startIcon={<AddIcon />} onClick={openNew}>
          New package
        </Button>
      </Stack>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3, maxWidth: 720 }}>
        A paperwork package bundles a base intake flow with one or more practice-managed forms into a single bookable
        visit type. Patients booking this package see the base intake (or just consent, for the lite flow) followed by
        the selected practice forms, then the standard consent and review screens.
      </Typography>

      <TableContainer component={Paper} variant="outlined">
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell sx={{ fontWeight: 600 }}>Package</TableCell>
              <TableCell sx={{ fontWeight: 600 }}>Code</TableCell>
              <TableCell sx={{ fontWeight: 600 }}>Base paperwork</TableCell>
              <TableCell sx={{ fontWeight: 600 }}>Practice forms</TableCell>
              <TableCell sx={{ fontWeight: 600 }}>Status</TableCell>
              <TableCell sx={{ fontWeight: 600, width: 1 }} align="right">
                Actions
              </TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {packages.map((pkg) => (
              <TableRow key={pkg.id} hover>
                <TableCell>
                  <Typography variant="body2" fontWeight={500}>
                    {pkg.name}
                  </Typography>
                </TableCell>
                <TableCell>
                  <Box component="code" sx={{ fontFamily: 'monospace', fontSize: 13, color: 'text.secondary' }}>
                    {pkg.code}
                  </Box>
                </TableCell>
                <TableCell>{baseLabel(pkg.base)}</TableCell>
                <TableCell>
                  <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap>
                    {pkg.formIds.length === 0 ? (
                      <Typography variant="body2" color="text.disabled">
                        —
                      </Typography>
                    ) : (
                      pkg.formIds.map((id) => (
                        <Chip
                          key={id}
                          size="small"
                          label={PRACTICE_FORM_OPTIONS.find((f) => f.id === id)?.label ?? id}
                          sx={{ mb: 0.5 }}
                        />
                      ))
                    )}
                  </Stack>
                </TableCell>
                <TableCell>
                  <Chip
                    size="small"
                    label={pkg.active ? 'Active' : 'Inactive'}
                    color={pkg.active ? 'success' : 'default'}
                    variant={pkg.active ? 'filled' : 'outlined'}
                  />
                </TableCell>
                <TableCell align="right">
                  <Tooltip title="Edit">
                    <IconButton size="small" onClick={() => openEdit(pkg)}>
                      <EditIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                  <Tooltip title="Delete">
                    <IconButton size="small" onClick={() => handleDelete(pkg.id)}>
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      <Typography variant="caption" color="text.disabled" sx={{ display: 'block', mt: 2 }}>
        Mockup only — not wired to any backend. State resets on page reload.
      </Typography>

      <PackageDialog
        key={editing?.id ?? 'new'}
        open={dialogOpen}
        initial={editing}
        onClose={() => setDialogOpen(false)}
        onSave={handleSave}
      />
    </Box>
  );
};

export default PaperworkPackagesAdminPage;
