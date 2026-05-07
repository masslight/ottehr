import { LoadingButton } from '@mui/lab';
import { Box, Paper, TextField, Typography } from '@mui/material';
import { HealthcareService, Location } from 'fhir/r4b';
import { ReactElement, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ScheduleStrategyCoding } from 'utils';
import CustomBreadcrumbs from '../components/CustomBreadcrumbs';
import { useApiClients } from '../hooks/useAppClients';
import PageContainer from '../layout/PageContainer';
import { getResource } from './SchedulePage';

export default function AddSchedulePage(): ReactElement {
  const { oystehr } = useApiClients();
  const navigate = useNavigate();
  const scheduleType = useParams()['schedule-type'] as 'location' | 'group';

  if (!scheduleType) {
    throw new Error('scheduleType is not defined');
  }

  const [name, setName] = useState<string | undefined>(undefined);
  const [loading, setLoading] = useState<boolean>(false);

  async function createSchedule(event: any): Promise<void> {
    event.preventDefault();
    if (!oystehr) {
      return;
    }
    setLoading(true);
    const resourceData: Location | HealthcareService = {
      resourceType: getResource(scheduleType),
      name: name as any,
    };
    if (scheduleType === 'group') {
      (resourceData as HealthcareService).characteristic = [
        {
          coding: [
            {
              system: 'http://hl7.org/fhir/service-mode',
              code: 'in-person',
              display: 'In Person',
            },
          ],
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
      ];
    }
    const resource = await oystehr.fhir.create<Location | HealthcareService>(resourceData);
    setLoading(false);

    if (scheduleType === 'group') {
      navigate(`/admin/group/id/${resource.id}`);
    } else {
      navigate(`/admin/schedule/new/${scheduleType}/${resource.id}`);
    }
  }

  return (
    <PageContainer>
      <>
        <Box marginX={12}>
          <CustomBreadcrumbs
            chain={[
              { link: '/admin', children: 'Admin' },
              { link: '/admin/schedules', children: 'Schedules' },
              { link: '#', children: `Add ${scheduleType}` },
            ]}
          />
          <Paper sx={{ padding: 2 }}>
            <Typography variant="h3" color="primary.dark" marginBottom={1}>
              Add {scheduleType}
            </Typography>
            <form onSubmit={createSchedule}>
              <TextField label="Name" required value={name} onChange={(event) => setName(event.target.value)} />
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
