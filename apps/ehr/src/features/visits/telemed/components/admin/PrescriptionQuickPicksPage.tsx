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
  FormControlLabel,
  IconButton,
  Link,
  MenuItem,
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
import { enqueueSnackbar } from 'notistack';
import React, { ReactElement, useState } from 'react';
import { ConfirmationDialog } from 'src/components/ConfirmationDialog';
import { RoundedButton } from 'src/components/RoundedButton';
import { productOf, quickPickDosingSummary } from 'src/features/visits/in-person/components/erx/prescriptionLines';
import { MedicationSearch } from 'src/features/visits/in-person/components/erx/PrescriptionSentences';
import { DOSE_BASES, DoseBasis } from 'utils/lib/helpers/medications/plain-dose';
import { getApiError } from 'utils/lib/helpers/oystehrApi';
import { MedicationSearchDrug } from 'utils/lib/types/api/erx-search.types';
import { QUANTITY_UNITS, QuantityUnit } from 'utils/lib/types/api/order-prescription.types';
import { PrescriptionQuickPickData } from 'utils/lib/types/api/quick-picks.types';
import {
  usePrescriptionQuickPicksQuery,
  useRemovePrescriptionQuickPickMutation,
  useSavePrescriptionQuickPickMutation,
} from './admin.queries';
import {
  BASIS_LABELS,
  dosesPerDayOf,
  emptyPrescriptionQuickPickForm,
  FREQUENCY_OPTIONS,
  PrescriptionDoseMode,
  PrescriptionQuickPickFormErrors,
  PrescriptionQuickPickFormValues,
  prescriptionQuickPickFormValues,
  prescriptionQuickPickFromForm,
} from './prescriptionQuickPickForm';

/** The list's Dose column: the dosing's summary, or the directions as written. */
export const prescriptionQuickPickDoseText = (quickPick: PrescriptionQuickPickData): string =>
  quickPick.dosing ? quickPickDosingSummary(quickPick.dosing) : quickPick.patientInstructions ?? '';

export default function PrescriptionQuickPicksPage(): ReactElement {
  const theme = useTheme();
  const { data: quickPicks = [], isLoading } = usePrescriptionQuickPicksQuery();
  const saveMutation = useSavePrescriptionQuickPickMutation();
  const removeMutation = useRemovePrescriptionQuickPickMutation();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<PrescriptionQuickPickData | null>(null);
  const [values, setValues] = useState<PrescriptionQuickPickFormValues>(emptyPrescriptionQuickPickForm);
  const [errors, setErrors] = useState<PrescriptionQuickPickFormErrors>({});
  // The drug picked in this dialog, for its strengths; an existing product has none until searched again.
  const [drug, setDrug] = useState<MedicationSearchDrug | null>(null);
  const saving = saveMutation.isPending;

  const openDialog = (item: PrescriptionQuickPickData | null): void => {
    setEditingItem(item);
    setValues(item ? prescriptionQuickPickFormValues(item) : emptyPrescriptionQuickPickForm());
    setErrors({});
    setDrug(null);
    setDialogOpen(true);
  };

  const set = (patch: Partial<PrescriptionQuickPickFormValues>): void => setValues((prev) => ({ ...prev, ...patch }));

  const handleSave = (): void => {
    const result = prescriptionQuickPickFromForm(values);
    if (result.errors) {
      setErrors(result.errors);
      return;
    }
    setErrors({});
    saveMutation.mutate(
      { id: editingItem?.id, quickPick: result.quickPick },
      {
        onSuccess: () => {
          enqueueSnackbar(editingItem ? 'Quick pick updated' : 'Quick pick created', { variant: 'success' });
          setDialogOpen(false);
        },
        onError: (error) => {
          console.error('Failed to save quick pick:', error);
          enqueueSnackbar(getApiError({ error, defaultError: 'Failed to save quick pick' }), { variant: 'error' });
        },
      }
    );
  };

  const handleDelete = async (item: PrescriptionQuickPickData): Promise<void> => {
    if (!item.id) return;
    try {
      await removeMutation.mutateAsync(item.id);
      enqueueSnackbar('Quick pick removed', { variant: 'success' });
    } catch (error) {
      console.error('Failed to remove quick pick:', error);
      enqueueSnackbar('Failed to remove quick pick', { variant: 'error' });
    }
  };

  const field = (
    key: keyof PrescriptionQuickPickFormValues,
    label: string,
    props: React.ComponentProps<typeof TextField> = {}
  ): ReactElement => (
    <TextField
      fullWidth
      {...props}
      label={label}
      value={values[key]}
      onChange={(e) => set({ [key]: e.target.value })}
      error={!!errors[key]}
      helperText={errors[key] ?? props.helperText}
    />
  );

  if (isLoading) {
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
            Prescription Quick Picks
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
            Manage prescriptions that appear as quick picks and suggestions on the eRx order form. Quick picks can also
            be saved from the order form.
          </Typography>
        </Box>
        <Button variant="contained" startIcon={<AddIcon />} onClick={() => openDialog(null)} size="small">
          Add
        </Button>
      </Box>

      {quickPicks.length === 0 ? (
        <Paper sx={{ p: 4, textAlign: 'center' }}>
          <Typography color="text.secondary">No quick picks configured yet.</Typography>
        </Paper>
      ) : (
        <TableContainer component={Paper}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell sx={{ fontWeight: 600 }}>Name</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>Product</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>Dose</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>Source</TableCell>
                <TableCell sx={{ fontWeight: 600, width: 100 }}>Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {quickPicks.map((item, index) => (
                <TableRow key={item.id ?? `item-${index}`} hover>
                  <TableCell>{item.name}</TableCell>
                  <TableCell>{item.medicationDescription || '-'}</TableCell>
                  <TableCell>{prescriptionQuickPickDoseText(item) || '-'}</TableCell>
                  <TableCell>
                    {item.source ? (
                      item.source.url ? (
                        <Link href={item.source.url} target="_blank" rel="noopener noreferrer">
                          {item.source.label}
                        </Link>
                      ) : (
                        item.source.label
                      )
                    ) : (
                      '-'
                    )}
                  </TableCell>
                  <TableCell>
                    <IconButton size="small" onClick={() => openDialog(item)} title="Edit">
                      <EditIcon fontSize="small" />
                    </IconButton>
                    <ConfirmationDialog
                      title={`Remove Quick Pick "${item.name}"?`}
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
            {editingItem ? 'Edit Quick Pick' : 'Add Quick Pick'}
          </Typography>
          <IconButton onClick={() => setDialogOpen(false)} size="small" disabled={saving}>
            <CloseIcon />
          </IconButton>
        </DialogTitle>
        <DialogContent sx={{ px: 3, pt: 1, pb: 1 }}>
          <Stack spacing={2} sx={{ mt: 1 }}>
            {field('name', 'Name', { required: true, autoFocus: true })}

            <Box>
              <Typography variant="body2" color={errors.ndc ? 'error' : 'text.secondary'}>
                Product: {values.medicationDescription || 'none'}
              </Typography>
              <MedicationSearch
                width="100%"
                onPick={(picked) => {
                  setDrug(picked);
                  set({ ndc: '', medicationDescription: '' });
                }}
              />
              {drug && (
                <TextField
                  select
                  label="Strength"
                  value={drug.strengths.find((option) => option.ndcs[0] === values.ndc)?.strength ?? ''}
                  onChange={(e) => {
                    const strength = drug.strengths.find((option) => option.strength === e.target.value);
                    if (!strength) return;
                    const product = productOf(drug, strength);
                    set({ ndc: product.ndc, medicationDescription: product.description });
                  }}
                  fullWidth
                  size="small"
                  sx={{ mt: 1 }}
                >
                  {drug.strengths.map((option) => (
                    <MenuItem key={option.strength} value={option.strength}>
                      {option.strength}
                    </MenuItem>
                  ))}
                </TextField>
              )}
              {(errors.ndc || errors.medicationDescription) && (
                <Typography variant="caption" color="error">
                  {errors.ndc ?? errors.medicationDescription}
                </Typography>
              )}
            </Box>

            <RadioGroup
              row
              value={values.doseMode}
              onChange={(e) => set({ doseMode: e.target.value as PrescriptionDoseMode })}
            >
              <FormControlLabel value="as-written" control={<Radio />} label="As written" />
              <FormControlLabel value="dosing" control={<Radio />} label="By weight or fixed dose" />
            </RadioGroup>

            {values.doseMode === 'as-written' ? (
              <>
                {field('patientInstructions', 'Patient instructions', { multiline: true, rows: 3 })}
                <Stack direction="row" spacing={2}>
                  {field('quantityValue', 'Quantity', { type: 'number' })}
                  <TextField
                    select
                    label="Unit"
                    value={values.quantityUnit}
                    onChange={(e) => set({ quantityUnit: e.target.value as QuantityUnit | '' })}
                    error={!!errors.quantityUnit}
                    helperText={errors.quantityUnit}
                    fullWidth
                  >
                    <MenuItem value="">None</MenuItem>
                    {QUANTITY_UNITS.map((unit) => (
                      <MenuItem key={unit} value={unit}>
                        {unit}
                      </MenuItem>
                    ))}
                  </TextField>
                  {field('daysSupply', 'Days supply', { type: 'number' })}
                </Stack>
              </>
            ) : (
              <>
                <Stack direction="row" spacing={2}>
                  {field('rate', 'Dose', { type: 'number', required: true })}
                  <TextField
                    select
                    label="Per"
                    value={values.basis}
                    onChange={(e) => set({ basis: e.target.value as DoseBasis })}
                    fullWidth
                  >
                    {DOSE_BASES.map((basis) => (
                      <MenuItem key={basis} value={basis}>
                        {BASIS_LABELS[basis]}
                      </MenuItem>
                    ))}
                  </TextField>
                </Stack>
                <Stack direction="row" spacing={2}>
                  <TextField
                    select
                    label="Frequency"
                    value={values.frequency}
                    onChange={(e) => {
                      const dosesPerDay = dosesPerDayOf(e.target.value);
                      set({
                        frequency: e.target.value,
                        ...(dosesPerDay !== undefined ? { dosesPerDay: String(dosesPerDay) } : {}),
                      });
                    }}
                    error={!!errors.frequency}
                    helperText={errors.frequency}
                    fullWidth
                  >
                    <MenuItem value="">None</MenuItem>
                    {FREQUENCY_OPTIONS.map((frequency) => (
                      <MenuItem key={frequency} value={frequency}>
                        {frequency}
                      </MenuItem>
                    ))}
                  </TextField>
                  {field('dosesPerDay', 'Doses a day', { type: 'number' })}
                  {field('durationDays', 'Duration (days)', { type: 'number' })}
                </Stack>
                <Stack direction="row" spacing={2}>
                  {field('maxPerDoseMg', 'Max per dose (mg)', { type: 'number' })}
                  {field('maxPerDayMg', 'Max per day (mg)', { type: 'number' })}
                </Stack>
              </>
            )}

            <Stack direction="row" spacing={2}>
              {field('numberOfRefills', 'Refills', { type: 'number' })}
              <TextField
                select
                label="Substitution"
                value={values.substitutionAllowed ? 'allowed' : 'not allowed'}
                onChange={(e) => set({ substitutionAllowed: e.target.value === 'allowed' })}
                fullWidth
              >
                <MenuItem value="allowed">Allowed</MenuItem>
                <MenuItem value="not allowed">Not allowed (dispense as written)</MenuItem>
              </TextField>
            </Stack>
            {field('noteToPharmacy', 'Note to pharmacy', {
              multiline: true,
              rows: 2,
              inputProps: { maxLength: 210 },
              helperText: `${values.noteToPharmacy.length} / 210`,
            })}
            {field('sourceLabel', 'Source (optional)', { placeholder: 'e.g. AAP guideline' })}
            {field('sourceUrl', 'Source link (optional)', { placeholder: 'https://' })}
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
