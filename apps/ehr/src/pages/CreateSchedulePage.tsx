import CheckBoxIcon from '@mui/icons-material/CheckBox';
import CheckBoxOutlineBlankIcon from '@mui/icons-material/CheckBoxOutlineBlank';
import { LoadingButton } from '@mui/lab';
import {
  Autocomplete,
  Box,
  Checkbox,
  FormControl,
  FormControlLabel,
  FormLabel,
  Paper,
  Radio,
  RadioGroup,
  TextField,
  Typography,
} from '@mui/material';
import { useQuery } from '@tanstack/react-query';
import { enqueueSnackbar } from 'notistack';
import { ReactElement, useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { isProvider } from 'utils/lib/types/api/get-employees/get-employees.types';
import { TIMEZONES } from 'utils/lib/types/constants';
import { BLANK_SCHEDULE_JSON_TEMPLATE } from 'utils/lib/utils/scheduleUtils';
import {
  createPractitionerRole,
  createSchedule,
  getEmployees,
  listScheduleOwners,
  listServiceCategories,
} from '../api/api';
import CustomBreadcrumbs from '../components/CustomBreadcrumbs';
import { useApiClients } from '../hooks/useAppClients';
import PageContainer from '../layout/PageContainer';

type OwnerType = 'provider' | 'location';

const errMessage = (err: unknown, fallback: string): string =>
  err && typeof err === 'object' && 'message' in err && typeof (err as { message?: unknown }).message === 'string'
    ? (err as { message: string }).message
    : fallback;

/**
 * Unified create-schedule page. Two paths under one shell:
 *  - Provider → createPractitionerRole (mints the connective PR + a blank Schedule).
 *  - Location → createSchedule for an EXISTING Location (Location creation itself
 *    stays in the Locations admin).
 * Launched cold (`/admin/schedule/add`) it asks which; launched with `?provider=<userId>` or
 * `?location=<locationId>` it pre-selects that owner and skips the owner-type step.
 * Either way it creates a blank schedule and lands on that schedule's page to set hours.
 */
export default function CreateSchedulePage(): ReactElement {
  const { oystehrZambda } = useApiClients();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  // The pre-select param may be a User id (from the Schedules list) or a
  // Practitioner id (from the Employee page's schedule list) — we resolve it
  // against either once the provider list loads.
  const preselectedProvider = searchParams.get('provider') ?? undefined;
  // Set by the "create a schedule" prompt on the location page, which knows the Location already.
  const preselectedLocation = searchParams.get('location') ?? undefined;

  // Defaults to the provider path (the common case); the owner-type step lets a
  // cold launch switch to a Location schedule. Arriving with ?location= means the
  // owner is already decided.
  const [ownerType, setOwnerType] = useState<OwnerType>(preselectedLocation ? 'location' : 'provider');

  // Provider path
  const [providerUserId, setProviderUserId] = useState<string | null>(null);
  const [providerLocationId, setProviderLocationId] = useState<string | null>(null);
  const [scheduleName, setScheduleName] = useState('');
  const [nameEditedManually, setNameEditedManually] = useState(false);
  const [allCategories, setAllCategories] = useState(false);
  const [categoryIds, setCategoryIds] = useState<string[]>([]);
  const [providerTimezone, setProviderTimezone] = useState<string>(TIMEZONES[0]);

  // Location path
  const [ownerLocationId, setOwnerLocationId] = useState<string | null>(preselectedLocation ?? null);
  const [locationTimezone, setLocationTimezone] = useState<string>(TIMEZONES[0]);

  const [submitting, setSubmitting] = useState(false);

  const { data: employeesData } = useQuery({
    queryKey: ['create-schedule-employees'],
    queryFn: () => (oystehrZambda ? getEmployees(oystehrZambda) : null),
    enabled: !!oystehrZambda,
  });
  const { data: locationsData } = useQuery({
    queryKey: ['schedule-list', 'Location'],
    queryFn: () => (oystehrZambda ? listScheduleOwners({ ownerType: 'Location' }, oystehrZambda) : null),
    enabled: !!oystehrZambda,
  });
  const { data: categoriesData } = useQuery({
    queryKey: ['create-schedule-categories'],
    queryFn: () => (oystehrZambda ? listServiceCategories(oystehrZambda) : null),
    enabled: !!oystehrZambda && ownerType === 'provider',
  });

  const providers = useMemo(
    () =>
      (employeesData?.employees ?? [])
        .filter((e) => isProvider(e) && e.status === 'Active' && !!e.profile)
        .map((e) => ({ userId: e.id, practitionerId: e.profile.split('/')[1], name: e.name }))
        .filter((p) => !!p.practitionerId),
    [employeesData]
  );
  const activeLocations = useMemo(
    () =>
      (locationsData?.list ?? []).filter((i) => i.owner.active).map((i) => ({ id: i.owner.id, name: i.owner.name })),
    [locationsData]
  );
  const scheduleLessLocations = useMemo(
    () =>
      (locationsData?.list ?? [])
        .filter((i) => i.owner.active && i.schedules.length === 0)
        .map((i) => ({ id: i.owner.id, name: i.owner.name })),
    [locationsData]
  );
  // The picker lists only schedule-less locations, which normally already covers anything linked
  // here. An INACTIVE one is the exception: it is excluded from that list but can still reach this
  // page from its own config page, and a preselected id that isn't an option renders as blank. Add
  // it back — but only when it genuinely has no schedule, so a stale link can't be used to slip past
  // the one-schedule-per-location rule the list is there to enforce.
  const locationOptions = useMemo(() => {
    if (!preselectedLocation || scheduleLessLocations.some((l) => l.id === preselectedLocation)) {
      return scheduleLessLocations;
    }
    const hit = (locationsData?.list ?? []).find((i) => i.owner.id === preselectedLocation);
    if (!hit || hit.schedules.length > 0) return scheduleLessLocations;
    return [...scheduleLessLocations, { id: hit.owner.id, name: hit.owner.name }];
  }, [scheduleLessLocations, preselectedLocation, locationsData]);

  const categoryOptions = (categoriesData?.serviceCategories ?? []).filter((c: any) => c.id);

  // Resolve the pre-select param (a User id OR a Practitioner id) to the
  // provider's User id once the list is available.
  useEffect(() => {
    if (!preselectedProvider || providerUserId) return;
    const match = providers.find((p) => p.userId === preselectedProvider || p.practitionerId === preselectedProvider);
    if (match) setProviderUserId(match.userId);
  }, [preselectedProvider, providers, providerUserId]);

  const selectedProvider = providers.find((p) => p.userId === providerUserId) ?? null;
  const selectedProviderLocation = activeLocations.find((l) => l.id === providerLocationId) ?? null;

  // Seed the schedule name from provider + location until the admin edits it.
  useEffect(() => {
    if (ownerType !== 'provider' || nameEditedManually) return;
    const provName = selectedProvider?.name;
    const locName = selectedProviderLocation?.name;
    if (provName && locName) setScheduleName(`${provName} @ ${locName}`);
    else if (provName) setScheduleName(`${provName} Schedule`);
    else setScheduleName('');
  }, [ownerType, selectedProvider, selectedProviderLocation, nameEditedManually]);

  const submitProvider = async (): Promise<void> => {
    if (!oystehrZambda || !selectedProvider || !providerLocationId) return;
    setSubmitting(true);
    try {
      const { schedule } = await createPractitionerRole(oystehrZambda, {
        practitionerId: selectedProvider.practitionerId,
        locationId: providerLocationId,
        categoryHealthcareServiceIds: allCategories ? [] : categoryIds,
        timezone: providerTimezone,
        displayName: scheduleName.trim() || undefined,
        allCategories,
      });
      navigate(`/admin/schedule/id/${schedule.id}`);
    } catch (err) {
      console.error(err);
      enqueueSnackbar(errMessage(err, 'Failed to create schedule.'), { variant: 'error' });
      setSubmitting(false);
    }
  };

  const submitLocation = async (): Promise<void> => {
    if (!oystehrZambda || !ownerLocationId) return;
    setSubmitting(true);
    try {
      const schedule = await createSchedule(
        {
          scheduleId: 'new',
          ownerId: ownerLocationId,
          ownerType: 'Location',
          schedule: BLANK_SCHEDULE_JSON_TEMPLATE.schedule,
          timezone: locationTimezone,
        },
        oystehrZambda
      );
      navigate(`/admin/schedule/id/${schedule.id}`);
    } catch (err) {
      console.error(err);
      enqueueSnackbar(errMessage(err, 'Failed to create schedule.'), { variant: 'error' });
      setSubmitting(false);
    }
  };

  return (
    <PageContainer>
      <Box marginX={12}>
        <CustomBreadcrumbs
          chain={[
            { link: '/admin', children: 'Admin' },
            { link: '/admin/schedules', children: 'Schedules' },
            { link: '#', children: 'Add schedule' },
          ]}
        />
        <Paper sx={{ padding: 3, mt: 1 }}>
          <Typography variant="h3" color="primary.dark" marginBottom={2}>
            Add schedule
          </Typography>

          {/* Owner-type step — hidden when launched pre-filled for a provider. */}
          {!preselectedProvider && !preselectedLocation && (
            <FormControl sx={{ mb: 3 }}>
              <FormLabel>What owns this schedule?</FormLabel>
              <RadioGroup row value={ownerType} onChange={(e) => setOwnerType(e.target.value as OwnerType)}>
                <FormControlLabel value="provider" control={<Radio />} label="Provider" />
                <FormControlLabel value="location" control={<Radio />} label="Location" />
              </RadioGroup>
            </FormControl>
          )}

          {ownerType === 'provider' ? (
            <Box
              component="form"
              onSubmit={(e) => {
                e.preventDefault();
                void submitProvider();
              }}
              sx={{ display: 'flex', flexDirection: 'column', gap: 2, maxWidth: 520 }}
            >
              <Autocomplete
                options={providers.map((p) => p.userId)}
                getOptionLabel={(id) => providers.find((p) => p.userId === id)?.name ?? id}
                value={providerUserId}
                onChange={(_e, v) => setProviderUserId(v)}
                disabled={!!preselectedProvider}
                isOptionEqualToValue={(a, b) => a === b}
                renderInput={(params) => <TextField {...params} label="Provider" required />}
              />
              <Autocomplete
                options={activeLocations.map((l) => l.id)}
                getOptionLabel={(id) => activeLocations.find((l) => l.id === id)?.name ?? id}
                value={providerLocationId}
                onChange={(_e, v) => setProviderLocationId(v)}
                isOptionEqualToValue={(a, b) => a === b}
                renderInput={(params) => <TextField {...params} label="Location" required />}
              />
              <TextField
                label="Name"
                required
                value={scheduleName}
                onChange={(e) => {
                  setScheduleName(e.target.value);
                  setNameEditedManually(true);
                }}
              />
              <FormControlLabel
                control={<Checkbox checked={allCategories} onChange={(e) => setAllCategories(e.target.checked)} />}
                label="Offers all services"
                sx={{ alignSelf: 'flex-start' }}
              />
              <Autocomplete
                multiple
                disableCloseOnSelect
                disabled={allCategories}
                options={categoryOptions.map((c: any) => c.id as string)}
                value={allCategories ? [] : categoryIds}
                onChange={(_e, v) => setCategoryIds(v)}
                getOptionLabel={(id) => {
                  const hit = categoryOptions.find((c: any) => c.id === id);
                  return hit ? `${hit.name} — ${hit.config.durationMinutes} min` : id;
                }}
                renderOption={(props, id) => {
                  const hit = categoryOptions.find((c: any) => c.id === id);
                  return (
                    <li {...props} key={id}>
                      <Checkbox
                        icon={<CheckBoxOutlineBlankIcon fontSize="small" />}
                        checkedIcon={<CheckBoxIcon fontSize="small" />}
                        style={{ marginRight: 8 }}
                        checked={categoryIds.includes(id)}
                      />
                      {hit ? `${hit.name} — ${hit.config.durationMinutes} min` : id}
                    </li>
                  );
                }}
                renderInput={(params) => (
                  <TextField
                    {...params}
                    label="Services"
                    helperText={
                      allCategories
                        ? 'Toggle off "Offers all services" to choose specific services'
                        : 'Pick the specific services this schedule offers'
                    }
                  />
                )}
              />
              <Autocomplete
                options={TIMEZONES}
                value={providerTimezone}
                onChange={(_e, v) => v && setProviderTimezone(v)}
                renderInput={(params) => <TextField {...params} label="Timezone" />}
              />
              <LoadingButton
                type="submit"
                loading={submitting}
                variant="contained"
                sx={{ alignSelf: 'flex-start' }}
                disabled={!selectedProvider || !providerLocationId || !scheduleName.trim()}
              >
                Create schedule
              </LoadingButton>
            </Box>
          ) : (
            <Box
              component="form"
              onSubmit={(e) => {
                e.preventDefault();
                void submitLocation();
              }}
              sx={{ display: 'flex', flexDirection: 'column', gap: 2, maxWidth: 520 }}
            >
              <Autocomplete
                options={locationOptions.map((l) => l.id)}
                getOptionLabel={(id) => locationOptions.find((l) => l.id === id)?.name ?? id}
                value={ownerLocationId}
                onChange={(_e, v) => setOwnerLocationId(v)}
                isOptionEqualToValue={(a, b) => a === b}
                noOptionsText="Every active location already has a schedule"
                renderInput={(params) => (
                  <TextField
                    {...params}
                    label="Location"
                    required
                    helperText="Only locations that don't yet have a schedule are listed. Create locations in the Locations admin."
                  />
                )}
              />
              <Autocomplete
                options={TIMEZONES}
                value={locationTimezone}
                onChange={(_e, v) => v && setLocationTimezone(v)}
                renderInput={(params) => <TextField {...params} label="Timezone" />}
              />
              <LoadingButton
                type="submit"
                loading={submitting}
                variant="contained"
                sx={{ alignSelf: 'flex-start' }}
                disabled={!ownerLocationId}
              >
                Create schedule
              </LoadingButton>
            </Box>
          )}
        </Paper>
      </Box>
    </PageContainer>
  );
}
