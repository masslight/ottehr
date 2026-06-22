import { LoadingButton } from '@mui/lab';
import { Autocomplete, debounce, Grid, TextField, Typography } from '@mui/material';
import { ErxSearchMedicationsResponse } from '@oystehr/sdk';
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

  async function create(event: any): Promise<void> {
    event.preventDefault();
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
      <>
        <CustomBreadcrumbs
          chain={[
            { link: '/admin', children: 'Admin' },
            { link: '/admin/medications', children: 'Medications' },
            { link: '#', children: 'Add medication' },
          ]}
        />
        <form onSubmit={create}>
          <Grid container spacing={2} paddingTop={2}>
            <Grid item xs={12}>
              <Typography variant="h4">Add medication</Typography>
            </Grid>
            <Grid item xs={6}>
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
            <Grid item xs={6} />
            {selectedMedication?.isObsolete === true ? (
              <>
                <Grid item xs={6}>
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
                sx={{ textTransform: 'none', borderRadius: 28, fontWeight: 'bold' }}
              >
                Create Medication
              </LoadingButton>
            </Grid>
          </Grid>
        </form>
      </>
    </PageContainer>
  );
}
