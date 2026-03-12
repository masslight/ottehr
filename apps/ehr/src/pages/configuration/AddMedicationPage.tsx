import { LoadingButton } from '@mui/lab';
import { Grid, TextField, Typography } from '@mui/material';
import { ReactElement, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { createInHouseMedication } from 'src/api/api';
import CustomBreadcrumbs from 'src/components/CustomBreadcrumbs';
import { useApiClients } from 'src/hooks/useAppClients';
import PageContainer from 'src/layout/PageContainer';

export default function AddMedicationPage(): ReactElement {
  const { oystehrZambda } = useApiClients();
  const [loading, setLoading] = useState<boolean>(false);
  const [name, setName] = useState<string>('');
  const [ndc, setNdc] = useState<string>('');
  const [medispanID, setMedispanID] = useState<string>('');
  const navigate = useNavigate();

  async function create(event: any): Promise<void> {
    event.preventDefault();
    if (!oystehrZambda) {
      return;
    }
    setLoading(true);

    try {
      const medicationTemp = await createInHouseMedication(oystehrZambda, {
        name,
        ndc,
        medispanID,
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
              <TextField label="Name" required fullWidth onChange={(event) => setName(event.target.value)} />
            </Grid>
            <Grid item xs={6} />
            <Grid item xs={6}>
              <TextField label="NDC" required fullWidth onChange={(event) => setNdc(event.target.value)} />
            </Grid>
            <Grid item xs={6} />
            <Grid item xs={6}>
              <TextField
                label="Medispan ID"
                required
                fullWidth
                onChange={(event) => setMedispanID(event.target.value)}
              />
            </Grid>
            <Grid item xs={6} />
            <Grid item>
              <LoadingButton type="submit" variant="contained" loading={loading}>
                Create
              </LoadingButton>
            </Grid>
          </Grid>
        </form>
      </>
    </PageContainer>
  );
}
