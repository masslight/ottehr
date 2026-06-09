import { otherColors } from '@ehrTheme/colors';
import CheckIcon from '@mui/icons-material/Check';
import CheckBoxIcon from '@mui/icons-material/CheckBox';
import CheckBoxOutlineBlankIcon from '@mui/icons-material/CheckBoxOutlineBlank';
import CloseIcon from '@mui/icons-material/Close';
import ContentCopyRoundedIcon from '@mui/icons-material/ContentCopyRounded';
import EditIcon from '@mui/icons-material/Edit';
import { LoadingButton, TabContext, TabList, TabPanel } from '@mui/lab';
import {
  Autocomplete,
  Box,
  Button,
  Checkbox,
  CircularProgress,
  Grid,
  IconButton,
  Paper,
  Skeleton,
  Switch,
  Tab,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Location, Practitioner, Schedule } from 'fhir/r4b';
import { enqueueSnackbar } from 'notistack';
import { ReactElement, useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  APIError,
  CreateScheduleParams,
  isApiError,
  isValidUUID,
  ScheduleDTO,
  scheduleTypeFromFHIRType,
  TIMEZONES,
  UpdateScheduleParams,
} from 'utils';
import { useSuccessQuery } from 'utils/lib/frontend';
import { createSchedule, getSchedule, listServiceCategories, updatePractitionerRole, updateSchedule } from '../api/api';
import CustomBreadcrumbs from '../components/CustomBreadcrumbs';
import Loading from '../components/Loading';
import ScheduleComponent from '../components/schedule/ScheduleComponent';
import ScheduleGeneralTab from '../components/schedule/ScheduleGeneralTab';
import { useApiClients } from '../hooks/useAppClients';
import PageContainer from '../layout/PageContainer';

const INTAKE_URL = import.meta.env.VITE_APP_PATIENT_APP_URL;

export function getResource(scheduleType: 'location' | 'group'): 'Location' | 'HealthcareService' {
  if (scheduleType === 'location') {
    return 'Location';
  } else if (scheduleType === 'group') {
    return 'HealthcareService';
  }

  console.log(`scheduleType unknown ${scheduleType}`);
  throw new Error('scheduleType unknown');
}

export default function SchedulePage(): ReactElement {
  const { oystehr, oystehrZambda } = useApiClients();
  const scheduleType = useParams()['schedule-type'] as 'location' | 'group' | undefined;
  const ownerId = useParams()['owner-id'] as string | undefined;
  const scheduleId = useParams()['schedule-id'] as string;
  const createMode = scheduleType !== undefined && ownerId !== undefined;
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [tabName, setTabName] = useState('schedule');
  const [item, setItem] = useState<ScheduleDTO | undefined>(undefined);

  const [statusPatchLoading, setStatusPatchLoading] = useState(false);
  const [copiedLinkKey, setCopiedLinkKey] = useState<string | null>(null);
  const [isEditingName, setIsEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState('');

  // todo: currently these things are props of the schedule owner and get rendered as the content of the "general" tab
  // would like to refactor that tab to be its own Page responsible for displaying the configuration of
  // the underlying fhir resource representing the schedule owner
  const [slug, setSlug] = useState<string | undefined>(undefined);
  const [timezone, setTimezone] = useState<string>(TIMEZONES[0]);
  // For PR-actored schedules only — the categories this role offers and the Location it's bound to.
  const [categoryIds, setCategoryIds] = useState<string[]>([]);
  const [locationId, setLocationId] = useState<string | undefined>(undefined);
  // Admin-editable display name for PR-actored schedules. Seeded from a
  // location-name fallback; the save handler always sends the current value
  // so the seed gets committed to the PR's schedule-display-name extension
  // on first save.
  const [scheduleName, setScheduleName] = useState<string>('');
  // Booking links for this schedule. Always at least the prebook link; for
  // Location-actored schedules we also surface a walk-in link (the walk-in
  // route resolves Schedule IDs and is only modeled for Location actors —
  // per the requirements doc, walk-in is the front-desk-assigns-whoever-is-
  // free pattern that lives on a Location, not a per-provider role).
  const bookingLinks = (() => {
    const fhirType = item?.owner.type;
    const locationType = item?.owner.isVirtual ? 'virtual' : 'in-person';
    const links: Array<{ label: string; url: string; copyKey: string }> = [];
    if (slug && fhirType) {
      links.push({
        label: 'Prebook',
        url: `${INTAKE_URL}/prebook/${locationType}?bookingOn=${slug}&scheduleType=${scheduleTypeFromFHIRType(
          fhirType
        )}`,
        copyKey: 'prebook',
      });
    }
    if (fhirType === 'Location' && scheduleId && isValidUUID(scheduleId)) {
      links.push({
        label: 'Walk-in',
        url: `${INTAKE_URL}/walkin/schedule/${scheduleId}`,
        copyKey: 'walkin',
      });
    }
    return links;
  })();

  useEffect(() => {
    if (item) {
      setTimezone(item?.owner.timezone ?? TIMEZONES[0]);
      setSlug(item?.owner.slug);
      setLocationId(item?.owner.locationId);
      // Seed with the displayed name. owner.name already resolves to the
      // explicit displayName when set, falling back to the Location's name
      // when no extension is persisted yet — a sensible default the save
      // handler will commit on first save.
      const seedName = item?.owner.displayName?.trim() || item?.owner.name || '';
      setScheduleName(seedName);
      // The PR's healthcareService[] can also contain group-membership refs
      // (a HealthcareService that's a Group rather than a service category).
      // Those aren't categories the admin should see in this picker; the
      // categoryOptions filter below handles them by treating only known
      // service-category HS ids as selectable. Initial state is filtered to
      // those — non-category refs are preserved server-side on save.
    }
  }, [item]);

  const isPractitionerRoleOwner = item?.owner.type === 'PractitionerRole';

  // For the PR Location picker — list of active Locations.
  const { data: locationOptions } = useQuery({
    queryKey: ['ehr-active-locations'],
    queryFn: async (): Promise<Location[]> => {
      if (!oystehr) return [];
      const bundle = await oystehr.fhir.search<Location>({
        resourceType: 'Location',
        params: [{ name: 'status', value: 'active' }],
      });
      return bundle.unbundle();
    },
    enabled: !!oystehr && isPractitionerRoleOwner,
  });

  // Fetch the service-category options (only used by the General tab when this
  // schedule's owner is a PractitionerRole).
  const { data: categoriesData } = useQuery({
    queryKey: ['ehr-schedule-categories'],
    queryFn: () => (oystehrZambda ? listServiceCategories(oystehrZambda) : null),
    enabled: !!oystehrZambda && isPractitionerRoleOwner,
  });
  const categoryOptions = (categoriesData?.serviceCategories ?? []).filter((sc: any) => sc.id);

  // The PR's healthcareService[] can include refs that aren't service
  // categories (e.g., the group HealthcareService that owns this PR as a
  // member). Initialize the multi-select only with refs that appear in the
  // service-category catalog — group refs stay on the PR untouched and are
  // preserved by the update zambda when the admin saves a category change.
  const seededCategoriesRef = useRef(false);
  useEffect(() => {
    if (seededCategoriesRef.current) return;
    if (!item || !isPractitionerRoleOwner || categoryOptions.length === 0) return;
    const knownIds = new Set(categoryOptions.map((c: any) => c.id as string));
    const filtered = (item.owner.healthcareServiceIds ?? []).filter((id) => knownIds.has(id));
    setCategoryIds(filtered);
    seededCategoriesRef.current = true;
  }, [item, isPractitionerRoleOwner, categoryOptions]);

  const queryEnabled = (() => {
    if (!oystehrZambda) {
      return false;
    }
    if (createMode) {
      return true;
    }
    if (!createMode && isValidUUID(scheduleId)) {
      return true;
    }
    return false;
  })();

  const {
    isLoading,
    isFetching,
    isRefetching,
    data: scheduleData,
  } = useQuery({
    queryKey: ['ehr-get-schedule', scheduleId, ownerId, scheduleType],

    queryFn: () =>
      oystehrZambda
        ? getSchedule(
            { scheduleId, ownerId, ownerType: scheduleType ? getResource(scheduleType) : undefined },
            oystehrZambda
          )
        : null,

    enabled: queryEnabled,
  });

  useSuccessQuery(scheduleData, (data) => {
    if (data) {
      setItem(data);
    }
  });

  // Self-correct when we land on the create route for an owner that already
  // has a persisted Schedule. The link at ScheduleInformation.tsx:404-409
  // routes to /new/<owner-id> when item.schedules is empty at click time —
  // which can be a stale-data race. Without this redirect, the user sees a
  // headerless schedule editor (tabs hidden because createMode === true)
  // even though the schedule exists. Redirecting to /id/<existing> drops
  // us into edit mode where the General/Location tabs render correctly.
  useEffect(() => {
    if (createMode && scheduleData?.id) {
      navigate(`/admin/schedule/id/${scheduleData.id}`, { replace: true });
    }
  }, [createMode, scheduleData?.id, navigate]);

  const saveScheduleChanges = useMutation({
    mutationFn: async (params: UpdateScheduleParams) => {
      if (oystehrZambda) {
        const response = await updateSchedule(params, oystehrZambda);
        return response;
      }
      throw new Error('fhir client not defined or patient id not provided');
    },
    onError: (error: any) => {
      if (isApiError(error)) {
        const message = (error as APIError).message;
        enqueueSnackbar(message, { variant: 'error' });
      } else {
        enqueueSnackbar('Something went wrong! Schedule changes could not be saved.', { variant: 'error' });
      }
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ['ehr-get-schedule'],
      });
      enqueueSnackbar('Schedule changes saved successfully!', { variant: 'success' });
    },
  });

  const createNewSchedule = useMutation({
    mutationFn: async (params: CreateScheduleParams) => {
      if (oystehrZambda) {
        const response = await createSchedule(params, oystehrZambda);
        return response;
      }
      throw new Error('fhir client not defined or patient id not provided');
    },
    onError: (error: any) => {
      if (isApiError(error)) {
        const message = (error as APIError).message;
        enqueueSnackbar(message, { variant: 'error' });
      } else {
        enqueueSnackbar('Something went wrong! Schedule could not be created.', { variant: 'error' });
      }
    },
    onSuccess: async (newSchedule: Schedule) => {
      navigate(`/admin/schedule/id/${newSchedule.id}`);
      enqueueSnackbar('Schedule added successfully!', { variant: 'success' });
    },
  });

  const saveNameMutation = useMutation({
    mutationFn: async (newName: string) => {
      if (!oystehrZambda || !item) {
        throw new Error('Schedule not loaded');
      }
      return await updateSchedule({ scheduleId: item.id, name: newName }, oystehrZambda);
    },
    onError: (error: any) => {
      if (isApiError(error)) {
        enqueueSnackbar((error as APIError).message, { variant: 'error' });
      } else {
        enqueueSnackbar('Could not save the new name.', { variant: 'error' });
      }
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['ehr-get-schedule'] });
      setIsEditingName(false);
      enqueueSnackbar('Name saved.', { variant: 'success' });
    },
  });

  const somethingIsLoadingInSomeWay = isLoading || isFetching || isRefetching || saveScheduleChanges.isPending;

  const handleTabChange = (event: React.SyntheticEvent, newTabName: string): void => {
    setTabName(newTabName);
  };

  const startEditName = (): void => {
    setNameDraft(item?.owner?.name ?? '');
    setIsEditingName(true);
  };

  const cancelEditName = (): void => {
    setIsEditingName(false);
    setNameDraft('');
  };

  const submitName = (): void => {
    const trimmed = nameDraft.trim();
    if (!trimmed) {
      enqueueSnackbar('Name cannot be empty.', { variant: 'warning' });
      return;
    }
    if (trimmed === item?.owner?.name) {
      setIsEditingName(false);
      return;
    }
    saveNameMutation.mutate(trimmed);
  };

  const isLocationOwner = item?.owner?.type === 'Location';

  async function onSaveSchedule(params: UpdateScheduleParams): Promise<void> {
    if (!oystehrZambda) {
      console.log('oystehr client is not defined');
      return;
    }
    if (createMode && scheduleType) {
      const ownerResourceType = getResource(scheduleType);
      if (!ownerId || !ownerResourceType || !params.schedule) {
        enqueueSnackbar('Schedule could not be created. Please reload the page and try again.', { variant: 'error' });
        return;
      }
      const createParams: CreateScheduleParams = {
        ...params,
        ownerId: ownerId,
        ownerType: ownerResourceType,
      } as CreateScheduleParams;
      createNewSchedule.mutate({ ...createParams });
    } else {
      saveScheduleChanges.mutate({ ...params });
    }
  }

  const setActiveStatus = async (isActive: boolean): Promise<void> => {
    if (!oystehr || !item?.id) {
      enqueueSnackbar('Oops. Something went wrong. Please reload the page and try again.', { variant: 'error' });
      return;
    }
    try {
      setStatusPatchLoading(true);
      const value: string | boolean = item.owner.type === 'Location' ? (isActive ? 'active' : 'inactive') : isActive;
      const patched = await oystehr.fhir.patch<Location | Practitioner>({
        resourceType: item.owner.type as 'Location' | 'Practitioner',
        id: item.owner.id,
        operations: [
          {
            path: item.owner.type === 'Location' ? '/status' : '/active',
            op: 'add',
            value,
          },
        ],
      });
      let newActiveStatus = isActive;
      if (patched.resourceType === 'Location') {
        newActiveStatus = patched.status === 'active';
      } else {
        newActiveStatus = patched.active === true;
      }
      await saveGeneralFields();
      setItem({
        ...item,
        owner: {
          ...item.owner,
          active: newActiveStatus,
        },
      });
    } catch {
      enqueueSnackbar('Oops. Something went wrong. Status update was not saved.', { variant: 'error' });
    } finally {
      setStatusPatchLoading(false);
    }
  };

  const saveGeneralFields = async (_event?: any): Promise<void> => {
    if (!oystehr || !item?.id) {
      enqueueSnackbar('Oops. Something went wrong. Please reload the page and try again.', { variant: 'error' });
      return;
    }
    // Schedule-level fields (slug, timezone) go through the schedule zambda.
    saveScheduleChanges.mutate({
      scheduleId: item.id,
      timezone,
      slug,
    });
    // Categories, Location, and the display Name are PR-level; bundle them
    // into one PATCH when the owner is a PR. The display name is always
    // included in the payload: the field is seeded from a derived fallback
    // (location name) which doesn't yet exist as a persisted extension on
    // the PR, so even an unchanged seed needs to be saved on the first save
    // to make the name "real." Without this, the field looks set in the UI
    // but the extension is never written.
    // Errors here are independent of the schedule save above.
    if (isPractitionerRoleOwner && oystehrZambda) {
      // Compare against the same category-only subset we seeded the picker
      // with, so non-category refs (group memberships) on the PR don't trip
      // the diff and force a no-op PATCH.
      const knownIds = new Set(categoryOptions.map((c: any) => c.id as string));
      const initialCats = (item.owner.healthcareServiceIds ?? []).filter((id) => knownIds.has(id));
      const sortedInitialCats = [...initialCats].sort();
      const sortedCurrentCats = [...categoryIds].sort();
      const categoriesChanged =
        sortedInitialCats.length !== sortedCurrentCats.length ||
        sortedInitialCats.some((v, i) => v !== sortedCurrentCats[i]);
      const locationChanged = (locationId ?? '') !== (item.owner.locationId ?? '');
      const trimmedName = scheduleName.trim();
      // A non-empty display name should always be persisted on save —
      // dropping the nameChanged gate so the user's first save commits the
      // seed value to the PR's schedule-display-name extension.
      const shouldSendName = trimmedName.length > 0;

      if (categoriesChanged || locationChanged || shouldSendName) {
        try {
          await updatePractitionerRole(oystehrZambda, {
            roleId: item.owner.id,
            ...(categoriesChanged ? { categoryHealthcareServiceIds: categoryIds } : {}),
            ...(locationChanged && locationId ? { locationId } : {}),
            ...(shouldSendName ? { displayName: trimmedName } : {}),
          });
          await queryClient.invalidateQueries({ queryKey: ['ehr-get-schedule'] });
        } catch (err) {
          console.error(err);
          // Surface conflict / structured errors from the zambda directly.
          const message =
            err && typeof err === 'object' && 'message' in err && typeof (err as any).message === 'string'
              ? (err as any).message
              : 'Failed to update schedule metadata.';
          enqueueSnackbar(message, { variant: 'error' });
        }
      }
    }
  };

  return (
    <PageContainer>
      <>
        {item ? (
          <Box>
            <CustomBreadcrumbs
              chain={[
                { link: '/admin', state: { defaultTab: scheduleType }, children: 'Admin' },
                { link: '/admin/schedules', state: { defaultTab: scheduleType }, children: 'Schedules' },
                { link: '#', children: item?.owner?.name || <Skeleton width={150} /> },
              ]}
            />

            {isEditingName && isLocationOwner ? (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, marginTop: 1 }}>
                <TextField
                  value={nameDraft}
                  onChange={(event) => setNameDraft(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') {
                      event.preventDefault();
                      submitName();
                    } else if (event.key === 'Escape') {
                      event.preventDefault();
                      cancelEditName();
                    }
                  }}
                  size="small"
                  autoFocus
                  disabled={saveNameMutation.isPending}
                  sx={{ minWidth: 300, '& input': { fontSize: '2rem', fontWeight: 700 } }}
                />
                <LoadingButton
                  loading={saveNameMutation.isPending}
                  onClick={submitName}
                  color="primary"
                  aria-label="Save name"
                  sx={{ minWidth: 0, p: 1 }}
                >
                  <CheckIcon />
                </LoadingButton>
                <IconButton
                  onClick={cancelEditName}
                  disabled={saveNameMutation.isPending}
                  aria-label="Cancel name edit"
                  size="small"
                >
                  <CloseIcon />
                </IconButton>
              </Box>
            ) : (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, marginTop: 1 }}>
                <Typography variant="h3" color="primary.dark">
                  {item?.owner?.name || <Skeleton width={150} />}
                </Typography>
                {isLocationOwner && (
                  <IconButton onClick={startEditName} aria-label="Edit name" size="small">
                    <EditIcon fontSize="small" />
                  </IconButton>
                )}
              </Box>
            )}
            {item?.owner.detailText && (
              <Typography marginBottom={1} fontWeight={400}>
                {item.owner.detailText}
              </Typography>
            )}
            <TabContext value={tabName}>
              <Box sx={{ borderBottom: 1, borderColor: 'divider', display: createMode ? 'none' : 'block' }}>
                <TabList onChange={handleTabChange} aria-label="Tabs">
                  <Tab label="Schedule" value="schedule" sx={{ textTransform: 'none', fontWeight: 700 }} />
                  <Tab label="General" value="general" sx={{ textTransform: 'none', fontWeight: 700 }} />
                  {item?.owner.type === 'Location' && (
                    <Tab label="Location" value="location" sx={{ textTransform: 'none', fontWeight: 700 }} />
                  )}
                </TabList>
              </Box>
              <Paper
                sx={{
                  marginTop: 2,
                  border: 'none',
                  boxShadow: 'none',
                  background: 'none',
                }}
              >
                <TabPanel value="schedule" sx={{ padding: 0 }}>
                  {(scheduleId || createMode) && (
                    <ScheduleComponent
                      id={scheduleId || 'new'}
                      item={item}
                      loading={somethingIsLoadingInSomeWay}
                      update={onSaveSchedule}
                      hideOverrides={createMode}
                    />
                  )}
                </TabPanel>
                <TabPanel value="general">
                  <Paper sx={{ marginBottom: 2, padding: 3 }}>
                    <Box display={'flex'} alignItems={'center'}>
                      <Switch
                        checked={item.owner.active}
                        onClick={() => setActiveStatus(!item.owner.active)}
                        disabled={statusPatchLoading}
                      />
                      {statusPatchLoading ? (
                        <CircularProgress size={24} color="inherit" />
                      ) : (
                        <Typography>{item.owner.active ? 'Active' : 'Inactive'}</Typography>
                      )}
                    </Box>
                    <hr />
                    <br />

                    <form
                      onSubmit={(e) => {
                        e.preventDefault();
                        void saveGeneralFields(e);
                      }}
                    >
                      {isPractitionerRoleOwner && (
                        <>
                          <TextField
                            label="Name"
                            required
                            value={scheduleName}
                            onChange={(event) => setScheduleName(event.target.value)}
                            sx={{ width: '500px', mb: 2 }}
                          />
                          <br />
                        </>
                      )}
                      <TextField
                        label="Permalink"
                        value={slug}
                        onChange={(event) => setSlug(event.target.value)}
                        sx={{ width: '250px' }}
                      />
                      <br />

                      <Typography
                        variant="body2"
                        sx={{ pt: 1, pb: 0.5, fontWeight: 600, display: bookingLinks.length > 0 ? 'block' : 'none' }}
                      >
                        Share booking links:
                      </Typography>
                      <Box
                        sx={{
                          display: bookingLinks.length > 0 ? 'flex' : 'none',
                          flexDirection: 'column',
                          gap: 0.5,
                          mb: 3,
                        }}
                      >
                        {bookingLinks.map((link) => (
                          <Box key={link.copyKey} sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                            <Tooltip
                              title={copiedLinkKey === link.copyKey ? 'Link copied!' : 'Copy link'}
                              placement="top"
                              arrow
                              onClose={() => {
                                setTimeout(() => {
                                  if (copiedLinkKey === link.copyKey) setCopiedLinkKey(null);
                                }, 200);
                              }}
                            >
                              <Button
                                onClick={() => {
                                  void navigator.clipboard.writeText(link.url);
                                  setCopiedLinkKey(link.copyKey);
                                }}
                                sx={{ p: 0, minWidth: 0 }}
                              >
                                <ContentCopyRoundedIcon fontSize="small" />
                              </Button>
                            </Tooltip>
                            <Box sx={{ display: 'flex', flexDirection: 'column' }}>
                              <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                                {link.label}
                              </Typography>
                              <Link to={link.url} target="_blank">
                                <Typography variant="body2">{link.url}</Typography>
                              </Link>
                            </Box>
                          </Box>
                        ))}
                      </Box>
                      <Autocomplete
                        options={TIMEZONES}
                        renderInput={(params) => <TextField {...params} label="Timezone" />}
                        sx={{ marginTop: 2, width: '250px' }}
                        value={timezone}
                        onChange={(_event, newValue) => {
                          if (newValue) {
                            setTimezone(newValue);
                          }
                        }}
                      />
                      {isPractitionerRoleOwner && (
                        <Autocomplete
                          options={(locationOptions ?? []).map((l) => l.id!).filter(Boolean)}
                          value={locationId ?? null}
                          onChange={(_e, v) => setLocationId(v ?? undefined)}
                          getOptionLabel={(id) => {
                            const hit = (locationOptions ?? []).find((l) => l.id === id);
                            return hit?.name || id;
                          }}
                          isOptionEqualToValue={(a, b) => a === b}
                          renderOption={(props, id) => {
                            const hit = (locationOptions ?? []).find((l) => l.id === id);
                            return (
                              <li {...props} key={id}>
                                {hit?.name || id}
                              </li>
                            );
                          }}
                          renderInput={(params) => <TextField {...params} label="Location" />}
                          sx={{ marginTop: 2, width: '500px' }}
                        />
                      )}
                      {isPractitionerRoleOwner && (
                        <Autocomplete
                          multiple
                          disableCloseOnSelect
                          options={categoryOptions.map((c: any) => c.id as string)}
                          value={categoryIds}
                          onChange={(_e, v) => setCategoryIds(v)}
                          getOptionLabel={(id) => {
                            const hit = categoryOptions.find((c: any) => c.id === id);
                            return hit ? `${hit.name} — ${hit.config.durationMinutes} min` : id;
                          }}
                          renderOption={(props, id) => {
                            const isSelected = categoryIds.includes(id);
                            const hit = categoryOptions.find((c: any) => c.id === id);
                            return (
                              <li {...props} key={id}>
                                <Checkbox
                                  icon={<CheckBoxOutlineBlankIcon fontSize="small" />}
                                  checkedIcon={<CheckBoxIcon fontSize="small" />}
                                  style={{ marginRight: 8 }}
                                  checked={isSelected}
                                />
                                {hit ? `${hit.name} — ${hit.config.durationMinutes} min` : id}
                              </li>
                            );
                          }}
                          renderInput={(params) => (
                            <TextField {...params} label="Services" helperText="Empty = all available services" />
                          )}
                          sx={{ marginTop: 2, width: '500px' }}
                        />
                      )}
                      <br />
                      <LoadingButton
                        type="submit"
                        loading={somethingIsLoadingInSomeWay}
                        variant="contained"
                        sx={{ marginTop: 2 }}
                        disabled={isPractitionerRoleOwner && !scheduleName.trim()}
                      >
                        Save
                      </LoadingButton>
                    </form>
                  </Paper>
                  <Paper sx={{ padding: 3 }}>
                    <Grid container direction="row" justifyContent="flex-start" alignItems="flex-start">
                      <Grid item xs={6}>
                        <Typography variant="h4" color={'primary.dark'}>
                          Information to the patients
                        </Typography>
                        <Typography variant="body1" color="primary.dark" marginTop={1}>
                          This message will be displayed to the patients before they proceed with booking the visit.
                        </Typography>
                        <Box
                          marginTop={2}
                          sx={{
                            background: otherColors.locationGeneralBlue,
                            borderRadius: 1,
                          }}
                          padding={3}
                        >
                          <Typography color="primary.dark" variant="body1">
                            No description
                          </Typography>
                        </Box>
                      </Grid>
                    </Grid>
                  </Paper>
                </TabPanel>
                {item?.owner.type === 'Location' && (
                  <TabPanel value="location">
                    <ScheduleGeneralTab
                      item={item}
                      onSchedulePersisted={setItem}
                      onSave={async (params) => {
                        await saveScheduleChanges.mutateAsync(params);
                      }}
                      isSaving={somethingIsLoadingInSomeWay}
                    />
                  </TabPanel>
                )}
              </Paper>
            </TabContext>
          </Box>
        ) : (
          <Loading />
        )}
      </>
    </PageContainer>
  );
}
