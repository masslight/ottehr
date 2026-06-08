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

const VALID_SCHEDULE_TYPES = ['location', 'group'] as const;
type ScheduleTypeParam = (typeof VALID_SCHEDULE_TYPES)[number];

export default function AddSchedulePage(): ReactElement {
  const { oystehr } = useApiClients();
  const navigate = useNavigate();
  const rawScheduleType = useParams()['schedule-type'];

  // Don't trust the URL param shape — a stale link / typo / legacy route
  // (e.g. `/admin/schedule/provider/add`) would otherwise propagate into
  // `getResource(...)` as an unknown value and corrupt the create call.
  if (!rawScheduleType || !VALID_SCHEDULE_TYPES.includes(rawScheduleType as ScheduleTypeParam)) {
    throw new Error(`Unknown schedule type "${rawScheduleType}". Expected one of: ${VALID_SCHEDULE_TYPES.join(', ')}.`);
  }
  const scheduleType: ScheduleTypeParam = rawScheduleType as ScheduleTypeParam;

  const [name, setName] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  // Require a non-empty name at create time so the resulting schedule list
  // never renders an "Unnamed location" / "Unnamed group" row. The list-side
  // fallback is kept for legacy records, but no NEW record should land
  // without a name.
  const trimmedName = name.trim();

  async function createSchedule(event: any): Promise<void> {
    event.preventDefault();
    if (!oystehr) return;
    if (!trimmedName) return;
    setLoading(true);
    const resourceData: Location | HealthcareService = {
      resourceType: getResource(scheduleType),
      name: trimmedName,
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
              <TextField
                label="Name"
                required
                value={name}
                onChange={(event) => setName(event.target.value)}
                helperText={!trimmedName ? 'Name is required' : ' '}
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
      </>
    </PageContainer>
  );
}
