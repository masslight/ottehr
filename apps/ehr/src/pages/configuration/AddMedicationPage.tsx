import { LoadingButton } from '@mui/lab';
import { Autocomplete, debounce, Grid, TextField, Typography } from '@mui/material';
import { ErxSearchMedicationsResponse } from '@oystehr/sdk';
import { ReactElement, useCallback, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { createInHouseMedication } from 'src/api/api';
import CustomBreadcrumbs from 'src/components/CustomBreadcrumbs';
import {
  ExtractObjectType,
  useGetCPTHCPCSSearch,
  useGetMedicationsSearch,
} from 'src/features/visits/shared/stores/appointment/appointment.queries';
import { useApiClients } from 'src/hooks/useAppClients';
import PageContainer from 'src/layout/PageContainer';
import { CPTCodeDTO } from 'utils';

export default function AddMedicationPage(): ReactElement {
  const { oystehrZambda } = useApiClients();
  const [loading, setLoading] = useState<boolean>(false);
  const [selectedMedication, setSelectedMedication] = useState<ExtractObjectType<ErxSearchMedicationsResponse> | null>(
    null
  );
  const [cptCodes, setCptCodes] = useState<CPTCodeDTO[]>([]);
  const [hcpcsCodes, setHcpcsCodes] = useState<CPTCodeDTO[]>([]);
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('');
  const [debouncedCptSearch, setDebouncedCptSearch] = useState('');
  const [debouncedHcpcsSearch, setDebouncedHcpcsSearch] = useState('');
  const navigate = useNavigate();

  const { isFetching: isSearching, data } = useGetMedicationsSearch(debouncedSearchTerm);
  const medSearchOptions = data?.filter((option) => !option.isObsolete) || [];

  const { isFetching: isCptSearching, data: cptData } = useGetCPTHCPCSSearch({
    search: debouncedCptSearch,
    type: 'cpt',
  });
  const { isFetching: isHcpcsSearching, data: hcpcsData } = useGetCPTHCPCSSearch({
    search: debouncedHcpcsSearch,
    type: 'hcpcs',
  });
  const cptOptions = (cptData as { codes?: CPTCodeDTO[] })?.codes ?? [];
  const hcpcsOptions = (hcpcsData as { codes?: CPTCodeDTO[] })?.codes ?? [];

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
  const debouncedHandleCptInputChange = useCallback(
    debounce((value: string) => setDebouncedCptSearch(value), 800),
    []
  );

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const debouncedHandleHcpcsInputChange = useCallback(
    debounce((value: string) => setDebouncedHcpcsSearch(value), 800),
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
    const finalCptCodes = cptCodes.map(({ code, display }) => ({ code, display }));
    const finalHcpcsCodes = hcpcsCodes.map(({ code, display }) => ({ code, display }));

    try {
      const medicationTemp = await createInHouseMedication(oystehrZambda, {
        name,
        ndc,
        medispanID,
        cptCodes: finalCptCodes.length ? finalCptCodes : undefined,
        hcpcsCodes: finalHcpcsCodes.length ? finalHcpcsCodes : undefined,
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
                    label="Name"
                    placeholder="Search"
                    required
                  />
                )}
              />
            </Grid>
            <Grid item xs={6} />
            <Grid item xs={6}>
              <Autocomplete
                multiple
                options={cptOptions}
                value={cptCodes}
                loading={isCptSearching}
                getOptionLabel={(option) => (option.display ? `${option.code} ${option.display}` : option.code)}
                isOptionEqualToValue={(option, value) => option.code === value.code}
                onChange={(_e, value) => setCptCodes(value)}
                onInputChange={(_e, value) => debouncedHandleCptInputChange(value)}
                noOptionsText={
                  debouncedCptSearch ? 'Nothing found for this search criteria' : 'Start typing to load results'
                }
                renderInput={(params) => <TextField {...params} label="CPT" />}
              />
            </Grid>
            <Grid item xs={6} />
            <Grid item xs={6}>
              <Autocomplete
                multiple
                options={hcpcsOptions}
                value={hcpcsCodes}
                loading={isHcpcsSearching}
                getOptionLabel={(option) => (option.display ? `${option.code} ${option.display}` : option.code)}
                isOptionEqualToValue={(option, value) => option.code === value.code}
                onChange={(_e, value) => setHcpcsCodes(value)}
                onInputChange={(_e, value) => debouncedHandleHcpcsInputChange(value)}
                noOptionsText={
                  debouncedHcpcsSearch ? 'Nothing found for this search criteria' : 'Start typing to load results'
                }
                renderInput={(params) => <TextField {...params} label="HCPCS" />}
              />
            </Grid>
            <Grid item xs={6} />
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
