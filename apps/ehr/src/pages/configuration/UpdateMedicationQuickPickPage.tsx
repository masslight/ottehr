import { LoadingButton } from '@mui/lab';
import { Grid, Paper, TextField, Typography } from '@mui/material';
import { InHouseMedicationQuickPick } from 'config-types';
import { ReactElement, useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { getInHouseMedicationsQuickPicks, updateInHouseMedicationQuickPick } from 'src/api/api';
import CustomBreadcrumbs from 'src/components/CustomBreadcrumbs';
import Loading from 'src/components/Loading';
import { useApiClients } from 'src/hooks/useAppClients';
import PageContainer from 'src/layout/PageContainer';

export default function UpdateMedicationQuickPickPage(): ReactElement {
  const { oystehrZambda } = useApiClients();
  const quickPickId = useParams()['quick-pick-id'];
  const [quickPick, setQuickPick] = useState<InHouseMedicationQuickPick>();
  const [loading, setLoading] = useState<boolean>(false);
  const [name, setName] = useState<string>('');
  const [status, setStatus] = useState<string>('');
  const [error, setError] = useState<string | undefined>(undefined);

  useEffect(() => {
    async function fetchQuickPick(): Promise<void> {
      if (!oystehrZambda) {
        return;
      }
      const quickPicksTemp = await getInHouseMedicationsQuickPicks(oystehrZambda);
      const quickPickTemp = quickPicksTemp.find((temp) => temp.id === quickPickId);
      setQuickPick(quickPickTemp);
      setName(quickPickTemp?.name || 'Unknown');
      let statusTemp = quickPickTemp?.status;

      if (statusTemp === undefined) {
        statusTemp = 'active';
      }
      setStatus(statusTemp);
    }
    fetchQuickPick().catch((error) => console.log('Error fetching quick pick', error));
  }, [quickPickId, oystehrZambda]);

  async function update(event: any): Promise<void> {
    event.preventDefault();
    setError(undefined);
    if (!oystehrZambda) {
      return;
    }

    if (!quickPick?.id) {
      return;
    }
    setLoading(true);

    try {
      await updateInHouseMedicationQuickPick(oystehrZambda, {
        quickPickID: quickPick.id,
        name,
      });
    } catch (error: any) {
      console.log('Error updating quick pick', error);
      setError(error.message);
    }
    setLoading(false);
  }

  async function updateStatus(status: string): Promise<void> {
    setError(undefined);
    if (!oystehrZambda) {
      return;
    }

    if (!quickPick?.id) {
      return;
    }
    setLoading(true);

    try {
      const quickPickTemp = await updateInHouseMedicationQuickPick(oystehrZambda, {
        quickPickID: quickPick.id,
        status,
      });
      setStatus(quickPickTemp.status || '');
    } catch (error) {
      console.log('Error updating quick pick', error);
    }
    setLoading(false);
  }

  if (!quickPick) {
    return <Loading />;
  }

  return (
    <PageContainer>
      <>
        <CustomBreadcrumbs
          chain={[
            { link: '/admin', children: 'Admin' },
            { link: '/admin/medications', children: 'Medications' },
            { link: '#', children: 'Update Quick Pick' },
          ]}
        />
        <Paper sx={{ padding: 2 }}>
          <form onSubmit={update}>
            <Grid container spacing={2}>
              <Grid item xs={12}>
                <Typography variant="h4">Update Quick Pick</Typography>
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
              {error && (
                <Grid item xs={12}>
                  <Typography variant="body1" color="error">
                    {error}
                  </Typography>
                </Grid>
              )}
              <Grid item>
                <LoadingButton
                  type="submit"
                  variant="contained"
                  loading={loading}
                  sx={{ textTransform: 'none', borderRadius: 50, fontWeight: 'bold' }}
                >
                  Update Quick Pick
                </LoadingButton>
              </Grid>
            </Grid>
          </form>
        </Paper>

        <Paper sx={{ padding: 2, marginTop: 2 }}>
          <Typography variant="h4">{status === 'active' ? 'Remove' : 'Activate'} Quick Pick</Typography>
          <Typography variant="body1">
            {status === 'active'
              ? 'Removing this quick pick will make it so it can no longer be chosen for a visit. It will not affect any medications that have already been ordered.'
              : 'Activating this quick pick will add it to the list of imedication quick picks that can be chosen for a visit.'}
          </Typography>
          <LoadingButton
            variant="contained"
            color={status === 'active' ? 'error' : 'success'}
            sx={{ marginTop: 2, textTransform: 'none', borderRadius: 50, fontWeight: 'bold' }}
            onClick={() => updateStatus(status === 'active' ? 'inactive' : 'active')}
            loading={loading}
          >
            {status === 'active' ? 'Remove' : 'Activate'} Quick Pick
          </LoadingButton>
        </Paper>
      </>
    </PageContainer>
  );
}
