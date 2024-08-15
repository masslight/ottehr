import { Error as ErrorIcon } from '@mui/icons-material';
import AddIcon from '@mui/icons-material/Add';
import { Autocomplete, Button, Grid, Paper, TextField, Typography } from '@mui/material';
import { FhirClient, ZambdaClient, formatHumanName } from '@zapehr/sdk';
import { HealthcareService, Location, Practitioner } from 'fhir/r4';
import { DateTime } from 'luxon';
import React, { ReactElement, useEffect, useMemo, useState } from 'react';
import { usePageVisibility } from 'react-page-visibility';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { UCAppointmentInformation } from 'ehr-utils';
import { otherColors } from '../CustomThemeProvider';
import { getAppointments } from '../api/api';
import AppointmentTabs from '../components/AppointmentTabs';
import DateSearch from '../components/DateSearch';
import LocationSelect from '../components/LocationSelect';
import { useApiClients } from '../hooks/useAppClients';
import PageContainer from '../layout/PageContainer';
import { VisitType, VisitTypeToLabel } from '../types/types';
import ProvidersSelect from '../components/inputs/ProvidersSelect';
import GroupSelect from '../components/inputs/GroupSelect';
import { TIMEZONE_EXTENSION_URL } from '../constants';
import CreateDemoVisitsButton from '../telemed/features/tracking-board/CreateDemoVisitsButton';

type LoadingState = { status: 'loading' | 'initial'; id?: string | undefined } | { status: 'loaded'; id: string };

interface AppointmentSearchResultData {
  preBooked: UCAppointmentInformation[] | undefined;
  completed: UCAppointmentInformation[] | undefined;
  cancelled: UCAppointmentInformation[] | undefined;
  inOffice: UCAppointmentInformation[] | undefined;
  activeApptDatesBeforeToday: string[] | undefined;
}

interface StructuredAppointmentData {
  preBookedAppointments: UCAppointmentInformation[];
  completedAppointments: UCAppointmentInformation[];
  cancelledAppointments: UCAppointmentInformation[];
  inOfficeAppointments: UCAppointmentInformation[];
  activeApptDatesBeforeToday: string[];
}

type CustomFormEventHandler = (event: React.FormEvent<HTMLFormElement>, value: any, field: string) => void;

export default function Appointments(): ReactElement {
  const { fhirClient, zambdaClient } = useApiClients();
  const [locationSelected, setLocationSelected] = useState<Location | undefined>(undefined);
  const [loadingState, setLoadingState] = useState<LoadingState>({ status: 'initial' });
  const [practitioners, setPractitioners] = useState<Practitioner[] | undefined>(undefined);
  const [healthcareServicess, setHealthcareServices] = useState<HealthcareService[] | undefined>(undefined);
  const [appointmentDate, setAppointmentDate] = useState<DateTime | null>(DateTime.local());
  const [editingComment, setEditingComment] = useState<boolean>(false);
  const [searchResults, setSearchResults] = useState<AppointmentSearchResultData | null>(null);
  const location = useLocation();
  const navigate = useNavigate();
  const pageIsVisible = usePageVisibility(); // goes to false if tab loses focus and gives the fhir api a break

  const handleSubmit: CustomFormEventHandler = (event: any, value: any, field: string): void => {
    if (field === 'date') {
      queryParams?.set('searchDate', value?.toISODate() ?? appointmentDate?.toISODate() ?? '');
    } else if (field === 'location') {
      queryParams?.set('locationID', value?.id ?? locationSelected?.id ?? '');
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

  const { locationID, searchDate, visitType, providers, groups, queryId } = useMemo(() => {
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
    const queryId = `${locationID}-${providers}-${groups}-${searchDate}-${appointmentTypesString}`;
    const visitType = appointmentTypesString ? appointmentTypesString.split(',') : [];
    return { locationID, searchDate, visitType, providers, groups, queryId };
  }, [queryParams]);

  const {
    preBookedAppointments,
    completedAppointments,
    cancelledAppointments,
    inOfficeAppointments,
    activeApptDatesBeforeToday,
  } = useMemo(() => {
    const structuredAppts: StructuredAppointmentData = {
      preBookedAppointments: [],
      completedAppointments: [],
      cancelledAppointments: [],
      inOfficeAppointments: [],
      activeApptDatesBeforeToday: [],
    };
    if (searchResults !== null) {
      structuredAppts.preBookedAppointments = searchResults.preBooked ?? [];
      structuredAppts.completedAppointments = searchResults.completed ?? [];
      structuredAppts.cancelledAppointments = searchResults.cancelled ?? [];
      structuredAppts.inOfficeAppointments = searchResults.inOffice ?? [];
      structuredAppts.activeApptDatesBeforeToday = searchResults.activeApptDatesBeforeToday ?? [];
    }
    return structuredAppts;
  }, [searchResults]);

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
    async function getPractitioners(fhirClient: FhirClient): Promise<void> {
      if (!fhirClient) {
        return;
      }

      try {
        const practitionersTemp: Practitioner[] = await fhirClient.searchResources({
          resourceType: 'Practitioner',
          searchParams: [
            { name: '_count', value: '1000' },
            // { name: 'name:missing', value: 'false' },
          ],
        });
        setPractitioners(practitionersTemp);
      } catch (e) {
        console.error('error loading practitioners', e);
      }
    }
    async function getHealthcareServices(fhirClient: FhirClient): Promise<void> {
      if (!fhirClient) {
        return;
      }

      try {
        const healthcareServicesTemp: HealthcareService[] = await fhirClient.searchResources({
          resourceType: 'HealthcareService',
          searchParams: [
            { name: '_count', value: '1000' },
            // { name: 'name:missing', value: 'false' },
          ],
        });
        setHealthcareServices(healthcareServicesTemp);
      } catch (e) {
        console.error('error loading practitioners', e);
      }
    }

    if (fhirClient) {
      void getPractitioners(fhirClient);
      void getHealthcareServices(fhirClient);
    }
  }, [fhirClient]);

  useEffect(() => {
    const fetchStuff = async (zambdaClient: ZambdaClient, searchDate: DateTime | undefined): Promise<void> => {
      setLoadingState({ status: 'loading' });

      if (
        (locationID || locationSelected?.id || providers.length > 0 || groups.length > 0) &&
        (searchDate || appointmentDate) &&
        Array.isArray(visitType)
      ) {
        const searchResults = await getAppointments(zambdaClient, {
          locationID: locationID || locationSelected?.id || undefined,
          searchDate,
          visitType: visitType || [],
          providerIDs: providers,
          groupIDs: groups,
        });

        setSearchResults(searchResults || []);

        setLoadingState({ status: 'loaded', id: queryId });
      }
    };
    if (
      (locationSelected || providers.length > 0 || groups.length > 0) &&
      zambdaClient &&
      !editingComment &&
      loadingState.id !== queryId &&
      loadingState.status !== 'loading' &&
      pageIsVisible
    ) {
      const timezone =
        locationSelected?.extension?.find((extTemp) => extTemp.url === TIMEZONE_EXTENSION_URL)?.valueString ??
        'America/New_York';
      const searchDateToUse =
        (searchDate && DateTime.fromISO(searchDate, { zone: timezone })) || appointmentDate || undefined;
      void fetchStuff(zambdaClient, searchDateToUse);
    }
  }, [
    locationSelected,
    zambdaClient,
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
      healthcareServices={healthcareServicess}
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
  preBookedAppointments: UCAppointmentInformation[];
  completedAppointments: UCAppointmentInformation[];
  cancelledAppointments: UCAppointmentInformation[];
  inOfficeAppointments: UCAppointmentInformation[];
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

  return (
    <form>
      <PageContainer>
        <>
          <Paper sx={{ padding: 2 }}>
            <Grid container sx={{ justifyContent: 'center' }} spacing={1}>
              <Grid item xs={2}>
                <LocationSelect
                  queryParams={queryParams}
                  handleSubmit={handleSubmit}
                  location={locationSelected}
                  updateURL={true}
                  storeLocationInLocalStorage={true}
                  setLocation={setLocationSelected}
                ></LocationSelect>
              </Grid>
              <Grid item xs={2}>
                <DateSearch
                  label="Date"
                  queryParams={queryParams}
                  handleSubmit={handleSubmit}
                  date={appointmentDate}
                  setDate={setAppointmentDate}
                  updateURL={true}
                  storeDateInLocalStorage={true}
                  defaultValue={DateTime.now().toLocaleString(DateTime.DATE_SHORT)}
                ></DateSearch>
              </Grid>
              <Grid item xs={2}>
                <Autocomplete
                  id="visittypes"
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
              <Grid item xs={2}>
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
              <Grid item xs={2} sx={{ alignSelf: 'center' }}>
                <Link to="/visits/add">
                  <Button
                    sx={{
                      borderRadius: 100,
                      textTransform: 'none',
                      fontWeight: 600,
                    }}
                    variant="contained"
                  >
                    <AddIcon />
                    <Typography fontWeight="bold">Add patient</Typography>
                  </Button>
                </Link>
              </Grid>
            </Grid>
          </Paper>
          {activeApptDatesBeforeToday.length === 0 ? null : (
            <Grid container spacing={1} justifyContent="center" paddingTop="20px">
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
          <CreateDemoVisitsButton visitService="in-person" />
        </>
      </PageContainer>
    </form>
  );
}
