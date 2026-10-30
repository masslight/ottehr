import AddIcon from '@mui/icons-material/Add';
import ArrowDownwardIcon from '@mui/icons-material/ArrowDownward';
import ArrowUpwardIcon from '@mui/icons-material/ArrowUpward';
import CloseIcon from '@mui/icons-material/Close';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import EditIcon from '@mui/icons-material/Edit';
import {
  Autocomplete,
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  FormHelperText,
  IconButton,
  Paper,
  Radio,
  RadioGroup,
  Stack,
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
import { DateTime } from 'luxon';
import { enqueueSnackbar } from 'notistack';
import { ReactElement, useState } from 'react';
import { BooleanStateChip } from 'src/components/BooleanStateChip';
import { ConfirmationDialog } from 'src/components/ConfirmationDialog';
import { RoundedButton } from 'src/components/RoundedButton';
import { nameTaken } from 'src/features/visits/in-person/components/erx/prescriptionLines';
import { prescriptionSetMembers } from 'src/features/visits/in-person/components/erx/prescriptionSuggestions';
import { getApiError } from 'utils/lib/helpers/oystehrApi';
import {
  PRESCRIPTION_SET_STATUSES,
  PrescriptionQuickPickData,
  PrescriptionSetQuickPickData,
  PrescriptionSetRemovedMember,
  PrescriptionSetStatus,
} from 'utils/lib/types/api/quick-picks.types';
import {
  usePrescriptionQuickPicksQuery,
  usePrescriptionSetQuickPicksQuery,
  useRemovePrescriptionSetQuickPickMutation,
  useSavePrescriptionSetQuickPickMutation,
} from './admin.queries';
import { prescriptionQuickPickDoseText } from './PrescriptionQuickPicksPage';

/** "Amox otitis was removed (10/27/2026)", the date in the browser's time zone. */
export const removedMemberText = ({ name, removedAt }: PrescriptionSetRemovedMember): string =>
  `${name} was removed (${DateTime.fromISO(removedAt).toLocaleString(DateTime.DATE_SHORT)})`;

interface SetFormErrors {
  name?: string;
  members?: string;
}

export default function PrescriptionSetsPage(): ReactElement {
  const theme = useTheme();
  const { data: sets = [], isLoading } = usePrescriptionSetQuickPicksQuery();
  const { data: quickPicks = [], isLoading: quickPicksLoading } = usePrescriptionQuickPicksQuery();
  const saveMutation = useSavePrescriptionSetQuickPickMutation();
  const removeMutation = useRemovePrescriptionSetQuickPickMutation();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<PrescriptionSetQuickPickData | null>(null);
  const [name, setName] = useState('');
  const [status, setStatus] = useState<PrescriptionSetStatus>('Active');
  const [members, setMembers] = useState<PrescriptionQuickPickData[]>([]);
  const [search, setSearch] = useState('');
  const [errors, setErrors] = useState<SetFormErrors>({});
  const saving = saveMutation.isPending;

  const openDialog = (item: PrescriptionSetQuickPickData | null): void => {
    setEditingItem(item);
    setName(item?.name ?? '');
    setStatus(item?.status ?? 'Active');
    setMembers(item ? prescriptionSetMembers(item, quickPicks).members : []);
    setSearch('');
    setErrors({});
    setDialogOpen(true);
  };

  const move = (from: number, to: number): void =>
    setMembers((current) => {
      const next = [...current];
      [next[from], next[to]] = [next[to], next[from]];
      return next;
    });

  // Saving clears the notes of removed quick picks: the set has been reviewed.
  const handleSave = (): void => {
    const nextErrors: SetFormErrors = {
      ...(!name.trim()
        ? { name: 'Name is required' }
        : nameTaken(name, sets, editingItem?.id)
        ? { name: `A prescription set named "${name.trim()}" already exists` }
        : {}),
      ...(members.length ? {} : { members: 'Add at least one prescription quick pick' }),
    };
    setErrors(nextErrors);
    if (nextErrors.name || nextErrors.members) return;
    saveMutation.mutate(
      {
        id: editingItem?.id,
        quickPick: {
          name: name.trim(),
          status,
          memberIds: members.flatMap((member) => (member.id ? [member.id] : [])),
        },
      },
      {
        onSuccess: () => {
          enqueueSnackbar(editingItem ? 'Prescription set updated' : 'Prescription set created', {
            variant: 'success',
          });
          setDialogOpen(false);
        },
        onError: (error) => {
          console.error('Failed to save prescription set:', error);
          enqueueSnackbar(getApiError({ error, defaultError: 'Failed to save prescription set' }), {
            variant: 'error',
          });
        },
      }
    );
  };

  const handleDelete = async (item: PrescriptionSetQuickPickData): Promise<void> => {
    if (!item.id) return;
    try {
      await removeMutation.mutateAsync(item.id);
      enqueueSnackbar('Prescription set removed', { variant: 'success' });
    } catch (error) {
      console.error('Failed to remove prescription set:', error);
      enqueueSnackbar('Failed to remove prescription set', { variant: 'error' });
    }
  };

  if (isLoading || quickPicksLoading) {
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
            Prescription Sets
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
            Group prescription quick picks that are ordered together. Active sets appear on the eRx order form; each
            prescription keeps its quick pick&apos;s dosing.
          </Typography>
        </Box>
        <Button variant="contained" startIcon={<AddIcon />} onClick={() => openDialog(null)} size="small">
          Add
        </Button>
      </Box>

      {sets.length === 0 ? (
        <Paper sx={{ p: 4, textAlign: 'center' }}>
          <Typography color="text.secondary">No prescription sets configured yet.</Typography>
        </Paper>
      ) : (
        <TableContainer component={Paper}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell sx={{ fontWeight: 600 }}>Name</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>Prescriptions</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>Status</TableCell>
                <TableCell sx={{ fontWeight: 600, width: 100 }}>Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {sets.map((item, index) => (
                <TableRow key={item.id ?? `item-${index}`} hover>
                  <TableCell>{item.name}</TableCell>
                  <TableCell>
                    {prescriptionSetMembers(item, quickPicks).members.map((member) => (
                      <Box key={member.id}>{member.name}</Box>
                    ))}
                  </TableCell>
                  <TableCell>
                    <BooleanStateChip label={item.status} state={item.status === 'Active'} />
                    {item.removedMembers?.map((removed) => (
                      <Typography
                        key={`${removed.name}-${removed.removedAt}`}
                        variant="caption"
                        color="warning.dark"
                        sx={{ display: 'block', mt: 0.5 }}
                      >
                        {removedMemberText(removed)}
                      </Typography>
                    ))}
                  </TableCell>
                  <TableCell>
                    <IconButton size="small" onClick={() => openDialog(item)} title="Edit">
                      <EditIcon fontSize="small" />
                    </IconButton>
                    <ConfirmationDialog
                      title={`Remove Prescription Set "${item.name}"?`}
                      response={() => handleDelete(item)}
                      actionButtons={{ proceed: { text: 'Remove', color: 'error' }, back: { text: 'Cancel' } }}
                    >
                      {(showDialog) => (
                        <IconButton
                          size="small"
                          onClick={showDialog}
                          title="Remove"
                          sx={{ color: theme.palette.error.main }}
                        >
                          <DeleteOutlineIcon fontSize="small" />
                        </IconButton>
                      )}
                    </ConfirmationDialog>
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
          sx={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            px: 3,
            pt: 3,
            pb: 1,
          }}
        >
          <Typography variant="h4" component="span" color="primary.dark" sx={{ fontWeight: 600 }}>
            {editingItem ? 'Edit Prescription Set' : 'Add Prescription Set'}
          </Typography>
          <IconButton onClick={() => setDialogOpen(false)} size="small" disabled={saving}>
            <CloseIcon />
          </IconButton>
        </DialogTitle>
        <DialogContent sx={{ px: 3, pt: 1, pb: 1 }}>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField
              fullWidth
              required
              autoFocus
              label="Name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              error={!!errors.name}
              helperText={errors.name}
            />

            <RadioGroup row value={status} onChange={(e) => setStatus(e.target.value as PrescriptionSetStatus)}>
              {PRESCRIPTION_SET_STATUSES.map((option) => (
                <FormControlLabel key={option} value={option} control={<Radio />} label={option} />
              ))}
            </RadioGroup>

            <Box>
              <Typography variant="body2" color={errors.members ? 'error' : 'text.secondary'} sx={{ mb: 1 }}>
                Prescriptions
              </Typography>
              <Stack spacing={1}>
                {members.map((member, i) => (
                  <Paper
                    key={member.id}
                    variant="outlined"
                    data-testid="prescription-set-member"
                    sx={{ p: 1, display: 'flex', alignItems: 'center', gap: 1 }}
                  >
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Typography variant="body2" sx={{ fontWeight: 600 }}>
                        {member.name}
                      </Typography>
                      <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                        {member.medicationDescription || '-'}
                      </Typography>
                      <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                        {prescriptionQuickPickDoseText(member) || '-'}
                      </Typography>
                    </Box>
                    <IconButton
                      size="small"
                      aria-label={`Move ${member.name} up`}
                      disabled={i === 0}
                      onClick={() => move(i, i - 1)}
                    >
                      <ArrowUpwardIcon fontSize="small" />
                    </IconButton>
                    <IconButton
                      size="small"
                      aria-label={`Move ${member.name} down`}
                      disabled={i === members.length - 1}
                      onClick={() => move(i, i + 1)}
                    >
                      <ArrowDownwardIcon fontSize="small" />
                    </IconButton>
                    <IconButton
                      size="small"
                      aria-label={`Remove ${member.name}`}
                      onClick={() => setMembers((current) => current.filter((_, j) => j !== i))}
                    >
                      <CloseIcon fontSize="small" />
                    </IconButton>
                  </Paper>
                ))}
              </Stack>
              <Autocomplete<PrescriptionQuickPickData>
                options={quickPicks.filter((quickPick) => !members.some((member) => member.id === quickPick.id))}
                getOptionLabel={(option) => option.name}
                renderOption={(props, option) => (
                  <li {...props} key={option.id}>
                    <Box>
                      <Typography variant="body2">{option.name}</Typography>
                      <Typography variant="caption" color="text.secondary">
                        {option.medicationDescription}
                      </Typography>
                    </Box>
                  </li>
                )}
                value={null}
                inputValue={search}
                onInputChange={(_event, value, reason) => reason === 'input' && setSearch(value)}
                onChange={(_event, option) => {
                  if (option) setMembers((current) => [...current, option]);
                  setSearch('');
                }}
                noOptionsText="No prescription quick picks"
                renderInput={(params) => (
                  <TextField {...params} size="small" label="Add a prescription quick pick" sx={{ mt: 1 }} />
                )}
              />
              {errors.members && <FormHelperText error>{errors.members}</FormHelperText>}
            </Box>
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 3, pt: 2 }}>
          <RoundedButton onClick={() => setDialogOpen(false)} disabled={saving}>
            Cancel
          </RoundedButton>
          <RoundedButton variant="contained" onClick={handleSave} disabled={saving}>
            {saving ? <CircularProgress size={20} /> : editingItem ? 'Save' : 'Add'}
          </RoundedButton>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
