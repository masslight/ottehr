import { LoadingButton } from '@mui/lab';
import { Box, Paper, TextField, Typography } from '@mui/material';
import { HealthcareService, Location } from 'fhir/r4b';
import { ReactElement, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  isValidSlug,
  LOCATION_FORM_EXTENSION_URL,
  LOCATION_IN_PERSON_CODE,
  LOCATION_MANUALLY_CREATED_EXTENSION_URL,
  LOCATION_PHYSICAL_TYPE_SYSTEM,
  ScheduleStrategyCoding,
  SLUG_SYSTEM,
  slugFromName,
  TIMEZONE_EXTENSION_URL,
  TIMEZONES,
} from 'utils';
import CustomBreadcrumbs from '../components/CustomBreadcrumbs';
import { useApiClients } from '../hooks/useAppClients';
import PageContainer from '../layout/PageContainer';

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

  // A new Location gets a slug auto-derived from its name so it's immediately
  // bookable (the patient-facing list-bookables zambda requires a slug). Some
  // names have no URL-safe characters (e.g. a purely non-Latin name) and yield
  // an empty/invalid slug — block creation and tell the admin, since a Location
  // without a slug can never surface to patients.
  const isLocation = scheduleType === 'location';
  const derivedSlug = isLocation ? slugFromName(trimmedName) : '';
  const slugInvalid = isLocation && trimmedName.length > 0 && !isValidSlug(derivedSlug);

  const nameHelperText = ((): string => {
    if (!trimmedName) {
      return 'Name is required';
    }
    if (isLocation) {
      return slugInvalid
        ? 'Cannot build a URL-safe permalink from this name. Use letters, digits, or hyphens.'
        : `Permalink will be: ${derivedSlug}`;
    }
    return ' ';
  })();

  async function createSchedule(event: any): Promise<void> {
    event.preventDefault();
    if (!oystehr) return;
    if (!trimmedName) return;
    if (slugInvalid) return;
    setLoading(true);
    let resourceData: Location | HealthcareService;
    if (scheduleType === 'group') {
      resourceData = {
        resourceType: 'HealthcareService',
        name: trimmedName,
        characteristic: [
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
        ],
      };
    } else {
      // Build a fully-formed Location, matching what terraform / the setup
      // scripts create — a bare { resourceType, name } is invisible to patients
      // (inactive, no slug) and never becomes bookable. An admin-created
      // Location defaults to in-person + active with a slug derived from the
      // name; the marker extension lets the UI treat it as manually-created and
      // allow slug edits later. Address (required for the in-person booking
      // search) is configured afterward on the Location tab.
      resourceData = {
        resourceType: 'Location',
        name: trimmedName,
        status: 'active',
        identifier: [
          {
            system: SLUG_SYSTEM,
            value: derivedSlug,
          },
        ],
        extension: [
          {
            url: TIMEZONE_EXTENSION_URL,
            valueString: TIMEZONES[0],
          },
          {
            url: LOCATION_FORM_EXTENSION_URL,
            valueCoding: {
              system: LOCATION_PHYSICAL_TYPE_SYSTEM,
              code: LOCATION_IN_PERSON_CODE,
              display: 'In Person',
            },
          },
          {
            url: LOCATION_MANUALLY_CREATED_EXTENSION_URL,
            valueBoolean: true,
          },
        ],
      };
    }
    try {
      const resource = await oystehr.fhir.create<Location | HealthcareService>(resourceData);

      if (scheduleType === 'group') {
        navigate(`/admin/group/id/${resource.id}`);
      } else {
        navigate(`/admin/schedule/new/${scheduleType}/${resource.id}`);
      }
    } finally {
      setLoading(false);
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
                helperText={nameHelperText}
                error={(!trimmedName && name.length > 0) || slugInvalid}
              />
              <br />
              <LoadingButton
                type="submit"
                loading={loading}
                variant="contained"
                sx={{ marginTop: 2 }}
                disabled={!trimmedName || slugInvalid}
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
