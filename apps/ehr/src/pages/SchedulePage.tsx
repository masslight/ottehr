import { otherColors } from '@ehrTheme/colors';
import ContentCopyRoundedIcon from '@mui/icons-material/ContentCopyRounded';
import { LoadingButton, TabContext, TabList, TabPanel } from '@mui/lab';
import {
  Autocomplete,
  Box,
  Button,
  CircularProgress,
  Grid,
  Paper,
  Skeleton,
  Switch,
  Tab,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import { Location, Practitioner, Schedule } from 'fhir/r4b';
import { enqueueSnackbar } from 'notistack';
import { ReactElement, useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from 'react-query';
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
import { createSchedule, getSchedule, updateSchedule } from '../api/api';
import CustomBreadcrumbs from '../components/CustomBreadcrumbs';
import Loading from '../components/Loading';
import ScheduleComponent from '../components/schedule/ScheduleComponent';
import { useApiClients } from '../hooks/useAppClients';
import PageContainer from '../layout/PageContainer';

const INTAKE_URL = import.meta.env.VITE_APP_INTAKE_URL;

export function getResource(
  scheduleType: 'location' | 'provider' | 'group'
): 'Location' | 'Practitioner' | 'HealthcareService' {
  if (scheduleType === 'location') {
    return 'Location';
  } else if (scheduleType === 'provider') {
    return 'Practitioner';
  } else if (scheduleType === 'group') {
    return 'HealthcareService';
  }

  console.log(`scheduleType unknown ${scheduleType}`);
  throw new Error('scheduleType unknown');
}

export default function SchedulePage(): ReactElement {
  // Define variables to interact w database and navigate to other pages
  const { oystehr } = useApiClients();
  const scheduleType = useParams()['schedule-type'] as 'location' | 'provider' | undefined;
  const ownerId = useParams()['owner-id'] as string | undefined;
  const scheduleId = useParams()['schedule-id'] as string;
  const createMode = scheduleType !== undefined && ownerId !== undefined;
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  // state variables
  const [tabName, setTabName] = useState('schedule');
  const [item, setItem] = useState<ScheduleDTO | undefined>(undefined);

  const [statusPatchLoading, setStatusPatchLoading] = useState(false);
  const [isCopied, setIsCopied] = useState<boolean>(false);

  // todo: currently these things are props of the schedule owner and get rendered as the content of the "general" tab
  // would like to refactor that tab to be its own Page responsible for displaying the configuration of
  // the underlying fhir resource representing the schedule owner
  const [slug, setSlug] = useState<string | undefined>(undefined);
  const [timezone, setTimezone] = useState<string>(TIMEZONES[0]);
  const defaultIntakeUrl = (() => {
    const fhirType = item?.owner.type;
    const locationType = item?.owner.isVirtual ? 'virtual' : 'in-person';
    if (slug && fhirType) {
      return `${INTAKE_URL}/prebook/${locationType}?bookingOn=${slug}&scheduleType=${scheduleTypeFromFHIRType(
        fhirType
      )}`;
    }
    return '';
  })();

  useEffect(() => {
    if (item) {
      setTimezone(item?.owner.timezone ?? TIMEZONES[0]);
      setSlug(item?.owner.slug);
    }
  }, [item]);

  const { oystehrZambda } = useApiClients();
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

  const { isLoading, isFetching, isRefetching } = useQuery(
    ['ehr-get-schedule', { zambdaClient: oystehrZambda, scheduleId, ownerId, scheduleType }],
    () =>
      oystehrZambda
        ? getSchedule(
            { scheduleId, ownerId, ownerType: scheduleType ? getResource(scheduleType) : undefined },
            oystehrZambda
          )
        : null,
    {
      onSuccess: (response) => {
        if (response !== null) {
          console.log('schedule response', response);
          setItem(response);
        }
      },
      enabled: queryEnabled,
    }
  );

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
      await queryClient.invalidateQueries(['ehr-get-schedule']);
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
      navigate(`/schedule/id/${newSchedule.id}`);
      enqueueSnackbar('Schedule added successfully!', { variant: 'success' });
    },
  });

  const somethingIsLoadingInSomeWay = isLoading || isFetching || isRefetching || saveScheduleChanges.isLoading;

  // console.log('scheduleFetchState (loading/fetching/error/success): ', isLoading, isFetching, isError, isSuccess);

  // handle functions
  const handleTabChange = (event: React.SyntheticEvent, newTabName: string): void => {
    setTabName(newTabName);
  };

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
      console.log('ownerId', ownerId, ownerResourceType);
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
    const params: UpdateScheduleParams = {
      scheduleId: item.id,
      timezone,
      slug,
    };
    saveScheduleChanges.mutate({ ...params });
  };

  return (
    <PageContainer>
      <>
        {item ? (
          <Box>
            {/* Breadcrumbs */}
            <CustomBreadcrumbs
              chain={[
                { link: '/schedules', state: { defaultTab: scheduleType }, children: 'Schedules' },
                { link: '#', children: item?.owner?.name || <Skeleton width={150} /> },
              ]}
            />

            {/* Page title */}
            <Typography variant="h3" color="primary.dark" marginTop={1}>
              {item?.owner?.name || <Skeleton width={150} />}
            </Typography>
            {/* Address line */}
            {item?.owner.detailText && (
              <Typography marginBottom={1} fontWeight={400}>
                {item.owner.detailText}
              </Typography>
            )}
            {/* Tabs */}
            <TabContext value={tabName}>
              <Box sx={{ borderBottom: 1, borderColor: 'divider', display: createMode ? 'none' : 'block' }}>
                <TabList onChange={handleTabChange} aria-label="Tabs">
                  <Tab label="Schedule" value="schedule" sx={{ textTransform: 'none', fontWeight: 700 }} />
                  <Tab label="General" value="general" sx={{ textTransform: 'none', fontWeight: 700 }} />
                </TabList>
              </Box>
              {/* Page Content */}
              {/* Time slots tab */}
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
                {/* General tab */}
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
                      <TextField
                        label="Slug"
                        value={slug}
                        onChange={(event) => setSlug(event.target.value)}
                        sx={{ width: '250px' }}
                      />
                      <br />

                      <Typography variant="body2" sx={{ pt: 1, pb: 0.5, fontWeight: 600 }}>
                        Share booking link to this schedule:
                      </Typography>
                      <Box sx={{ display: defaultIntakeUrl ? 'flex' : 'none', alignItems: 'center', gap: 0.5, mb: 3 }}>
                        <Tooltip
                          title={isCopied ? 'Link copied!' : 'Copy link'}
                          placement="top"
                          arrow
                          onClose={() => {
                            setTimeout(() => {
                              setIsCopied(false);
                            }, 200);
                          }}
                        >
                          <Button
                            onClick={() => {
                              void navigator.clipboard.writeText(defaultIntakeUrl);
                              setIsCopied(true);
                            }}
                            sx={{ p: 0, minWidth: 0 }}
                          >
                            <ContentCopyRoundedIcon fontSize="small" />
                          </Button>
                        </Tooltip>
                        <Link to={defaultIntakeUrl} target="_blank">
                          <Typography variant="body2">{defaultIntakeUrl}</Typography>
                        </Link>
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
