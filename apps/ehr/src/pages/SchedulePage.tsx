import { LoadingButton, TabContext, TabList, TabPanel } from '@mui/lab';
import {
  Autocomplete,
  Box,
  Button,
  Grid,
  Paper,
  Skeleton,
  Switch,
  Tab,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import { ReactElement, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { otherColors } from '../CustomThemeProvider';
import CustomBreadcrumbs from '../components/CustomBreadcrumbs';
import { useApiClients } from '../hooks/useAppClients';
import PageContainer from '../layout/PageContainer';
import ScheduleComponent from '../components/schedule/ScheduleComponent';
import Loading from '../components/Loading';
import GroupSchedule from '../components/schedule/GroupSchedule';
import ContentCopyRoundedIcon from '@mui/icons-material/ContentCopyRounded';
import { APIError, isApiError, isValidUUID, ScheduleDTO, TIMEZONES, UpdateScheduleParams } from 'utils';
import { useMutation, useQuery } from 'react-query';
import { getSchedule, updateSchedule } from '../api/api';
import { enqueueSnackbar } from 'notistack';

const INTAKE_URL = import.meta.env.VITE_APP_INTAKE_URL;

/*const START_SCHEDULE =
  '{"schedule":{"monday":{"open":8,"close":15,"openingBuffer":0,"closingBuffer":0,"workingDay":true,"hours":[{"hour":8,"capacity":2},{"hour":9,"capacity":2},{"hour":10,"capacity":2},{"hour":11,"capacity":2},{"hour":12,"capacity":2},{"hour":13,"capacity":2},{"hour":14,"capacity":2},{"hour":15,"capacity":2},{"hour":16,"capacity":2},{"hour":17,"capacity":3},{"hour":18,"capacity":3},{"hour":19,"capacity":3},{"hour":20,"capacity":1}]},"tuesday":{"open":8,"close":15,"openingBuffer":0,"closingBuffer":0,"workingDay":true,"hours":[{"hour":8,"capacity":2},{"hour":9,"capacity":2},{"hour":10,"capacity":2},{"hour":11,"capacity":2},{"hour":12,"capacity":2},{"hour":13,"capacity":2},{"hour":14,"capacity":2},{"hour":15,"capacity":2},{"hour":16,"capacity":2},{"hour":17,"capacity":3},{"hour":18,"capacity":3},{"hour":19,"capacity":3},{"hour":20,"capacity":1}]},"wednesday":{"open":8,"close":15,"openingBuffer":0,"closingBuffer":0,"workingDay":true,"hours":[{"hour":8,"capacity":2},{"hour":9,"capacity":2},{"hour":10,"capacity":2},{"hour":11,"capacity":2},{"hour":12,"capacity":2},{"hour":13,"capacity":2},{"hour":14,"capacity":2},{"hour":15,"capacity":2},{"hour":16,"capacity":2},{"hour":17,"capacity":3},{"hour":18,"capacity":3},{"hour":19,"capacity":3},{"hour":20,"capacity":1}]},"thursday":{"open":8,"close":15,"openingBuffer":0,"closingBuffer":0,"workingDay":true,"hours":[{"hour":8,"capacity":2},{"hour":9,"capacity":2},{"hour":10,"capacity":2},{"hour":11,"capacity":2},{"hour":12,"capacity":2},{"hour":13,"capacity":2},{"hour":14,"capacity":2},{"hour":15,"capacity":2},{"hour":16,"capacity":2},{"hour":17,"capacity":3},{"hour":18,"capacity":3},{"hour":19,"capacity":3},{"hour":20,"capacity":1}]},"friday":{"open":8,"close":15,"openingBuffer":0,"closingBuffer":0,"workingDay":true,"hours":[{"hour":8,"capacity":2},{"hour":9,"capacity":2},{"hour":10,"capacity":2},{"hour":11,"capacity":2},{"hour":12,"capacity":2},{"hour":13,"capacity":2},{"hour":14,"capacity":2},{"hour":15,"capacity":2},{"hour":16,"capacity":2},{"hour":17,"capacity":3},{"hour":18,"capacity":3},{"hour":19,"capacity":3},{"hour":20,"capacity":1}]},"saturday":{"open":8,"close":15,"openingBuffer":0,"closingBuffer":0,"workingDay":true,"hours":[{"hour":8,"capacity":2},{"hour":9,"capacity":2},{"hour":10,"capacity":2},{"hour":11,"capacity":2},{"hour":12,"capacity":2},{"hour":13,"capacity":2},{"hour":14,"capacity":2},{"hour":15,"capacity":2},{"hour":16,"capacity":2},{"hour":17,"capacity":3},{"hour":18,"capacity":3},{"hour":19,"capacity":3},{"hour":20,"capacity":1}]},"sunday":{"open":8,"close":15,"openingBuffer":0,"closingBuffer":0,"workingDay":true,"hours":[{"hour":8,"capacity":2},{"hour":9,"capacity":2},{"hour":10,"capacity":2},{"hour":11,"capacity":2},{"hour":12,"capacity":2},{"hour":13,"capacity":2},{"hour":14,"capacity":2},{"hour":15,"capacity":2},{"hour":16,"capacity":2},{"hour":17,"capacity":3},{"hour":18,"capacity":3},{"hour":19,"capacity":3},{"hour":20,"capacity":1}]}},"scheduleOverrides":{}}';
const IDENTIFIER_SLUG = 'https://fhir.ottehr.com/r4/slug';
export const TIMEZONE_EXTENSION_URL = 'http://hl7.org/fhir/StructureDefinition/timezone';*/

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
  const scheduleType = useParams()['schedule-type'] as 'location' | 'provider' | 'group';
  const scheduleId = useParams().id as string;

  if (!scheduleType) {
    throw new Error('scheduleType is not defined');
  }

  // state variables
  const [tabName, setTabName] = useState('schedule');
  // const [item, setItem] = useState<ScheduleDTO | undefined>(undefined);
  const [item, setItem] = useState<ScheduleDTO | undefined>(undefined);
  const [slug, setSlug] = useState<string | undefined>(undefined);
  const [isCopied, setIsCopied] = useState<boolean>(false);

  const defaultIntakeUrl = `${INTAKE_URL}/prebook/in-person?bookingOn=${slug}&scheduleType=${scheduleType}`;

  const { oystehrZambda } = useApiClients();
  const { isLoading, isFetching, isRefetching, isError, isSuccess, refetch } = useQuery(
    ['ehr-get-schedule', { zambdaClient: oystehrZambda }],
    () => (oystehrZambda ? getSchedule(scheduleId, oystehrZambda) : null),
    {
      onSuccess: (response) => {
        if (response !== null) {
          setItem(response);
        }
      },
      enabled: !!oystehrZambda && isValidUUID(scheduleId ?? ''),
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
      const newItem = (await refetch()).data;
      if (newItem) {
        setItem(newItem);
      }
      enqueueSnackbar('Schedule changes saved successfully!', { variant: 'success' });
    },
  });

  console.log('scheduleFetchState (loading/fetching/error/success): ', isLoading, isFetching, isError, isSuccess);

  // handle functions
  const handleTabChange = (event: React.SyntheticEvent, newTabName: string): void => {
    setTabName(newTabName);
  };

  /*
  const getStatusOperationJSON = (
    resourceType: 'Location' | 'Practitioner' | 'HealthcareService',
    active: boolean
  ): Operation => {
    // get the status operation json, account for cases where it exists already or does not
    let operation: Operation;
    if (resourceType === 'Location') {
      operation = {
        op: 'add',
        path: '/status',
        value: active ? 'active' : 'inactive',
      };
    } else if (resourceType === 'Practitioner' || resourceType === 'HealthcareService') {
      operation = {
        op: 'add',
        path: '/active',
        value: active,
      };
    } else {
      throw new Error('resourceType is not defined');
    }
    return operation;
  };

  async function createSchedule(): Promise<void> {
    let resourceType;
    if (!oystehr) {
      return;
    }
    if (scheduleType === 'location') {
      resourceType = 'Location';
    } else if (scheduleType === 'provider') {
      resourceType = 'Practitioner';
    }
    if (!resourceType) {
      console.log('resourceType is not defined');
      throw new Error('resourceType is not defined');
    }
    let scheduleExtension = item?.extension;
    if (!scheduleExtension) {
      scheduleExtension = [];
    }
    scheduleExtension?.push({
      url: SCHEDULE_EXTENSION_URL,
      valueString: START_SCHEDULE,
    });

    // if there is no timezone extension, add it. The default timezone is America/New_York
    if (!item?.extension?.some((ext) => ext.url === TIMEZONE_EXTENSION_URL)) {
      scheduleExtension.push({
        url: TIMEZONE_EXTENSION_URL,
        valueString: 'America/New_York',
      });
    }

    const patchedResource = (await oystehr.fhir.patch({
      resourceType,
      id: id,
      operations: [
        {
          op: 'add',
          path: '/extension',
          value: scheduleExtension,
        },
        getStatusOperationJSON(resourceType as 'Location' | 'Practitioner', true),
      ],
    })) as Location;
    setItem(patchedResource);
  }
    */

  async function onSaveSchedule(params: UpdateScheduleParams): Promise<void> {
    if (!oystehrZambda) {
      console.log('oystehr client is not defined');
      return;
    }
    saveScheduleChanges.mutate({ ...params });
  }

  const setActiveStatus = async (isActive: boolean): Promise<void> => {
    if (!oystehr) {
      throw new Error('oystehr client is not defined');
    }
    console.log('setting active status to', isActive);
  };

  const updateTimezone = async (tz: string | null): Promise<void> => {
    if (!oystehr) {
      throw new Error('oystehr client is not defined');
    }
    console.log('updating timezone to: ', tz);
  };

  return (
    <PageContainer>
      <>
        {item ? (
          <Box>
            {/* Breadcrumbs */}
            <CustomBreadcrumbs
              chain={[
                { link: '/schedules', children: 'Schedules' },
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
              <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
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
                  {scheduleType === 'group' && <GroupSchedule groupID={item.id || ''} />}
                  {scheduleType !== 'group' && (
                    <ScheduleComponent
                      id={scheduleId}
                      item={item}
                      loading={false}
                      update={onSaveSchedule}
                    ></ScheduleComponent>
                  )}
                </TabPanel>
                {/* General tab */}
                <TabPanel value="general">
                  <Paper sx={{ marginBottom: 2, padding: 3 }}>
                    <Box display={'flex'} alignItems={'center'}>
                      <Switch checked={item.owner.active} onClick={() => setActiveStatus(!item.owner.active)} />
                      <Typography>{item.owner.active ? 'Active' : 'Inactive'}</Typography>
                    </Box>
                    <hr />
                    <br />

                    <form
                      onSubmit={(event) => {
                        console.log('submit slug called', event);
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
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 3 }}>
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
                        value={item.timezone}
                        onChange={(_event, newValue) => {
                          if (newValue) {
                            void updateTimezone(newValue);
                          }
                        }}
                      />
                      <br />
                      <LoadingButton type="submit" loading={isRefetching} variant="contained" sx={{ marginTop: 2 }}>
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
