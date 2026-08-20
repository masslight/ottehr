import AddIcon from '@mui/icons-material/Add';
import CloseIcon from '@mui/icons-material/Close';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import EditIcon from '@mui/icons-material/Edit';
import {
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  IconButton,
  MenuItem,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
  useTheme,
} from '@mui/material';
import { enqueueSnackbar } from 'notistack';
import { ReactElement, useCallback, useEffect, useMemo, useState } from 'react';
import {
  createInsuranceQuickPick,
  getInsuranceQuickPicks,
  removeQuickPick,
  updateInsuranceQuickPick,
} from 'src/api/api';
import { RoundedButton } from 'src/components/RoundedButton';
import { useApiClients } from 'src/hooks/useAppClients';
import { VALUE_SETS } from 'utils/lib/ottehr-config/value-sets';
import { InsuranceQuickPickData, InsuranceQuickPickMetadataEntry } from 'utils/lib/types/api/quick-picks.types';
import { InsuranceSearchField } from './InsuranceSearchField';

// Mirror the mapping the patient insurance form uses (packages/utils/.../patient-record/index.ts) so
// the stored value (candidCode) matches the "Insurance type" choice field when a pick is applied.
const INSURANCE_TYPE_OPTIONS = VALUE_SETS.insuranceTypeOptions.map((option) => ({
  label: `${option.candidCode} - ${option.label}`,
  value: option.candidCode,
}));

const RELATIONSHIP_OPTIONS = VALUE_SETS.relationshipToInsuredOptions;

const insuranceTypeLabel = (candidCode?: string): string =>
  INSURANCE_TYPE_OPTIONS.find((option) => option.value === candidCode)?.label ?? candidCode ?? '';

const relationshipLabel = (value?: string): string =>
  RELATIONSHIP_OPTIONS.find((option) => option.value === value)?.label ?? value ?? '';

interface EditorState {
  name: string;
  organizationDisplay: string;
  organizationReference: string;
  payerId: string;
  insuranceType: string;
  relationship: string;
  metadata: InsuranceQuickPickMetadataEntry[];
}

const emptyState = (): EditorState => ({
  name: '',
  organizationDisplay: '',
  organizationReference: '',
  payerId: '',
  insuranceType: '',
  relationship: '',
  metadata: [],
});

const toEditorState = (item: InsuranceQuickPickData): EditorState => ({
  name: item.name,
  organizationDisplay: item.organizationDisplay ?? '',
  organizationReference: item.organizationReference,
  payerId: item.payerId,
  insuranceType: item.insuranceType ?? '',
  relationship: item.relationship ?? '',
  metadata: item.metadata ? item.metadata.map((entry) => ({ ...entry })) : [],
});

const buildQuickPick = (state: EditorState): Omit<InsuranceQuickPickData, 'id'> => {
  const metadata = state.metadata
    .map((entry) => ({ key: entry.key.trim(), value: entry.value.trim() }))
    .filter((entry) => entry.key.length > 0);
  return {
    name: state.name.trim(),
    payerId: state.payerId,
    organizationReference: state.organizationReference,
    organizationDisplay: state.organizationDisplay,
    ...(state.insuranceType ? { insuranceType: state.insuranceType } : {}),
    ...(state.relationship ? { relationship: state.relationship } : {}),
    ...(metadata.length ? { metadata } : {}),
  };
};

export default function InsuranceQuickPickPage(): ReactElement {
  const theme = useTheme();
  const { oystehrZambda } = useApiClients();

  const [items, setItems] = useState<InsuranceQuickPickData[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | undefined>(undefined);
  const [state, setState] = useState<EditorState>(emptyState());

  const loadItems = useCallback(async () => {
    if (!oystehrZambda) return;
    setLoading(true);
    try {
      const response = await getInsuranceQuickPicks(oystehrZambda);
      setItems(response.quickPicks);
    } catch (error) {
      console.error('Failed to fetch insurance quick picks:', error);
      enqueueSnackbar('Failed to load insurance quick picks', { variant: 'error' });
    } finally {
      setLoading(false);
    }
  }, [oystehrZambda]);

  useEffect(() => {
    void loadItems();
  }, [loadItems]);

  const sortedItems = useMemo(
    () => [...items].sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })),
    [items]
  );

  const openAddDialog = (): void => {
    setEditingId(undefined);
    setState(emptyState());
    setDialogOpen(true);
  };

  const openEditDialog = (item: InsuranceQuickPickData): void => {
    setEditingId(item.id);
    setState(toEditorState(item));
    setDialogOpen(true);
  };

  const patchState = (patch: Partial<EditorState>): void => setState((prev) => ({ ...prev, ...patch }));

  const updateMetadata = (index: number, patch: Partial<InsuranceQuickPickMetadataEntry>): void =>
    setState((prev) => ({
      ...prev,
      metadata: prev.metadata.map((entry, i) => (i === index ? { ...entry, ...patch } : entry)),
    }));

  const addMetadataRow = (): void =>
    setState((prev) => ({ ...prev, metadata: [...prev.metadata, { key: '', value: '' }] }));

  const removeMetadataRow = (index: number): void =>
    setState((prev) => ({ ...prev, metadata: prev.metadata.filter((_, i) => i !== index) }));

  const handleSave = async (): Promise<void> => {
    if (!oystehrZambda) return;
    if (!state.name.trim()) {
      enqueueSnackbar('Name is required', { variant: 'warning' });
      return;
    }
    if (!state.organizationReference || !state.organizationDisplay) {
      enqueueSnackbar('Insurance is required', { variant: 'warning' });
      return;
    }

    setSaving(true);
    try {
      const data = buildQuickPick(state);
      if (editingId) {
        await updateInsuranceQuickPick(oystehrZambda, editingId, data);
        enqueueSnackbar('Insurance quick pick updated', { variant: 'success' });
      } else {
        await createInsuranceQuickPick(oystehrZambda, { quickPick: data });
        enqueueSnackbar('Insurance quick pick created', { variant: 'success' });
      }
      setDialogOpen(false);
      await loadItems();
    } catch (error) {
      console.error('Failed to save insurance quick pick:', error);
      enqueueSnackbar('Failed to save insurance quick pick', { variant: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (item: InsuranceQuickPickData): Promise<void> => {
    if (!oystehrZambda || !item.id) return;
    try {
      await removeQuickPick(oystehrZambda, item.id);
      enqueueSnackbar('Insurance quick pick removed', { variant: 'success' });
      await loadItems();
    } catch (error) {
      console.error('Failed to remove insurance quick pick:', error);
      enqueueSnackbar('Failed to remove insurance quick pick', { variant: 'error' });
    }
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3 }}>
      <Box sx={{ mb: 3, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <Box>
          <Typography variant="h6" sx={{ fontWeight: 600 }}>
            Insurance Quick Picks
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
            Create named presets that fill the insurance carrier, insurance type, and relationship to insured at once
            when selecting a patient's insurance.
          </Typography>
        </Box>
        <Button variant="contained" startIcon={<AddIcon />} onClick={openAddDialog} size="small">
          Add
        </Button>
      </Box>

      {sortedItems.length === 0 ? (
        <Paper sx={{ p: 4, textAlign: 'center' }}>
          <Typography color="text.secondary">No quick picks configured yet.</Typography>
        </Paper>
      ) : (
        <TableContainer component={Paper}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell sx={{ fontWeight: 600 }}>Name</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>Insurance</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>Type</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>Relationship</TableCell>
                <TableCell sx={{ fontWeight: 600, width: 100 }}>Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {sortedItems.map((item, index) => (
                <TableRow key={item.id ?? `item-${index}`} hover>
                  <TableCell>{item.name || '-'}</TableCell>
                  <TableCell>{item.organizationDisplay || '-'}</TableCell>
                  <TableCell>{item.insuranceType ? insuranceTypeLabel(item.insuranceType) : '-'}</TableCell>
                  <TableCell>{item.relationship ? relationshipLabel(item.relationship) : '-'}</TableCell>
                  <TableCell>
                    <IconButton size="small" onClick={() => openEditDialog(item)} title="Edit">
                      <EditIcon fontSize="small" />
                    </IconButton>
                    <IconButton
                      size="small"
                      onClick={() => {
                        if (window.confirm(`Remove quick pick "${item.name}"?`)) {
                          void handleDelete(item);
                        }
                      }}
                      title="Remove"
                      sx={{ color: theme.palette.error.main }}
                    >
                      <DeleteOutlineIcon fontSize="small" />
                    </IconButton>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      <Dialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        maxWidth="sm"
        fullWidth
        PaperProps={{ sx: { borderRadius: 2 } }}
      >
        <DialogTitle
          sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', px: 3, pt: 3, pb: 1 }}
        >
          <Typography variant="h4" component="span" color="primary.dark" sx={{ fontWeight: 600 }}>
            {editingId ? 'Edit Quick Pick' : 'Add Quick Pick'}
          </Typography>
          <IconButton onClick={() => setDialogOpen(false)} size="small" disabled={saving}>
            <CloseIcon />
          </IconButton>
        </DialogTitle>
        <DialogContent sx={{ px: 3, pt: 1, pb: 1 }}>
          <TextField
            label="Name"
            value={state.name}
            onChange={(e) => patchState({ name: e.target.value })}
            fullWidth
            required
            autoFocus
            placeholder="e.g. Nomastin PPO"
            sx={{ mt: 1 }}
          />

          <Box sx={{ mt: 2 }}>
            <InsuranceSearchField
              value={state.organizationDisplay}
              onChange={(value) => patchState({ organizationDisplay: value })}
              onExtraData={(data) =>
                patchState({
                  payerId: data.payerId ?? '',
                  organizationReference: data.organizationReference ?? '',
                  organizationDisplay: data.organizationDisplay ?? state.organizationDisplay,
                })
              }
            />
          </Box>

          <TextField
            select
            label="Insurance type"
            value={state.insuranceType}
            onChange={(e) => patchState({ insuranceType: e.target.value })}
            fullWidth
            sx={{ mt: 2 }}
            helperText="Optional — leave as “None” to keep the patient's current insurance type."
          >
            <MenuItem value="">— None (leave unchanged) —</MenuItem>
            {INSURANCE_TYPE_OPTIONS.map((option) => (
              <MenuItem key={option.value} value={option.value}>
                {option.label}
              </MenuItem>
            ))}
          </TextField>

          <TextField
            select
            label="Relationship to insured"
            value={state.relationship}
            onChange={(e) => patchState({ relationship: e.target.value })}
            fullWidth
            sx={{ mt: 2 }}
            helperText="Optional — leave as “None” to keep the patient's current relationship."
          >
            <MenuItem value="">— None (leave unchanged) —</MenuItem>
            {RELATIONSHIP_OPTIONS.map((option) => (
              <MenuItem key={option.value} value={option.value}>
                {option.label}
              </MenuItem>
            ))}
          </TextField>

          <Divider sx={{ mt: 3, mb: 1 }} />
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
              Metadata (optional)
            </Typography>
            <Button size="small" startIcon={<AddIcon />} onClick={addMetadataRow} sx={{ textTransform: 'none' }}>
              Add metadata
            </Button>
          </Box>
          {state.metadata.length === 0 ? (
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5, mb: 1 }}>
              Optional key/value pairs stored on this quick pick (e.g. MCO string matches).
            </Typography>
          ) : (
            state.metadata.map((entry, index) => (
              <Box key={index} sx={{ display: 'flex', gap: 1, alignItems: 'center', mt: 1 }}>
                <TextField
                  label="Key"
                  value={entry.key}
                  onChange={(e) => updateMetadata(index, { key: e.target.value })}
                  size="small"
                  sx={{ flex: 1 }}
                />
                <TextField
                  label="Value"
                  value={entry.value}
                  onChange={(e) => updateMetadata(index, { value: e.target.value })}
                  size="small"
                  sx={{ flex: 1 }}
                />
                <IconButton
                  size="small"
                  onClick={() => removeMetadataRow(index)}
                  title="Remove metadata"
                  sx={{ color: theme.palette.error.main }}
                >
                  <DeleteOutlineIcon fontSize="small" />
                </IconButton>
              </Box>
            ))
          )}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 3, pt: 2 }}>
          <RoundedButton onClick={() => setDialogOpen(false)} disabled={saving}>
            Cancel
          </RoundedButton>
          <RoundedButton variant="contained" onClick={() => void handleSave()} disabled={saving}>
            {saving ? <CircularProgress size={20} /> : editingId ? 'Save' : 'Add'}
          </RoundedButton>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
