import { LoadingButton } from '@mui/lab';
import { Box, Paper, TextField, Typography } from '@mui/material';
import { ReactElement, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import CustomBreadcrumbs from '../components/CustomBreadcrumbs';
import { useApiClients } from '../hooks/useAppClients';
import PageContainer from '../layout/PageContainer';
import { getResource } from './Schedule';
import { Resource } from 'fhir/r4';

export default function AddSchedulePage(): ReactElement {
  // Define variables to interact w database and navigate to other pages
  const { fhirClient } = useApiClients();
  const navigate = useNavigate();
  const scheduleType = useParams()['schedule-type'] as 'office' | 'provider' | 'group';

  if (!scheduleType) {
    throw new Error('scheduleType is not defined');
  }

  // state variables
  const [name, setName] = useState<string | undefined>(undefined);
  const [firstName, setFirstName] = useState<string | undefined>(undefined);
  const [lastName, setLastName] = useState<string | undefined>(undefined);
  const [loading, setLoading] = useState<boolean>(false);

  async function createSchedule(event: any): Promise<void> {
    event.preventDefault();
    if (!fhirClient) {
      return;
    }
    setLoading(true);
    const resource: Resource = await fhirClient.createResource({
      resourceType: getResource(scheduleType),
      name: scheduleType === 'provider' ? [{ given: [firstName], family: lastName }] : name,
    });
    navigate(`/schedule/${scheduleType}/${resource.id}`);
    setLoading(false);
  }

  return (
    <PageContainer>
      <>
        <Box marginX={12}>
          {/* Breadcrumbs */}
          <CustomBreadcrumbs
            chain={[
              { link: '/schedules', children: 'Schedules' },
              { link: '#', children: `Add ${scheduleType}` },
            ]}
          />
          <Paper sx={{ padding: 2 }}>
            {/* Page title */}
            <Typography variant="h3" color="primary.dark" marginTop={1}>
              Add {scheduleType}
            </Typography>
            <form onSubmit={createSchedule}>
              {scheduleType === 'provider' ? (
                <>
                  <TextField
                    label="First name"
                    required
                    value={firstName}
                    onChange={(event) => setFirstName(event.target.value)}
                  />
                  <TextField
                    label="Last name"
                    required
                    value={lastName}
                    onChange={(event) => setLastName(event.target.value)}
                  />
                </>
              ) : (
                <TextField label="Name" required value={name} onChange={(event) => setName(event.target.value)} />
              )}
              <br />
              <LoadingButton type="submit" loading={loading} variant="contained" sx={{ marginTop: 2 }}>
                Save
              </LoadingButton>
            </form>
          </Paper>
        </Box>
      </>
    </PageContainer>
  );
}
