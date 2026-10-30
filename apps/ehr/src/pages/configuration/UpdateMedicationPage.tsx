import { LoadingButton } from '@mui/lab';
import {
  Alert,
  Autocomplete,
  debounce,
  FormControl,
  FormControlLabel,
  FormLabel,
  Grid,
  InputAdornment,
  InputLabel,
  MenuItem,
  Paper,
  Radio,
  RadioGroup,
  Select,
  TextField,
  Typography,
} from '@mui/material';
import { Medication } from 'fhir/r4b';
import { enqueueSnackbar } from 'notistack';
import { ReactElement, useCallback, useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { getInHouseMedications, updateInHouseMedication } from 'src/api/api';
import CustomBreadcrumbs from 'src/components/CustomBreadcrumbs';
import ReceiveShipmentDialog from 'src/components/dialogs/ReceiveShipmentDialog';
import Loading from 'src/components/Loading';
import { dataTestIds } from 'src/constants/data-test-ids';
import { useGetAllLocations } from 'src/features/notifications/notifications.queries';
import {
  MEDICATION_DATABASE_FORBIDDEN_MESSAGE,
  useGetMedicationDetails,
  useGetMedicationsSearch,
} from 'src/features/visits/shared/stores/appointment/appointment.queries';
import { isErxPermissionDeniedError } from 'src/features/visits/shared/utils/erxErrors';
import { useApiClients } from 'src/hooks/useAppClients';
import useEvolveUser from 'src/hooks/useEvolveUser';
import PageContainer from 'src/layout/PageContainer';
import {
  getMedicationName,
  IN_HOUSE_MEDICATION_UNIT_OPTIONS,
  MedicationUnitOptions,
} from 'utils/lib/fhir/medication-administration';
import { getMedicationInventoryConfig } from 'utils/lib/fhir/medication-inventory';
import { CODE_SYSTEM_NDC } from 'utils/lib/helpers/rcm/constants';
import {
  InHouseMedicationInventory,
  MEDICATION_COUNTED_AS_LABELS,
  MEDICATION_COUNTED_AS_OPTIONS,
  MEDICATION_USE_LABELS,
  MEDICATION_USE_OPTIONS,
  MedicationCountedAs,
  MedicationUse,
} from 'utils/lib/types/api/config/in-house-medications';
import {
  MEDICATION_DISPENSABLE_DRUG_ID,
  MEDICATION_DISPENSABLE_DRUG_ID_FOR_INTERACTIONS,
} from 'utils/lib/types/api/medication-administration.constants';
import { ADMIN_TIER_ROLES } from 'utils/lib/types/api/user.types';

function getMedispanId(medication: Medication | null): string | undefined {
  return medication?.code?.coding?.find((c) => c.system === MEDICATION_DISPENSABLE_DRUG_ID)?.code;
}
function getMedispanIdForInteractions(medication: Medication | null): string | undefined {
  return medication?.code?.coding?.find((c) => c.system === MEDICATION_DISPENSABLE_DRUG_ID_FOR_INTERACTIONS)?.code;
}

interface MedicationOption {
  id: number;
  name: string;
  ndc?: string | null;
  strength?: string;
  route?: string;
  doseForm?: string;
  isObsolete: boolean;
}

// Inventory fields as typed; numbers stay strings so a cleared input is "blank", not 0.
interface InventoryFormState {
  countedAs: MedicationCountedAs | '';
  eachContainsAmount: string;
  eachContainsUnit: MedicationUnitOptions | '';
  inAmount: string;
  inUnit: MedicationUnitOptions | '';
  use: MedicationUse;
  reorderLevels: Record<string, string>;
}

const EMPTY_INVENTORY_FORM: InventoryFormState = {
  countedAs: '',
  eachContainsAmount: '',
  eachContainsUnit: '',
  inAmount: '',
  inUnit: '',
  use: 'single-use',
  reorderLevels: {},
};

function toInventoryFormState(medication: Medication): InventoryFormState {
  const inventory = getMedicationInventoryConfig(medication);
  if (!inventory) return EMPTY_INVENTORY_FORM;
  return {
    countedAs: inventory.countedAs,
    eachContainsAmount: String(inventory.eachContains.amount),
    eachContainsUnit: inventory.eachContains.unit,
    inAmount: inventory.eachContains.in ? String(inventory.eachContains.in.amount) : '',
    inUnit: inventory.eachContains.in?.unit ?? '',
    use: inventory.use,
    reorderLevels: Object.fromEntries(
      inventory.reorderLevels.map(({ locationId, level }) => [locationId, String(level)])
    ),
  };
}

// Blank counted-as means "not tracked" (null clears any saved setup). Otherwise the form's required fields
// cover what the zambda's schema needs, but `type="number"` inputs can't require a positive value, so the
// caller checks that first.
function toInventoryInput(form: InventoryFormState, locationIds: string[]): InHouseMedicationInventory | null {
  if (!form.countedAs || !form.eachContainsUnit) return null;
  return {
    countedAs: form.countedAs,
    eachContains: {
      amount: Number(form.eachContainsAmount),
      unit: form.eachContainsUnit,
      ...(form.inUnit ? { in: { amount: Number(form.inAmount), unit: form.inUnit } } : {}),
    },
    use: form.use,
    reorderLevels: locationIds
      .filter((locationId) => form.reorderLevels[locationId]?.trim())
      .map((locationId) => ({ locationId, level: Number(form.reorderLevels[locationId]) })),
  };
}

export default function UpdateMedicationPage(): ReactElement {
  const { oystehrZambda } = useApiClients();
  // Staff reach this page to receive shipments; the catalog entry and inventory setup stay admin-tier.
  const canEditSetup = useEvolveUser()?.hasRole(ADMIN_TIER_ROLES) ?? false;
  const medicationId = useParams()['medication-id'];
  const [loading, setLoading] = useState<boolean>(false);
  const [medication, setMedication] = useState<Medication | null>(null);
  const [selectedMedicationForPrecheck, setSelectedMedicationForPrecheck] = useState<MedicationOption | null>(null);
  const [status, setStatus] = useState<string>('');
  const [debouncedSearchTermForPrecheck, setDebouncedSearchTermForPrecheck] = useState('');
  const [inventoryForm, setInventoryForm] = useState<InventoryFormState>(EMPTY_INVENTORY_FORM);
  const [receiveOpen, setReceiveOpen] = useState(false);
  const { data: clinics = [] } = useGetAllLocations({ inPersonOnly: true });
  const setInventoryField = <K extends keyof InventoryFormState>(field: K, value: InventoryFormState[K]): void =>
    setInventoryForm((prev) => ({ ...prev, [field]: value }));

  const medispanId = getMedispanId(medication);
  const {
    isFetching: isSearching,
    data: medicationDetails,
    error: medicationDetailsError,
  } = useGetMedicationDetails(medispanId ? parseInt(medispanId, 10) : 0);
  const medispanIdForInteractions = getMedispanIdForInteractions(medication);
  const {
    isFetching: isFetchingDetailsForInteractions,
    data: medicationForInteractionsDetails,
    error: interactionsDetailsError,
  } = useGetMedicationDetails(medispanIdForInteractions ? parseInt(medispanIdForInteractions, 10) : 0);
  const { isFetching: isFetchingForPrecheck, data: dataForPrecheck } =
    useGetMedicationsSearch(debouncedSearchTermForPrecheck);
  const isSearchingForPrecheck = isFetchingDetailsForInteractions || isFetchingForPrecheck;
  const nonObsoleteMedSearchOptions: MedicationOption[] = useMemo(
    () =>
      dataForPrecheck
        ? dataForPrecheck?.filter((option) => !option.isObsolete)
        : medicationForInteractionsDetails
        ? [medicationForInteractionsDetails]
        : [],
    [medicationForInteractionsDetails, dataForPrecheck]
  );

  useEffect(() => {
    if (medispanIdForInteractions) {
      setSelectedMedicationForPrecheck(
        nonObsoleteMedSearchOptions.find((med) => med.id === parseInt(medispanIdForInteractions, 10)) ?? null
      );
    }
  }, [medication, nonObsoleteMedSearchOptions, medispanIdForInteractions]);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const debouncedHandleInputChangeForPrecheck = useCallback(
    debounce((value: string) => {
      if (value.length > 2) {
        setDebouncedSearchTermForPrecheck(value);
      }
    }, 800),
    []
  );

  useEffect(() => {
    async function fetchMedication(): Promise<void> {
      if (!oystehrZambda) {
        return;
      }
      const medicationsTemp = await getInHouseMedications(oystehrZambda);
      const medicationTemp = medicationsTemp.find((temp) => temp.id === medicationId);
      setMedication(medicationTemp ?? null);
      setStatus(medicationTemp?.status ? medicationTemp.status : 'active');
      setInventoryForm(medicationTemp ? toInventoryFormState(medicationTemp) : EMPTY_INVENTORY_FORM);
    }
    fetchMedication().catch((error) => console.log('Error fetching medications', error));
  }, [medicationId, oystehrZambda]);

  async function update(event: any): Promise<void> {
    event.preventDefault();
    if (!oystehrZambda || !medicationId) {
      return;
    }
    if (
      inventoryForm.countedAs &&
      (!(Number(inventoryForm.eachContainsAmount) > 0) ||
        (inventoryForm.inUnit && !(Number(inventoryForm.inAmount) > 0)))
    ) {
      enqueueSnackbar('Each contains must be more than 0 to track inventory', { variant: 'error' });
      return;
    }
    setLoading(true);

    const name = medication ? getMedicationName(medication) : '';
    const ndc = medication?.code?.coding?.find((c) => c.system === CODE_SYSTEM_NDC)?.code;
    const medispanID = medication ? getMedispanId(medication) : undefined;
    const medispanIDForInteractions = selectedMedicationForPrecheck?.id.toString() || undefined;

    try {
      const updated = await updateInHouseMedication(oystehrZambda, {
        medicationID: medicationId,
        name,
        ndc,
        medispanID,
        medispanIDForInteractions,
        inventory: toInventoryInput(
          inventoryForm,
          clinics.map((clinic) => clinic.id)
        ),
      });
      setMedication(updated);
      enqueueSnackbar('Medication updated successfully', { variant: 'success' });
    } catch (error) {
      console.log('Error updating medication', error);
      enqueueSnackbar('Failed to update medication', { variant: 'error' });
    }
    setLoading(false);
  }

  async function updateStatus(newStatus: string): Promise<void> {
    if (!oystehrZambda || !medication?.id) {
      return;
    }
    setLoading(true);

    try {
      const medicationTemp = await updateInHouseMedication(oystehrZambda, {
        medicationID: medication.id,
        status: newStatus,
      });
      setStatus(medicationTemp.status || '');
      enqueueSnackbar(
        newStatus === 'active' ? 'Medication activated successfully' : 'Medication removed successfully',
        {
          variant: 'success',
        }
      );
    } catch (error) {
      console.log('Error updating medication', error);
      enqueueSnackbar(newStatus === 'active' ? 'Failed to activate medication' : 'Failed to remove medication', {
        variant: 'error',
      });
    }
    setLoading(false);
  }

  if (!medication || isSearching || isFetchingDetailsForInteractions) {
    return <Loading />;
  }

  // The drug details come from the eRx reference database. When they can't be loaded the obsolete-medication
  // remap field can't be shown, and submitting the form would clear the stored interactions Medispan ID — so
  // explain why and block the update rather than rendering a spinner forever (the old behaviour).
  const medicationDatabaseError = medicationDetailsError ?? interactionsDetailsError;
  const blockingNotice = isErxPermissionDeniedError(medicationDatabaseError)
    ? `${MEDICATION_DATABASE_FORBIDDEN_MESSAGE} Medication details cannot be loaded, so this medication cannot be updated.`
    : medicationDatabaseError
    ? 'The medication database could not be reached, so this medication cannot be updated right now. Please try again in a few moments.'
    : !medicationDetails
    ? 'Drug details for this medication could not be loaded, so it cannot be updated. Check that it has a Medispan ID.'
    : null;
  // Receiving needs the saved setup (counted-as unit), not what is typed in the form above.
  const savedInventory = getMedicationInventoryConfig(medication);

  return (
    <PageContainer>
      <>
        <CustomBreadcrumbs
          chain={[
            { link: '/admin', children: 'Admin' },
            { link: '/admin/medications', children: 'Medications' },
            { link: '#', children: 'Update medication' },
          ]}
        />
        <Paper sx={{ padding: 2 }}>
          <form onSubmit={update}>
            <Grid container spacing={2}>
              <Grid item xs={12}>
                <Typography variant="h4">Update medication</Typography>
              </Grid>
              {blockingNotice ? (
                <Grid item xs={12}>
                  <Alert severity="warning" data-testid={dataTestIds.updateMedicationPage.medicationDatabaseAlert}>
                    {blockingNotice}
                  </Alert>
                </Grid>
              ) : null}
              <Grid item xs={6}>
                <Autocomplete
                  value={medication}
                  getOptionLabel={() => getMedicationName(medication) ?? ''}
                  fullWidth
                  isOptionEqualToValue={(option, value) => getMedispanId(option) === getMedispanId(value)}
                  loading={isSearching}
                  disableClearable
                  disabled={true}
                  disablePortal
                  noOptionsText={'Start typing to load results'}
                  options={[medication]}
                  onChange={(_e, _value) => {}}
                  renderInput={(params) => (
                    <TextField
                      {...params}
                      label="Medication Name"
                      placeholder="Search"
                      required
                      onChange={(_e) => {}}
                    />
                  )}
                />
              </Grid>
              <Grid item xs={6} />
              {medicationDetails?.isObsolete === true ? (
                <>
                  <Grid item xs={6}>
                    <Autocomplete
                      value={selectedMedicationForPrecheck}
                      getOptionLabel={(option) =>
                        `${option.name}${option.route ? ` ${option.route}` : ''}${
                          option.doseForm ? ` ${option.doseForm}` : ''
                        }${option.strength ? ` (${option.strength})` : ''}`
                      }
                      fullWidth
                      isOptionEqualToValue={(option, value) => value.id === option.id}
                      loading={isSearchingForPrecheck}
                      disablePortal
                      noOptionsText={
                        debouncedSearchTermForPrecheck &&
                        debouncedSearchTermForPrecheck.length > 2 &&
                        nonObsoleteMedSearchOptions.length === 0
                          ? 'Nothing found for this search criteria'
                          : 'Start typing to load results'
                      }
                      options={nonObsoleteMedSearchOptions}
                      onChange={(_e, value) => setSelectedMedicationForPrecheck(value)}
                      renderInput={(params) => (
                        <TextField
                          {...params}
                          label="Medication Name for Interactions"
                          placeholder="Search"
                          required
                          onChange={(e) => debouncedHandleInputChangeForPrecheck(e.target.value)}
                        />
                      )}
                    />
                  </Grid>
                  <Grid item xs={6} />
                </>
              ) : (
                <></>
              )}
              <Grid item xs={12}>
                <Typography variant="h6" color="primary.dark">
                  Inventory
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {canEditSetup
                    ? 'Leave blank to not track stock for this medication. Its medication card then works as today.'
                    : 'Only an administrator or manager can change the inventory setup.'}
                </Typography>
              </Grid>
              <Grid item xs={3}>
                <FormControl fullWidth>
                  <InputLabel id="inventory-counted-as-label">Counting unit</InputLabel>
                  <Select
                    labelId="inventory-counted-as-label"
                    label="Counting unit"
                    disabled={!canEditSetup}
                    value={inventoryForm.countedAs}
                    onChange={(e) => setInventoryField('countedAs', e.target.value as MedicationCountedAs | '')}
                  >
                    <MenuItem value="">
                      <em>Not tracked</em>
                    </MenuItem>
                    {MEDICATION_COUNTED_AS_OPTIONS.map((option) => (
                      <MenuItem key={option} value={option}>
                        {MEDICATION_COUNTED_AS_LABELS[option].singular}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={3} sx={{ display: 'flex', gap: 1 }}>
                <TextField
                  label="Each contains"
                  type="number"
                  inputProps={{ min: 0, step: 'any' }}
                  required={Boolean(inventoryForm.countedAs)}
                  disabled={!canEditSetup || !inventoryForm.countedAs}
                  value={inventoryForm.eachContainsAmount}
                  onChange={(e) => setInventoryField('eachContainsAmount', e.target.value)}
                  sx={{ flex: 1 }}
                />
                <FormControl sx={{ flex: 1 }} required={Boolean(inventoryForm.countedAs)}>
                  <InputLabel id="inventory-each-contains-unit-label">Unit</InputLabel>
                  <Select
                    labelId="inventory-each-contains-unit-label"
                    label="Unit"
                    required={Boolean(inventoryForm.countedAs)}
                    disabled={!canEditSetup || !inventoryForm.countedAs}
                    value={inventoryForm.eachContainsUnit}
                    onChange={(e) => setInventoryField('eachContainsUnit', e.target.value as MedicationUnitOptions)}
                  >
                    {IN_HOUSE_MEDICATION_UNIT_OPTIONS.map((option) => (
                      <MenuItem key={option.value} value={option.value}>
                        {option.label}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={3} sx={{ display: 'flex', gap: 1 }}>
                <TextField
                  label={inventoryForm.inUnit ? 'In' : 'In (optional)'}
                  type="number"
                  inputProps={{ min: 0, step: 'any' }}
                  required={Boolean(inventoryForm.inUnit)}
                  disabled={!canEditSetup || !inventoryForm.countedAs}
                  value={inventoryForm.inAmount}
                  onChange={(e) => setInventoryField('inAmount', e.target.value)}
                  sx={{ flex: 1 }}
                />
                <FormControl sx={{ flex: 1 }} required={Boolean(inventoryForm.inAmount)}>
                  <InputLabel id="inventory-in-unit-label">Unit</InputLabel>
                  <Select
                    labelId="inventory-in-unit-label"
                    label="Unit"
                    required={Boolean(inventoryForm.inAmount)}
                    disabled={!canEditSetup || !inventoryForm.countedAs}
                    value={inventoryForm.inUnit}
                    onChange={(e) => setInventoryField('inUnit', e.target.value as MedicationUnitOptions | '')}
                  >
                    <MenuItem value="">
                      <em>None</em>
                    </MenuItem>
                    {IN_HOUSE_MEDICATION_UNIT_OPTIONS.map((option) => (
                      <MenuItem key={option.value} value={option.value}>
                        {option.label}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={3}>
                <FormControl disabled={!canEditSetup || !inventoryForm.countedAs}>
                  <FormLabel id="inventory-use-label">Use</FormLabel>
                  <RadioGroup
                    aria-labelledby="inventory-use-label"
                    value={inventoryForm.use}
                    onChange={(e) => setInventoryField('use', e.target.value as MedicationUse)}
                  >
                    {MEDICATION_USE_OPTIONS.map((option) => (
                      <FormControlLabel
                        key={option}
                        value={option}
                        control={<Radio size="small" />}
                        label={MEDICATION_USE_LABELS[option]}
                      />
                    ))}
                  </RadioGroup>
                </FormControl>
              </Grid>
              <Grid item xs={12}>
                <Typography variant="subtitle2" color="primary.dark">
                  Reorder level per clinic
                </Typography>
              </Grid>
              {clinics.map((clinic) => (
                <Grid item xs={4} key={clinic.id}>
                  <TextField
                    fullWidth
                    size="small"
                    label={clinic.name}
                    placeholder="none"
                    type="number"
                    inputProps={{ min: 0, step: 1 }}
                    disabled={!canEditSetup || !inventoryForm.countedAs}
                    value={inventoryForm.reorderLevels[clinic.id] ?? ''}
                    onChange={(e) =>
                      setInventoryField('reorderLevels', {
                        ...inventoryForm.reorderLevels,
                        [clinic.id]: e.target.value,
                      })
                    }
                    InputLabelProps={{ shrink: true }}
                    InputProps={{
                      endAdornment: (
                        <InputAdornment position="end">
                          {inventoryForm.countedAs ? MEDICATION_COUNTED_AS_LABELS[inventoryForm.countedAs].plural : ''}
                        </InputAdornment>
                      ),
                    }}
                  />
                </Grid>
              ))}
              {canEditSetup ? (
                <Grid item xs={12}>
                  <LoadingButton
                    type="submit"
                    variant="contained"
                    loading={loading}
                    disabled={Boolean(blockingNotice)}
                    sx={{ textTransform: 'none', borderRadius: 50, fontWeight: 'bold' }}
                  >
                    Update Medication
                  </LoadingButton>
                </Grid>
              ) : null}
            </Grid>
          </form>
        </Paper>

        {savedInventory && medication.id ? (
          <Paper sx={{ padding: 2, marginTop: 2 }}>
            <Typography variant="h4">Receive shipment</Typography>
            <Typography variant="body1">Add a lot of this medication to a clinic's stock.</Typography>
            <LoadingButton
              variant="contained"
              sx={{ marginTop: 2, textTransform: 'none', borderRadius: 50, fontWeight: 'bold' }}
              onClick={() => setReceiveOpen(true)}
            >
              Receive Shipment
            </LoadingButton>
            {receiveOpen ? (
              <ReceiveShipmentDialog
                open={receiveOpen}
                onClose={() => setReceiveOpen(false)}
                medication={medication as Medication & { id: string }}
                inventory={savedInventory}
                clinics={clinics}
              />
            ) : null}
          </Paper>
        ) : null}

        {canEditSetup ? (
          <Paper sx={{ padding: 2, marginTop: 2 }}>
            <Typography variant="h4">{status === 'active' ? 'Remove' : 'Activate'} medication</Typography>
            <Typography variant="body1">
              {status === 'active'
                ? 'Removing this medication will make it so it can no longer be ordered for a visit. It will not affect any medications that have already been ordered.'
                : 'Activating this medication will add it to the list of in-house medications that can be ordered for a visit.'}
            </Typography>
            <LoadingButton
              variant="contained"
              color={status === 'active' ? 'error' : 'success'}
              sx={{ marginTop: 2, textTransform: 'none', borderRadius: 50, fontWeight: 'bold' }}
              onClick={() => updateStatus(status === 'active' ? 'inactive' : 'active')}
              loading={loading}
            >
              {status === 'active' ? 'Remove' : 'Activate'} Medication
            </LoadingButton>
          </Paper>
        ) : null}
      </>
    </PageContainer>
  );
}
