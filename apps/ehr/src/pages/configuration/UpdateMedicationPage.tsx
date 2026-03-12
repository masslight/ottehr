import { LoadingButton } from '@mui/lab';
import { Grid, TextField, Typography } from '@mui/material';
import { Medication } from 'fhir/r4b';
import { ReactElement, useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { getInHouseMedications, updateInHouseMedication } from 'src/api/api';
import CustomBreadcrumbs from 'src/components/CustomBreadcrumbs';
import Loading from 'src/components/Loading';
import { useApiClients } from 'src/hooks/useAppClients';
import PageContainer from 'src/layout/PageContainer';
import { CODE_SYSTEM_NDC, MEDICATION_DISPENSABLE_DRUG_ID, MEDICATION_IDENTIFIER_NAME_SYSTEM } from 'utils';

export default function UpdateMedicationPage(): ReactElement {
  const { oystehrZambda } = useApiClients();
  const medicationId = useParams()['medication-id'];
  const [medication, setMedication] = useState<Medication | undefined>(undefined);
  const [loading, setLoading] = useState<boolean>(false);
  const [name, setName] = useState<string>('');
  const [ndc, setNdc] = useState<string>('');
  const [medispanID, setMedispanID] = useState<string>('');
  const [status, setStatus] = useState<string>('');

  useEffect(() => {
    async function fetchMedication(): Promise<void> {
      if (!oystehrZambda) {
        return;
      }
      const medicationsTemp = await getInHouseMedications(oystehrZambda);
      const medicationTemp = medicationsTemp.find((temp) => temp.id === medicationId);
      setMedication(medicationTemp);
      const medicationName =
        medicationTemp?.identifier?.find((identifier) => identifier.system === MEDICATION_IDENTIFIER_NAME_SYSTEM)
          ?.value || '';
      setName(medicationName);
      const medicationNDC =
        medicationTemp?.code?.coding?.find((coding) => coding.system === CODE_SYSTEM_NDC)?.code || '';
      setNdc(medicationNDC);
      const medicationMedispanID =
        medicationTemp?.code?.coding?.find((identifier) => identifier.system === MEDICATION_DISPENSABLE_DRUG_ID)
          ?.code || '';
      setMedispanID(medicationMedispanID);
      const status = medicationTemp?.status || '';
      setStatus(status);
    }
    fetchMedication().catch((error) => console.log('Error fetching medications', error));
  }, [medicationId, oystehrZambda]);

  async function update(event: any): Promise<void> {
    event.preventDefault();
    if (!oystehrZambda) {
      return;
    }

    if (!medication?.id) {
      return;
    }
    setLoading(true);

    try {
      await updateInHouseMedication(oystehrZambda, {
        medicationID: medication.id,
        name,
        ndc,
        medispanID,
      });
    } catch (error) {
      console.log('Error updating medication', error);
    }
    setLoading(false);
  }

  async function updateStatus(status: string): Promise<void> {
    if (!oystehrZambda) {
      return;
    }

    if (!medication?.id) {
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
        <form onSubmit={update}>
          <Grid container spacing={2} paddingTop={2}>
            <Grid item xs={12}>
              <Typography variant="h4">Update medication</Typography>
            </Grid>
            <Grid item xs={6}>
              <TextField
                label="Name"
                required
                fullWidth
                value={name}
                onChange={(event) => setName(event.target.value)}
              />
            </Grid>
            <Grid item xs={6} />
            <Grid item xs={6}>
              <TextField label="NDC" required fullWidth value={ndc} onChange={(event) => setNdc(event.target.value)} />
            </Grid>
            <Grid item xs={6} />
            <Grid item xs={6}>
              <TextField
                label="Medispan ID"
                required
                fullWidth
                value={medispanID}
                onChange={(event) => setMedispanID(event.target.value)}
              />
            </Grid>
            <Grid item xs={6} />
            <Grid item>
              <LoadingButton type="submit" variant="contained" loading={loading}>
                Update
              </LoadingButton>
            </Grid>
          </Grid>
        </form>

        <LoadingButton
          variant="contained"
          color={status === 'active' ? 'error' : 'success'}
          sx={{ marginTop: 2 }}
          onClick={() => updateStatus(status === 'active' ? 'inactive' : 'active')}
          loading={loading}
        >
          {status === 'active' ? 'Remove' : 'Activate'}
        </LoadingButton>
      </>
    </PageContainer>
  );
}
