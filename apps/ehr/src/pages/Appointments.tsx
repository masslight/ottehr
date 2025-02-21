import { Error as ErrorIcon } from '@mui/icons-material';
import AddIcon from '@mui/icons-material/Add';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import KeyboardArrowUpIcon from '@mui/icons-material/KeyboardArrowUp';
import { Autocomplete, Box, Button, Grid, IconButton, Paper, TextField, Typography, useTheme } from '@mui/material';
import Oystehr from '@oystehr/sdk';
import { HealthcareService, Location, Practitioner } from 'fhir/r4b';
import { DateTime } from 'luxon';
import React, { ReactElement, useEffect, useMemo, useState } from 'react';
import { usePageVisibility } from 'react-page-visibility';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { InPersonAppointmentInformation } from 'utils';
import { otherColors } from '../CustomThemeProvider';
import { getAppointments } from '../api/api';
import AppointmentTabs from '../components/AppointmentTabs';
import DateSearch from '../components/DateSearch';
import GroupSelect from '../components/GroupSelect';
import LocationSelect from '../components/LocationSelect';
import ProvidersSelect from '../components/ProvidersSelect';
import { adjustTopForBannerHeight } from '../constants';
import { dataTestIds } from '../constants/data-test-ids';
import { useApiClients } from '../hooks/useAppClients';
import PageContainer from '../layout/PageContainer';
import { VisitType, VisitTypeToLabel } from '../types/types';
import CreateDemoVisits from '../components/CreateDemoVisits';
import { useDebounce } from '../telemed/hooks';

type LoadingState = { status: 'loading' | 'initial'; id?: string | undefined } | { status: 'loaded'; id: string };

interface AppointmentSearchResultData {
  preBooked: InPersonAppointmentInformation[] | undefined;
  completed: InPersonAppointmentInformation[] | undefined;
  cancelled: InPersonAppointmentInformation[] | undefined;
  inOffice: InPersonAppointmentInformation[] | undefined;
  activeApptDatesBeforeToday: string[] | undefined;
}

type CustomFormEventHandler = (event: React.FormEvent<HTMLFormElement>, value: any, field: string) => void;

export default function Appointments(): ReactElement {
  const { oystehrZambda } = useApiClients();
  const [locationSelected, setLocationSelected] = useState<Location | undefined>(undefined);
  const [loadingState, setLoadingState] = useState<LoadingState>({ status: 'initial' });
  const [practitioners, setPractitioners] = useState<Practitioner[] | undefined>(undefined);
  const [healthcareServices, setHealthcareServices] = useState<HealthcareService[] | undefined>(undefined);
  const [appointmentDate, setAppointmentDate] = useState<DateTime | null>(DateTime.local());
  const [editingComment, setEditingComment] = useState<boolean>(false);
  const [searchResults, setSearchResults] = useState<AppointmentSearchResultData | null>(null);
  const location = useLocation();
  const navigate = useNavigate();
  const pageIsVisible = usePageVisibility(); // goes to false if tab loses focus and gives the fhir api a break
  const { debounce } = useDebounce(300);

  const handleSubmit: CustomFormEventHandler = (event: any, value: any, field: string): void => {
    if (field === 'date') {
      queryParams?.set('searchDate', value?.toISODate() ?? appointmentDate?.toISODate() ?? '');
    } else if (field === 'location') {
      queryParams?.set('locationID', value?.id ?? '');
    } else if (field === 'visittypes') {
      const appointmentTypesString = value.join(',');
      queryParams.set('visitType', appointmentTypesString);
    } else if (field === 'providers') {
      const providersString = value.join(',');
      queryParams.set('providers', providersString);
    } else if (field === 'groups') {
      const groupsString = value.join(',');
      queryParams.set('groups', groupsString);
    }

    setEditingComment(false);
    navigate(`?${queryParams?.toString()}`);
  };

  const queryParams = useMemo(() => {
    return new URLSearchParams(location.search);
  }, [location.search]);

  const { locationID, searchDate, visitType, providers, groups, queryId } = (() => {
    const locationID = queryParams.get('locationID') || '';
    const searchDate = queryParams.get('searchDate') || '';
    const appointmentTypesString = queryParams.get('visitType') || '';
    let providers = queryParams.get('providers')?.split(',') || [];
    if (providers.length === 1 && providers[0] === '') {
      providers = [];
    }
    let groups = queryParams.get('groups')?.split(',') || [];
    if (groups.length === 1 && groups[0] === '') {
      groups = [];
    }
    const queryId = `${locationID}:${locationSelected?.id}:${providers}:${groups}:${searchDate}:${appointmentTypesString}`;
    const visitType = appointmentTypesString ? appointmentTypesString.split(',') : [];
    return { locationID, searchDate, visitType, providers, groups, queryId };
  })();

  const {
    preBooked: preBookedAppointments = [],
    completed: completedAppointments = [],
    cancelled: cancelledAppointments = [],
    inOffice: inOfficeAppointments = [],
    activeApptDatesBeforeToday = [],
  } = searchResults || {};

  useEffect(() => {
    if (localStorage.getItem('selectedVisitTypes')) {
      queryParams?.set('visitType', JSON.parse(localStorage.getItem('selectedVisitTypes') ?? '') ?? '');
      navigate(`?${queryParams?.toString()}`);
    }
  }, [navigate, queryParams]);

  useEffect(() => {
    if (localStorage.getItem('selectedProviders')) {
      queryParams?.set('providers', JSON.parse(localStorage.getItem('selectedProviders') ?? '') ?? '');
      navigate(`?${queryParams?.toString()}`);
    }
  }, [navigate, queryParams]);

  useEffect(() => {
    if (localStorage.getItem('selectedGroups')) {
      queryParams?.set('groups', JSON.parse(localStorage.getItem('selectedGroups') ?? '') ?? '');
      navigate(`?${queryParams?.toString()}`);
    }
  }, [navigate, queryParams]);

  useEffect(() => {
    const locationStore = localStorage?.getItem('selectedLocation');
    if (locationStore && !locationSelected) {
      setLocationSelected(JSON.parse(locationStore));
    }
    const dateStore = localStorage?.getItem('selectedDate');
    if (dateStore && !appointmentDate) {
      setAppointmentDate?.(JSON.parse(localStorage.getItem('selectedDate') ?? '') ?? null);
    }
  }, [appointmentDate, locationSelected, queryParams]);

  useEffect(() => {
    async function getPractitioners(oystehrClient: Oystehr): Promise<void> {
      if (!oystehrClient) {
        return;
      }

      try {
        const practitionersTemp: Practitioner[] = (
          await oystehrClient.fhir.search<Practitioner>({
            resourceType: 'Practitioner',
            params: [
              { name: '_count', value: '1000' },
              // { name: 'name:missing', value: 'false' },
            ],
          })
        ).unbundle();
        setPractitioners(practitionersTemp);
      } catch (e) {
        console.error('error loading practitioners', e);
      }
    }

    async function getHealthcareServices(osytehrClient: Oystehr): Promise<void> {
      if (!oystehrZambda) {
        return;
      }

      try {
        const healthcareServicesTemp: HealthcareService[] = (
          await osytehrClient.fhir.search<HealthcareService>({
            resourceType: 'HealthcareService',
            params: [
              { name: '_count', value: '1000' },
              // { name: 'name:missing', value: 'false' },
            ],
          })
        ).unbundle();
        setHealthcareServices(healthcareServicesTemp);
      } catch (e) {
        console.error('error loading HealthcareServices', e);
      }
    }

    if (oystehrZambda) {
      void getPractitioners(oystehrZambda);
      void getHealthcareServices(oystehrZambda);
    }
  }, [oystehrZambda]);

  useEffect(() => {
    const fetchStuff = async (client: Oystehr, searchDate: DateTime | undefined): Promise<void> => {
      setLoadingState({ status: 'loading' });

      if (
        (locationID || locationSelected?.id || providers.length > 0 || groups.length > 0) &&
        (searchDate || appointmentDate) &&
        Array.isArray(visitType)
      ) {
        const searchResults = await getAppointments(client, {
          locationID: locationID || locationSelected?.id || undefined,
          searchDate,
          visitType: visitType || [],
          providerIDs: providers,
          groupIDs: groups,
        });

        debounce(() => {
          setSearchResults(searchResults || []);
          setLoadingState({ status: 'loaded', id: queryId });
        });
      }
    };
    if (
      (locationSelected || providers.length > 0 || groups.length > 0) &&
      oystehrZambda &&
      !editingComment &&
      loadingState.id !== queryId &&
      loadingState.status !== 'loading' &&
      pageIsVisible
    ) {
      const timezone =
        locationSelected?.extension?.find(
          (extTemp) => extTemp.url === 'http://hl7.org/fhir/StructureDefinition/timezone'
        )?.valueString ?? DateTime.local().zoneName;

      const searchDateToUse =
        (searchDate && DateTime.fromISO(searchDate, { zone: timezone })) || appointmentDate || undefined;

      void fetchStuff(oystehrZambda, searchDateToUse);
    }
  }, [
    locationSelected,
    oystehrZambda,
    editingComment,
    loadingState,
    queryId,
    locationID,
    searchDate,
    appointmentDate,
    visitType,
    providers,
    groups,
    queryParams,
    pageIsVisible,
    debounce,
  ]);

  useEffect(() => {
    const appointmentInterval = setInterval(() => setLoadingState({ status: 'initial' }), 30000);
    // Call updateAppointments so we don't need to wait for it to be called
    // getConversations().catch((error) => console.log(error));
    return () => clearInterval(appointmentInterval);
  }, []);

  return (
    <AppointmentsBody
      loadingState={loadingState}
      queryParams={queryParams}
      handleSubmit={handleSubmit}
      visitType={visitType}
      providers={providers}
      groups={groups}
      activeApptDatesBeforeToday={activeApptDatesBeforeToday}
      preBookedAppointments={preBookedAppointments}
      completedAppointments={completedAppointments}
      cancelledAppointments={cancelledAppointments}
      inOfficeAppointments={inOfficeAppointments}
      locationSelected={locationSelected}
      setLocationSelected={setLocationSelected}
      practitioners={practitioners}
      healthcareServices={healthcareServices}
      appointmentDate={appointmentDate}
      setAppointmentDate={setAppointmentDate}
      updateAppointments={() => setLoadingState({ status: 'initial' })}
      setEditingComment={setEditingComment}
    />
  );
}

interface AppointmentsBodyProps {
  loadingState: LoadingState;
  activeApptDatesBeforeToday: string[];
  preBookedAppointments: InPersonAppointmentInformation[];
  completedAppointments: InPersonAppointmentInformation[];
  cancelledAppointments: InPersonAppointmentInformation[];
  inOfficeAppointments: InPersonAppointmentInformation[];
  appointmentDate: DateTime | null;
  locationSelected: Location | undefined;
  handleSubmit: CustomFormEventHandler;
  queryParams?: URLSearchParams;
  visitType: string[];
  providers: string[];
  groups: string[];
  setLocationSelected: (location: Location | undefined) => void;
  practitioners: Practitioner[] | undefined;
  healthcareServices: HealthcareService[] | undefined;
  setAppointmentDate: (date: DateTime | null) => void;
  updateAppointments: () => void;
  setEditingComment: (editingComment: boolean) => void;
}
function AppointmentsBody(props: AppointmentsBodyProps): ReactElement {
  const {
    loadingState,
    activeApptDatesBeforeToday,
    preBookedAppointments,
    completedAppointments,
    cancelledAppointments,
    inOfficeAppointments,
    locationSelected,
    setLocationSelected,
    appointmentDate,
    visitType,
    providers,
    groups,
    practitioners,
    healthcareServices,
    setAppointmentDate,
    queryParams,
    handleSubmit,
    updateAppointments,
    setEditingComment,
  } = props;

  const [displayFilters, setDisplayFilters] = useState<boolean>(true);
  const theme = useTheme();

  return (
    <form>
      <PageContainer>
        <>
          <Box
            sx={{
              position: { xs: 'static', sm: 'sticky' },
              top: adjustTopForBannerHeight(80),
              zIndex: 1,
              backgroundColor: '#F9FAFB',
              alignItems: 'center',
              width: '100%',
            }}
          >
            <Paper sx={{ padding: 2 }}>
              <Grid container sx={{ justifyContent: 'center' }} spacing={2}>
                <Grid
                  item
                  alignItems="center"
                  sx={{
                    display: { xs: 'flex', sm: 'flex', md: 'none' },
                    width: '100%',
                    color: theme.palette.primary.main,
                  }}
                >
                  <IconButton
                    onClick={() => setDisplayFilters(!displayFilters)}
                    sx={{ color: theme.palette.primary.main }}
                  >
                    {displayFilters ? (
                      <KeyboardArrowUpIcon fontSize="small"></KeyboardArrowUpIcon>
                    ) : (
                      <KeyboardArrowDownIcon fontSize="small"></KeyboardArrowDownIcon>
                    )}
                  </IconButton>
                  <Typography variant="body2" sx={{ fontWeight: 700 }}>
                    Filters
                  </Typography>
                </Grid>
                {displayFilters && (
                  <>
                    <Grid item md={2.8} xs={12}>
                      <LocationSelect
                        queryParams={queryParams}
                        handleSubmit={handleSubmit}
                        location={locationSelected}
                        updateURL={true}
                        storeLocationInLocalStorage={true}
                        setLocation={setLocationSelected}
                      ></LocationSelect>
                    </Grid>
                    <Grid item md={4.7} xs={12}>
                      <Autocomplete
                        id="visittypes"
                        sx={{
                          '.MuiButtonBase-root.MuiChip-root': {
                            width: { xs: '100%', sm: '120px' },
                            textAlign: 'start',
                          },
                        }}
                        value={visitType?.length > 0 ? [...visitType] : Object.keys(VisitTypeToLabel)}
                        options={Object.keys(VisitTypeToLabel)}
                        getOptionLabel={(option) => {
                          return VisitTypeToLabel[option as VisitType];
                        }}
                        onChange={(event, value) => {
                          if (value) {
                            localStorage.setItem('selectedVisitTypes', JSON.stringify(value));
                          } else {
                            localStorage.removeItem('selectedVisitTypes');
                          }

                          if (handleSubmit) {
                            handleSubmit(event as any, value, 'visittypes');
                          }
                        }}
                        multiple
                        renderInput={(params) => (
                          <TextField name="visittypes" {...params} label="Visit type" required={false} />
                        )}
                      />
                    </Grid>
                    <Grid item md={2.8} xs={12}>
                      <DateSearch
                        label="Select Date"
                        queryParams={queryParams}
                        handleSubmit={handleSubmit}
                        date={appointmentDate}
                        setDate={setAppointmentDate}
                        updateURL={true}
                        storeDateInLocalStorage={true}
                        defaultValue={DateTime.now()}
                        closeOnSelect={true}
                      ></DateSearch>
                    </Grid>
                    <Grid item md={2.8} xs={12}>
                      <ProvidersSelect
                        providers={providers}
                        practitioners={practitioners}
                        handleSubmit={handleSubmit}
                      ></ProvidersSelect>
                    </Grid>
                    <Grid item xs={2}>
                      <GroupSelect
                        groups={groups}
                        healthcareServices={healthcareServices}
                        handleSubmit={handleSubmit}
                      ></GroupSelect>
                    </Grid>
                    <Grid item md={1.4} sm={12} sx={{ alignSelf: 'center', display: { xs: 'none', sm: 'block' } }}>
                      <Link to="/visits/add">
                        <Button
                          data-testid={dataTestIds.dashboard.addPatientButton}
                          sx={{
                            borderRadius: 100,
                            textTransform: 'none',
                            fontWeight: 600,
                            marginBottom: '20px',
                          }}
                          color="primary"
                          variant="contained"
                        >
                          <AddIcon />
                          <Typography fontWeight="bold">Add patient</Typography>
                        </Button>
                      </Link>
                    </Grid>
                  </>
                )}
              </Grid>
            </Paper>
            {/* only displayed on mobile */}
            <Box sx={{ display: { xs: 'block', sm: 'none' }, mt: 2 }}>
              <Link to="/visits/add">
                <Button
                  sx={{
                    borderRadius: 100,
                    textTransform: 'none',
                    fontWeight: 600,
                    width: '100%',
                  }}
                  color="primary"
                  variant="contained"
                >
                  <AddIcon />
                  <Typography fontWeight="bold">Add patient</Typography>
                </Button>
              </Link>
            </Box>
          </Box>
          <Box
            sx={{
              marginTop: '24px',
              width: '100%',
            }}
          >
            {activeApptDatesBeforeToday.length === 0 ? null : (
              <Grid container spacing={1} justifyContent="center">
                <Grid item>
                  <ErrorIcon htmlColor={otherColors.priorityHighIcon} fontSize="medium" />
                </Grid>
                <Grid item>
                  <Typography textAlign="center" color={otherColors.priorityHighText} fontWeight="bold">
                    You have patients in the queue for the following dates. Please filter to each date and clear all
                    patients out.
                  </Typography>
                </Grid>
                <Grid item>
                  <Typography color={otherColors.priorityHighText} textAlign="center">
                    {activeApptDatesBeforeToday.join(', ')}
                  </Typography>
                </Grid>
              </Grid>
            )}
            <AppointmentTabs
              location={locationSelected}
              providers={providers}
              groups={groups}
              preBookedAppointments={preBookedAppointments}
              cancelledAppointments={cancelledAppointments}
              completedAppointments={completedAppointments}
              inOfficeAppointments={inOfficeAppointments}
              loading={loadingState.status === 'loading'}
              updateAppointments={updateAppointments}
              setEditingComment={setEditingComment}
            />
          </Box>
          <CreateDemoVisits />
        </>
      </PageContainer>
    </form>
  );
}
