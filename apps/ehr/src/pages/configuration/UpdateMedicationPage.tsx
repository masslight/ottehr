import { LoadingButton } from '@mui/lab';
import { Autocomplete, debounce, Grid, Paper, TextField, Typography } from '@mui/material';
import { Medication } from 'fhir/r4b';
import { ReactElement, useCallback, useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { getInHouseMedications, updateInHouseMedication } from 'src/api/api';
import CustomBreadcrumbs from 'src/components/CustomBreadcrumbs';
import Loading from 'src/components/Loading';
import {
  useGetCPTHCPCSSearch,
  useGetMedicationsSearch,
} from 'src/features/visits/shared/stores/appointment/appointment.queries';
import { useApiClients } from 'src/hooks/useAppClients';
import PageContainer from 'src/layout/PageContainer';
import {
  CODE_SYSTEM_CPT,
  CODE_SYSTEM_HCPCS,
  CODE_SYSTEM_NDC,
  CPTCodeDTO,
  getMedicationName,
  MEDICATION_DISPENSABLE_DRUG_ID,
  MEDICATION_IDENTIFIER_NAME_SYSTEM,
} from 'utils';

function getMedispanId(medication: Medication): string | undefined {
  return medication.code?.coding?.find((c) => c.system === MEDICATION_DISPENSABLE_DRUG_ID)?.code;
}

function updateMedicationName(medication: Medication | null, newName: string): Medication | null {
  if (medication == null) return null;
  const otherIdentifiers = (medication?.identifier ?? []).filter((i) => i.system !== MEDICATION_IDENTIFIER_NAME_SYSTEM);
  return {
    ...medication,
    identifier: [...otherIdentifiers, { system: MEDICATION_IDENTIFIER_NAME_SYSTEM, value: newName }],
  };
}

export default function UpdateMedicationPage(): ReactElement {
  const { oystehrZambda } = useApiClients();
  const medicationId = useParams()['medication-id'];
  const [loading, setLoading] = useState<boolean>(false);
  const [medication, setMedication] = useState<Medication | null>(null);
  const [cptCodes, setCptCodes] = useState<CPTCodeDTO[]>([]);
  const [hcpcsCodes, setHcpcsCodes] = useState<CPTCodeDTO[]>([]);
  const [cptDirty, setCptDirty] = useState(false);
  const [hcpcsDirty, setHcpcsDirty] = useState(false);
  const [status, setStatus] = useState<string>('');
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('');
  const [debouncedCptSearch, setDebouncedCptSearch] = useState('');
  const [debouncedHcpcsSearch, setDebouncedHcpcsSearch] = useState('');

  const { isFetching: isSearching, data } = useGetMedicationsSearch(debouncedSearchTerm);
  const medicationOptions: Medication[] = (data?.filter((option) => !option.isObsolete) ?? []).map((option) => ({
    resourceType: 'Medication',
    identifier: [
      {
        system: MEDICATION_IDENTIFIER_NAME_SYSTEM,
        value: `${option.name}${option.strength ? ` (${option.strength})` : ''}`,
      },
    ],
    code: {
      coding: [
        { system: MEDICATION_DISPENSABLE_DRUG_ID, code: option.id.toString() },
        ...(option.ndc ? [{ system: CODE_SYSTEM_NDC, code: option.ndc }] : []),
      ],
    },
  }));

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

  useEffect(() => {
    async function fetchMedication(): Promise<void> {
      if (!oystehrZambda) {
        return;
      }
      const medicationsTemp = await getInHouseMedications(oystehrZambda);
      const medicationTemp = medicationsTemp.find((temp) => temp.id === medicationId);
      setMedication(medicationTemp ?? null);
      setStatus(medicationTemp?.status ? medicationTemp.status : 'active');
      setCptCodes(
        (medicationTemp?.code?.coding ?? [])
          .filter((c) => c.system === CODE_SYSTEM_CPT)
          .map((c) => ({ code: c.code ?? '', display: c.display ?? '' }))
      );
      setHcpcsCodes(
        (medicationTemp?.code?.coding ?? [])
          .filter((c) => c.system === CODE_SYSTEM_HCPCS)
          .map((c) => ({ code: c.code ?? '', display: c.display ?? '' }))
      );
    }
    fetchMedication().catch((error) => console.log('Error fetching medications', error));
  }, [medicationId, oystehrZambda]);

  async function update(event: any): Promise<void> {
    event.preventDefault();
    if (!oystehrZambda || !medication?.id) {
      return;
    }
    setLoading(true);

    const name = medication ? getMedicationName(medication) : '';
    const ndc = medication?.code?.coding?.find((c) => c.system === CODE_SYSTEM_NDC)?.code;
    const medispanID = medication ? getMedispanId(medication) : undefined;
    const finalCptCodes =
      cptDirty || cptCodes.length > 0 ? cptCodes.map(({ code, display }) => ({ code, display })) : undefined;
    const finalHcpcsCodes =
      hcpcsDirty || hcpcsCodes.length > 0 ? hcpcsCodes.map(({ code, display }) => ({ code, display })) : undefined;

    try {
      await updateInHouseMedication(oystehrZambda, {
        medicationID: medication.id,
        name,
        ndc,
        medispanID,
        ...(finalCptCodes !== undefined && { cptCodes: finalCptCodes }),
        ...(finalHcpcsCodes !== undefined && { hcpcsCodes: finalHcpcsCodes }),
      });
    } catch (error) {
      console.log('Error updating medication', error);
    }
    setLoading(false);
  }

  async function updateStatus(status: string): Promise<void> {
    if (!oystehrZambda || !medication?.id) {
      return;
    }
    setLoading(true);

    try {
      const medicationTemp = await updateInHouseMedication(oystehrZambda, {
        medicationID: medication.id,
        status,
      });
      setStatus(medicationTemp.status || '');
    } catch (error) {
      console.log('Error updating medication', error);
    }
    setLoading(false);
  }

  if (!medication) {
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
                  getOptionLabel={(option) => (typeof option === 'string' ? option : getMedicationName(option) || '')}
                  fullWidth
                  isOptionEqualToValue={(option, value) => getMedispanId(option) === getMedispanId(value)}
                  loading={isSearching}
                  disableClearable
                  disablePortal
                  freeSolo
                  clearOnBlur={false}
                  noOptionsText={
                    debouncedSearchTerm && debouncedSearchTerm.length > 2 && medicationOptions.length === 0
                      ? 'Nothing found for this search criteria'
                      : 'Start typing to load results'
                  }
                  options={medicationOptions}
                  // onChange string and onInputChange input are for renaming
                  onChange={(_e, value) => {
                    if (typeof value === 'string') {
                      setMedication((prev) => updateMedicationName(prev, value));
                    } else {
                      setMedication(value);
                    }
                  }}
                  onInputChange={(_e, value, reason) => {
                    if (reason === 'input') {
                      setMedication((prev) => updateMedicationName(prev, value));
                      debouncedHandleInputChange(value);
                    }
                  }}
                  renderInput={(params) => (
                    <TextField
                      {...params}
                      label="Name"
                      required
                      onChange={(e) => debouncedHandleInputChange(e.target.value)}
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
                  onChange={(_e, value) => {
                    setCptCodes(value);
                    setCptDirty(true);
                  }}
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
                  onChange={(_e, value) => {
                    setHcpcsCodes(value);
                    setHcpcsDirty(true);
                  }}
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
