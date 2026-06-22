import { LoadingButton } from '@mui/lab';
import { Autocomplete, debounce, Grid, Paper, TextField, Typography } from '@mui/material';
import { Medication } from 'fhir/r4b';
import { enqueueSnackbar } from 'notistack';
import { ReactElement, useCallback, useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { getInHouseMedications, updateInHouseMedication } from 'src/api/api';
import CustomBreadcrumbs from 'src/components/CustomBreadcrumbs';
import Loading from 'src/components/Loading';
import {
  useGetMedicationDetails,
  useGetMedicationsSearch,
} from 'src/features/visits/shared/stores/appointment/appointment.queries';
import { useApiClients } from 'src/hooks/useAppClients';
import PageContainer from 'src/layout/PageContainer';
import {
  CODE_SYSTEM_NDC,
  getMedicationName,
  MEDICATION_DISPENSABLE_DRUG_ID,
  MEDICATION_DISPENSABLE_DRUG_ID_FOR_INTERACTIONS,
} from 'utils';

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

export default function UpdateMedicationPage(): ReactElement {
  const { oystehrZambda } = useApiClients();
  const medicationId = useParams()['medication-id'];
  const [loading, setLoading] = useState<boolean>(false);
  const [medication, setMedication] = useState<Medication | null>(null);
  const [selectedMedicationForPrecheck, setSelectedMedicationForPrecheck] = useState<MedicationOption | null>(null);
  const [status, setStatus] = useState<string>('');
  const [debouncedSearchTermForPrecheck, setDebouncedSearchTermForPrecheck] = useState('');

  const medispanId = getMedispanId(medication);
  const { isFetching: isSearching, data: medicationDetails } = useGetMedicationDetails(
    medispanId ? parseInt(medispanId, 10) : 0
  );
  const medispanIdForInteractions = getMedispanIdForInteractions(medication);
  const { isFetching: isFetchingDetailsForInteractions, data: medicationForInteractionsDetails } =
    useGetMedicationDetails(medispanIdForInteractions ? parseInt(medispanIdForInteractions, 10) : 0);
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
    }
    fetchMedication().catch((error) => console.log('Error fetching medications', error));
  }, [medicationId, oystehrZambda]);

  async function update(event: any): Promise<void> {
    event.preventDefault();
    if (!oystehrZambda || !medicationId) {
      return;
    }
    setLoading(true);

    const name = medication ? getMedicationName(medication) : '';
    const ndc = medication?.code?.coding?.find((c) => c.system === CODE_SYSTEM_NDC)?.code;
    const medispanID = medication ? getMedispanId(medication) : undefined;
    const medispanIDForInteractions = selectedMedicationForPrecheck?.id.toString() || undefined;

    try {
      await updateInHouseMedication(oystehrZambda, {
        medicationID: medicationId,
        name,
        ndc,
        medispanID,
        medispanIDForInteractions,
      });
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

  if (!medication || !medicationDetails) {
    return <Loading />;
  }

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
                <LoadingButton
                  type="submit"
                  variant="contained"
                  loading={loading}
                  sx={{ textTransform: 'none', borderRadius: 50, fontWeight: 'bold' }}
                >
                  Update Medication
                </LoadingButton>
              </Grid>
            </Grid>
          </form>
        </Paper>

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
      </>
    </PageContainer>
  );
}
