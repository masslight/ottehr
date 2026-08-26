import ContentCopyRoundedIcon from '@mui/icons-material/ContentCopyRounded';
import { LoadingButton, TabContext, TabList, TabPanel } from '@mui/lab';
import {
  Autocomplete,
  Box,
  Button,
  CircularProgress,
  Paper,
  Skeleton,
  Switch,
  Tab,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { enqueueSnackbar } from 'notistack';
import { ReactElement, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { isValidSlug, SLUG_VALIDATION_MESSAGE } from 'utils/lib/fhir/constants';
import { useSuccessQuery } from 'utils/lib/frontend';
import { UpdateScheduleParams } from 'utils/lib/types/api/schedules';
import { TIMEZONES } from 'utils/lib/types/constants';
import { APIError, isApiError } from 'utils/lib/types/errors';
import { buildPrebookModeLinks, ScheduleDTO } from 'utils/lib/utils/scheduleUtils';
import { isValidUUID } from 'utils/lib/validation/helper';
import { getSchedule, toggleScheduleActive, updateSchedule } from '../api/api';
import CustomBreadcrumbs from '../components/CustomBreadcrumbs';
import Loading from '../components/Loading';
import ScheduleComponent from '../components/schedule/ScheduleComponent';
import { useApiClients } from '../hooks/useAppClients';
import PageContainer from '../layout/PageContainer';

const INTAKE_URL = import.meta.env.VITE_APP_PATIENT_APP_URL;

export default function SchedulePage(): ReactElement {
  const { oystehrZambda } = useApiClients();
  const scheduleId = useParams()['schedule-id'] as string;
  const queryClient = useQueryClient();

  const [tabName, setTabName] = useState('schedule');
  const [item, setItem] = useState<ScheduleDTO | undefined>(undefined);

  const [copiedLinkKey, setCopiedLinkKey] = useState<string | null>(null);
  const [statusPatchLoading, setStatusPatchLoading] = useState(false);

  // The General tab is scoped to schedule-descriptive fields only — timezone,
  // permalink, and the booking links derived from them. Owner-resource config
  // (a PractitionerRole's location/services/name/active) lives on its own home
  // (the Employee page's schedule list); the schedule page never edits it.
  const [slug, setSlug] = useState<string | undefined>(undefined);
  const [timezone, setTimezone] = useState<string>(TIMEZONES[0]);
  // Booking links for this schedule, for owners that have nowhere better to put them.
  //
  // Location-owned schedules are excluded: their links now live on the location page, which is the
  // resource those links actually name. Keeping a copy here would mean two places to look and one
  // to forget — and the location page can additionally warn when no schedule exists at all, which
  // this page structurally can't. A pointer to that page is rendered in place of the links.
  //
  // Practitioner- and group-owned schedules keep theirs, because there is no second home for them.
  const ownerIsLocation = item?.owner.type === 'Location';
  const bookingLinks = ownerIsLocation
    ? []
    : buildPrebookModeLinks({
        fhirType: item?.owner.type,
        slug,
        isVirtual: item?.owner.isVirtual,
        isInPerson: item?.owner.isInPerson,
      }).map((link) => ({ label: link.label, url: `${INTAKE_URL}${link.relativeUrl}`, copyKey: link.key }));

  useEffect(() => {
    if (item) {
      setTimezone(item?.owner.timezone ?? TIMEZONES[0]);
      setSlug(item?.owner.slug);
    }
  }, [item]);

  const queryEnabled = !!oystehrZambda && isValidUUID(scheduleId);

  const {
    isLoading,
    isFetching,
    isRefetching,
    data: scheduleData,
  } = useQuery({
    queryKey: ['ehr-get-schedule', scheduleId],
    queryFn: () => (oystehrZambda ? getSchedule({ scheduleId }, oystehrZambda) : null),
    enabled: queryEnabled,
  });

  useSuccessQuery(scheduleData, (data) => {
    if (data) {
      setItem(data);
    }
  });

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

  const somethingIsLoadingInSomeWay = isLoading || isFetching || isRefetching || saveScheduleChanges.isPending;

  const handleTabChange = (event: React.SyntheticEvent, newTabName: string): void => {
    setTabName(newTabName);
  };

  const isLocationOwner = item?.owner?.type === 'Location';

  // A non-empty slug must match the URL-safe shape the patient side enforces,
  // otherwise the save succeeds here but booking by slug fails later with a
  // validation error. The General tab only renders for non-Location owners
  // (Provider / Group), whose permalink is always editable — Location slugs
  // are edited on the Location config page.
  const slugError = !!slug && !isValidSlug(slug);

  async function onSaveSchedule(params: UpdateScheduleParams): Promise<void> {
    if (!oystehrZambda) {
      console.log('oystehr client is not defined');
      return;
    }
    saveScheduleChanges.mutate({ ...params });
  }

  // Active toggle acts on the Schedule resource itself (Schedule.active), not
  // its owner — deactivating drops just this schedule from booking (the shared
  // getSchedules filter honors Schedule.active) while leaving the owner and any
  // other schedules it owns intact.
  const setScheduleActive = async (nextActive: boolean): Promise<void> => {
    if (!oystehrZambda || !item?.id) {
      enqueueSnackbar('Oops. Something went wrong. Please reload the page and try again.', { variant: 'error' });
      return;
    }
    try {
      setStatusPatchLoading(true);
      const { active } = await toggleScheduleActive({ scheduleId: item.id, active: nextActive }, oystehrZambda);
      setItem({ ...item, active });
      enqueueSnackbar(nextActive ? 'Schedule activated.' : 'Schedule deactivated.', { variant: 'success' });
    } catch {
      enqueueSnackbar('Oops. Something went wrong. Status update was not saved.', { variant: 'error' });
    } finally {
      setStatusPatchLoading(false);
    }
  };

  const saveGeneralFields = async (_event?: any): Promise<void> => {
    if (!item?.id) {
      enqueueSnackbar('Oops. Something went wrong. Please reload the page and try again.', { variant: 'error' });
      return;
    }
    if (slugError) {
      enqueueSnackbar(`Permalink ${SLUG_VALIDATION_MESSAGE}.`, { variant: 'error' });
      return;
    }
    // The General tab acts on the Schedule alone: timezone + permalink go
    // through the schedule zambda. Owner-resource config is edited elsewhere.
    saveScheduleChanges.mutate({
      scheduleId: item.id,
      timezone,
      slug,
    });
  };

  return (
    <PageContainer>
      <>
        {item ? (
          <Box>
            <CustomBreadcrumbs
              chain={[
                { link: '/admin', children: 'Admin' },
                { link: '/admin/schedules', children: 'Schedules' },
                { link: '#', children: item?.owner?.name || <Skeleton width={150} /> },
              ]}
            />

            {/* Location name is edited on the dedicated Location config page; this schedule
                page is schedule-only for Location owners. (PractitionerRole names are edited
                on the General tab below.) */}
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, marginTop: 1 }}>
              <Typography variant="h3" color="primary.dark">
                {item?.owner?.name || <Skeleton width={150} />}
              </Typography>
            </Box>
            {item?.owner.detailText && (
              <Typography marginBottom={1} fontWeight={400}>
                {item.owner.detailText}
              </Typography>
            )}
            <TabContext value={tabName}>
              <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
                <TabList onChange={handleTabChange} aria-label="Tabs">
                  <Tab label="Schedule" value="schedule" sx={{ textTransform: 'none', fontWeight: 700 }} />
                  {/* Location owners configure their (non-schedule) properties on the dedicated
                      Location config page (/admin/locations/:id), not here — the schedule page is
                      schedule-only for them. The General tab remains for PractitionerRole owners. */}
                  {!isLocationOwner && (
                    <Tab label="General" value="general" sx={{ textTransform: 'none', fontWeight: 700 }} />
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
                  {scheduleId && (
                    <ScheduleComponent
                      id={scheduleId}
                      item={item}
                      loading={somethingIsLoadingInSomeWay}
                      update={onSaveSchedule}
                    />
                  )}
                </TabPanel>
                <TabPanel value="general">
                  <Paper sx={{ marginBottom: 2, padding: 3 }}>
                    <Box display={'flex'} alignItems={'center'}>
                      <Switch
                        checked={item.active}
                        onClick={() => void setScheduleActive(!item.active)}
                        disabled={statusPatchLoading}
                      />
                      {statusPatchLoading ? (
                        <CircularProgress size={24} color="inherit" />
                      ) : (
                        <Typography>{item.active ? 'Active' : 'Inactive'}</Typography>
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
                      <TextField
                        label="Permalink"
                        value={slug}
                        onChange={(event) => setSlug(event.target.value)}
                        error={slugError}
                        helperText={slugError ? SLUG_VALIDATION_MESSAGE : undefined}
                        sx={{ width: '250px' }}
                      />
                      <br />

                      {ownerIsLocation && item?.owner.id && (
                        <Typography variant="body2" sx={{ pt: 1, pb: 3 }}>
                          Share booking links from the{' '}
                          <Link to={`/admin/locations/${item.owner.id}`}>location page</Link>.
                        </Typography>
                      )}

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
                                  setCopiedLinkKey((prev) => (prev === link.copyKey ? null : prev));
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
                              <Link to={link.url} target="_blank" rel="noopener noreferrer">
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
                      <br />
                      <LoadingButton
                        type="submit"
                        loading={somethingIsLoadingInSomeWay}
                        variant="contained"
                        sx={{ marginTop: 2 }}
                        disabled={slugError}
                      >
                        Save
                      </LoadingButton>
                    </form>
                  </Paper>
                </TabPanel>
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
