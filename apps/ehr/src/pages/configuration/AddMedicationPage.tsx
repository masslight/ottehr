import { LoadingButton } from '@mui/lab';
import {
  Autocomplete,
  debounce,
  Grid,
  Paper,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from '@mui/material';
import { ErxSearchMedicationsResponse } from '@oystehr/sdk';
import { enqueueSnackbar } from 'notistack';
import { ReactElement, useCallback, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { createInHouseMedication } from 'src/api/api';
import CustomBreadcrumbs from 'src/components/CustomBreadcrumbs';
import {
  ExtractObjectType,
  useGetMedicationsSearch,
} from 'src/features/visits/shared/stores/appointment/appointment.queries';
import { useApiClients } from 'src/hooks/useAppClients';
import PageContainer from 'src/layout/PageContainer';
import { getApiError } from 'utils/lib/helpers/oystehrApi';
import { CatalogMedicationType } from 'utils/lib/types/api/config/in-house-medications';
import { CVX_VACCINES } from 'utils/lib/types/data/immunization/cvx-vaccines.generated';
import { CvxVaccine } from 'utils/lib/types/data/immunization/vaccine-codes';

export default function AddMedicationPage(): ReactElement {
  const { oystehrZambda } = useApiClients();
  const [loading, setLoading] = useState<boolean>(false);
  const [selectedMedication, setSelectedMedication] = useState<ExtractObjectType<ErxSearchMedicationsResponse> | null>(
    null
  );
  const [selectedMedicationForPrecheck, setSelectedMedicationForPrecheck] =
    useState<ExtractObjectType<ErxSearchMedicationsResponse> | null>(null);
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('');
  const [debouncedSearchTermForPrecheck, setDebouncedSearchTermForPrecheck] = useState('');
  // A vaccine is switched on from the CVX list; the practice picks the ones it gives.
  const [type, setType] = useState<CatalogMedicationType>('medication');
  const [selectedVaccines, setSelectedVaccines] = useState<CvxVaccine[]>([]);
  const navigate = useNavigate();

  const { isFetching: isSearching, data } = useGetMedicationsSearch(debouncedSearchTerm);
  const medSearchOptions = data ?? [];
  const { isFetching: isSearchingForPrecheck, data: dataForPrecheck } =
    useGetMedicationsSearch(debouncedSearchTermForPrecheck);
  const nonObsoleteMedSearchOptions = dataForPrecheck?.filter((option) => !option.isObsolete) || [];

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const debouncedHandleInputChange = useCallback(
    debounce((value: string) => {
      if (value.length > 2) {
        setDebouncedSearchTerm(value);
      }
    }, 800),
    []
  );

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const debouncedHandleInputChangeForPrecheck = useCallback(
    debounce((value: string) => {
      if (value.length > 2) {
        setDebouncedSearchTermForPrecheck(value);
      }
    }, 800),
    []
  );

  async function createVaccines(): Promise<void> {
    if (!oystehrZambda || selectedVaccines.length === 0) return;
    setLoading(true);
    const created: string[] = [];
    try {
      for (const vaccine of selectedVaccines) {
        const medication = await createInHouseMedication(oystehrZambda, { vaccine: { cvx: vaccine.cvx } });
        created.push(medication.id ?? '');
      }
      enqueueSnackbar(created.length === 1 ? 'Vaccine switched on' : `${created.length} vaccines switched on`, {
        variant: 'success',
      });
      navigate(created.length === 1 && created[0] ? `/admin/medication/${created[0]}` : '/admin/medications');
    } catch (error) {
      enqueueSnackbar(
        getApiError({
          error,
          defaultError: created.length
            ? `${created.length} vaccines switched on before an error occurred`
            : 'Failed to add the vaccine',
        }),
        { variant: 'error' }
      );
    } finally {
      setLoading(false);
    }
  }

  async function create(event: any): Promise<void> {
    event.preventDefault();
    if (type === 'vaccine') {
      await createVaccines();
      return;
    }
    if (!oystehrZambda || !selectedMedication) {
      return;
    }
    setLoading(true);

    const name = `${selectedMedication.name}${selectedMedication.strength ? ` (${selectedMedication.strength})` : ''}`;
    const ndc = selectedMedication.ndc ?? undefined;
    const medispanID = selectedMedication.id.toString();
    const medispanIDForInteractions = selectedMedicationForPrecheck?.id.toString() || undefined;

    try {
      const medicationTemp = await createInHouseMedication(oystehrZambda, {
        name,
        ndc,
        medispanID,
        medispanIDForInteractions,
      });
      navigate(`/admin/medication/${medicationTemp.id}`);
    } catch (error) {
      console.log('Error creating medication', error);
    }

    setLoading(false);
  }

  return (
    <PageContainer>
      <Grid container direction="row" alignItems="center" justifyContent="center">
        <Grid item maxWidth={'584px'} width={'100%'}>
          <CustomBreadcrumbs
            chain={[
              { link: '/admin', children: 'Admin' },
              { link: '/admin/medications', children: 'Medications' },
              { link: '#', children: type === 'vaccine' ? 'Add vaccine' : 'Add medication' },
            ]}
          />
          <Paper sx={{ padding: 3, marginTop: 2, marginBottom: 2 }}>
            <form onSubmit={create}>
              <Grid container spacing={2}>
                <Grid item xs={12}>
                  <Typography variant="h4">{type === 'vaccine' ? 'Add vaccine' : 'Add medication'}</Typography>
                </Grid>
                <Grid item xs={12}>
                  <ToggleButtonGroup
                    exclusive
                    size="small"
                    value={type}
                    onChange={(_event, value: CatalogMedicationType | null) => value && setType(value)}
                    aria-label="Type"
                  >
                    <ToggleButton value="medication" sx={{ textTransform: 'none' }}>
                      Medication
                    </ToggleButton>
                    <ToggleButton value="vaccine" sx={{ textTransform: 'none' }}>
                      Vaccine
                    </ToggleButton>
                  </ToggleButtonGroup>
                </Grid>
                {type === 'vaccine' ? (
                  <Grid item xs={12}>
                    <Autocomplete<CvxVaccine, true>
                      multiple
                      value={selectedVaccines}
                      options={CVX_VACCINES}
                      getOptionLabel={(option) => `${option.name} (CVX ${option.cvx})`}
                      isOptionEqualToValue={(option, value) => option.cvx === value.cvx}
                      onChange={(_event, value) => setSelectedVaccines(value)}
                      disablePortal
                      renderInput={(params) => (
                        <TextField
                          {...params}
                          label="Vaccines"
                          placeholder="Type to search the CDC CVX list"
                          helperText="One entry per CVX code. Each is set up for inventory, counted in doses; receive lots on its page."
                          required={selectedVaccines.length === 0}
                        />
                      )}
                    />
                  </Grid>
                ) : (
                  <Grid item xs={12}>
                    <Autocomplete
                      value={selectedMedication}
                      getOptionLabel={(option) => `${option.name}${option.strength ? ` (${option.strength})` : ''}`}
                      fullWidth
                      isOptionEqualToValue={(option, value) => value.id === option.id}
                      loading={isSearching}
                      disablePortal
                      noOptionsText={
                        debouncedSearchTerm && debouncedSearchTerm.length > 2 && medSearchOptions.length === 0
                          ? 'Nothing found for this search criteria'
                          : 'Start typing to load results'
                      }
                      options={medSearchOptions}
                      onChange={(_e, value) => setSelectedMedication(value)}
                      renderInput={(params) => (
                        <TextField
                          {...params}
                          onChange={(e) => debouncedHandleInputChange(e.target.value)}
                          label="Medication Name"
                          placeholder="Search"
                          required
                        />
                      )}
                    />
                  </Grid>
                )}
                {type === 'medication' && selectedMedication?.isObsolete === true && (
                  <Grid item xs={12}>
                    <Autocomplete
                      value={selectedMedicationForPrecheck}
                      getOptionLabel={(option) => `${option.name}${option.strength ? ` (${option.strength})` : ''}`}
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
                          onChange={(e) => debouncedHandleInputChangeForPrecheck(e.target.value)}
                          label="Medication Name for Interactions"
                          placeholder="Search"
                          required
                        />
                      )}
                    />
                  </Grid>
                )}
                <Grid item xs={12}>
                  <LoadingButton
                    type="submit"
                    variant="contained"
                    loading={loading}
                    sx={{ textTransform: 'none', borderRadius: 28, fontWeight: 'bold' }}
                  >
                    {type === 'vaccine'
                      ? selectedVaccines.length > 1
                        ? `Switch On ${selectedVaccines.length} Vaccines`
                        : 'Switch On Vaccine'
                      : 'Create Medication'}
                  </LoadingButton>
                </Grid>
              </Grid>
            </form>
          </Paper>
        </Grid>
      </Grid>
    </PageContainer>
  );
}
