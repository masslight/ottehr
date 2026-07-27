import { LoadingButton } from '@mui/lab';
import { Box, Paper, TextField, Typography } from '@mui/material';
import { HealthcareService } from 'fhir/r4b';
import { ReactElement, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ScheduleStrategyCoding } from 'utils';
import CustomBreadcrumbs from '../components/CustomBreadcrumbs';
import { useApiClients } from '../hooks/useAppClients';
import PageContainer from '../layout/PageContainer';

/**
 * Creates a Group (HealthcareService). Reached from the Schedules page's Groups
 * tab (`/admin/schedule/group/add`).
 *
 * The Location-create path this page used to serve was retired: Location resources
 * are created in the Locations admin (`create-location` / LocationConfigPage), and
 * schedules for existing owners (provider or location) are created on the unified
 * create-schedule page (`/admin/schedule/add`). The Groups area is slated for its
 * own rework — this page will likely move/rename then.
 */
export default function AddSchedulePage(): ReactElement {
  const { oystehr } = useApiClients();
  const navigate = useNavigate();
  const rawScheduleType = useParams()['schedule-type'];

  // Only group creation lives here now. A stale link to the old location path
  // (`/admin/schedule/location/add`) should fail loudly rather than silently
  // create the wrong resource.
  if (rawScheduleType !== 'group') {
    throw new Error(
      `Add-schedule for "${rawScheduleType}" was retired. Locations are created in the Locations admin; ` +
        `provider/location schedules are created at /admin/schedule/add.`
    );
  }

  const [name, setName] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const trimmedName = name.trim();

  async function createGroup(event: React.FormEvent): Promise<void> {
    event.preventDefault();
    if (!oystehr || !trimmedName) return;
    setLoading(true);
    try {
      const resource = await oystehr.fhir.create<HealthcareService>({
        resourceType: 'HealthcareService',
        name: trimmedName,
        characteristic: [
          {
            coding: [{ system: 'http://hl7.org/fhir/service-mode', code: 'in-person', display: 'In Person' }],
          },
          {
            coding: [
              {
                code: ScheduleStrategyCoding.poolsAll.code,
                display: ScheduleStrategyCoding.poolsAll.display,
                system: ScheduleStrategyCoding.poolsAll.system,
              },
            ],
          },
        ],
      });
      navigate(`/admin/group/id/${resource.id}`);
    } finally {
      setLoading(false);
    }
  }

  return (
    <PageContainer>
      <Box marginX={12}>
        <CustomBreadcrumbs
          chain={[
            { link: '/admin', children: 'Admin' },
            { link: '/admin/schedules', children: 'Schedules' },
            { link: '#', children: 'Add group' },
          ]}
        />
        <Paper sx={{ padding: 2 }}>
          <Typography variant="h3" color="primary.dark" marginBottom={1}>
            Add group
          </Typography>
          <form onSubmit={createGroup}>
            <TextField
              label="Name"
              required
              value={name}
              onChange={(event) => setName(event.target.value)}
              helperText={!trimmedName && name.length > 0 ? 'Name is required' : ' '}
              error={!trimmedName && name.length > 0}
            />
            <br />
            <LoadingButton
              type="submit"
              loading={loading}
              variant="contained"
              sx={{ marginTop: 2 }}
              disabled={!trimmedName}
            >
              Save
            </LoadingButton>
          </form>
        </Paper>
      </Box>
    </PageContainer>
  );
}
