import { otherColors } from '@ehrTheme/colors';
import { Error as ErrorIcon } from '@mui/icons-material';
import AddIcon from '@mui/icons-material/Add';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import KeyboardArrowUpIcon from '@mui/icons-material/KeyboardArrowUp';
import { Autocomplete, Box, Button, Grid, IconButton, Paper, TextField, Typography, useTheme } from '@mui/material';
import Oystehr from '@oystehr/sdk';
import { HealthcareService, Practitioner } from 'fhir/r4b';
import { DateTime } from 'luxon';
import React, { ReactElement, useEffect, useMemo, useState } from 'react';
import { usePageVisibility } from 'react-page-visibility';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { usePatientLabOrders } from 'src/features/external-labs/components/labs-orders/usePatientLabOrders';
import { useInHouseLabOrders } from 'src/features/in-house-labs/components/orders/useInHouseLabOrders';
import { useGetNursingOrders } from 'src/features/nursing-orders/components/orders/useNursingOrders';
import { InHouseOrderListPageItemDTO, InPersonAppointmentInformation, LabOrderListPageDTO, NursingOrder } from 'utils';
import { getAppointments } from '../api/api';
import AppointmentTabs from '../components/AppointmentTabs';
import CreateDemoVisits from '../components/CreateDemoVisits';
import DateSearch from '../components/DateSearch';
import GroupSelect from '../components/GroupSelect';
import LocationSelect from '../components/LocationSelect';
import ProvidersSelect from '../components/ProvidersSelect';
import { dataTestIds } from '../constants/data-test-ids';
import { adjustTopForBannerHeight } from '../helpers/misc.helper';
import { useApiClients } from '../hooks/useAppClients';
import PageContainer from '../layout/PageContainer';
import { useDebounce } from '../telemed/hooks';
import { VisitType, VisitTypeToLabel } from '../types/types';
import { LocationWithWalkinSchedule } from './AddPatient';

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
  const [locationSelected, setLocationSelected] = useState<LocationWithWalkinSchedule | undefined>(undefined);
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
    } else if (field === 'visitTypes') {
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

  const inOfficeEncounterIds = inOfficeAppointments.map((appointment) => appointment.encounterId);
  const completedEncounterIds = completedAppointments.map((appointment) => appointment.encounterId);
  const encountersIdsEligibleForOrders = [...inOfficeEncounterIds, ...completedEncounterIds];

  const externalLabOrders = usePatientLabOrders({
    searchBy: { field: 'encounterIds', value: encountersIdsEligibleForOrders },
  });
  const externalLabOrdersByAppointmentId = useMemo(() => {
    return externalLabOrders?.labOrders?.reduce(
      (acc, order) => {
        acc[order.appointmentId] = [...(acc[order.appointmentId] || []), order];
        return acc;
      },
      {} as Record<string, LabOrderListPageDTO[]>
    );
  }, [externalLabOrders?.labOrders]);

  const inHouseOrders = useInHouseLabOrders({
    searchBy: { field: 'encounterIds', value: encountersIdsEligibleForOrders },
  });
  const inHouseLabOrdersByAppointmentId = useMemo(() => {
    return inHouseOrders?.labOrders?.reduce(
      (acc, order) => {
        acc[order.appointmentId] = [...(acc[order.appointmentId] || []), order];
        return acc;
      },
      {} as Record<string, InHouseOrderListPageItemDTO[]>
    );
  }, [inHouseOrders?.labOrders]);

  const { nursingOrders } = useGetNursingOrders({
    searchBy: { field: 'encounterIds', value: encountersIdsEligibleForOrders },
  });
  const nursingOrdersByAppointmentId: Record<string, NursingOrder[]> = useMemo(() => {
    return nursingOrders?.reduce(
      (acc, order) => {
        acc[order.appointmentId] = [...(acc[order.appointmentId] || []), order];
        return acc;
      },
      {} as Record<string, NursingOrder[]>
    );
  }, [nursingOrders]);

  useEffect(() => {
    const selectedVisitTypes = localStorage.getItem('selectedVisitTypes');
    if (selectedVisitTypes) {
      queryParams?.set('visitType', JSON.parse(selectedVisitTypes) ?? '');
      navigate(`?${queryParams?.toString()}`);
    } else {
      queryParams?.set('visitType', Object.keys(VisitTypeToLabel).join(','));
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

    async function getHealthcareServices(oystehrClient: Oystehr): Promise<void> {
      if (!oystehrZambda) {
        return;
      }

      try {
        const healthcareServicesTemp: HealthcareService[] = (
          await oystehrClient.fhir.search<HealthcareService>({
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
    const fetchStuff = async (client: Oystehr, searchDate: string | undefined): Promise<void> => {
      setLoadingState({ status: 'loading' });

      if (
        (locationID || locationSelected?.id || providers.length > 0 || groups.length > 0) &&
        searchDate &&
        Array.isArray(visitType)
      ) {
        const searchResults = await getAppointments(client, {
          locationID: locationID || locationSelected?.id || undefined,
          searchDate,
          visitType: visitType,
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
      // send searchDate without timezone, in get-appointments zambda we apply appointment timezone to it to find appointments for that day
      // looks like searchDate is always exists, and we can remove rest options
      const searchDateToUse = searchDate || appointmentDate?.toISO?.() || '';
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
      inHouseLabOrdersByAppointmentId={inHouseLabOrdersByAppointmentId}
      externalLabOrdersByAppointmentId={externalLabOrdersByAppointmentId}
      nursingOrdersByAppointmentId={nursingOrdersByAppointmentId}
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
  locationSelected: LocationWithWalkinSchedule | undefined;
  handleSubmit: CustomFormEventHandler;
  queryParams?: URLSearchParams;
  visitType: string[];
  providers: string[];
  groups: string[];
  setLocationSelected: (location: LocationWithWalkinSchedule | undefined) => void;
  practitioners: Practitioner[] | undefined;
  healthcareServices: HealthcareService[] | undefined;
  setAppointmentDate: (date: DateTime | null) => void;
  updateAppointments: () => void;
  setEditingComment: (editingComment: boolean) => void;
  inHouseLabOrdersByAppointmentId: Record<string, InHouseOrderListPageItemDTO[]>;
  externalLabOrdersByAppointmentId: Record<string, LabOrderListPageDTO[]>;
  nursingOrdersByAppointmentId: Record<string, NursingOrder[]>;
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
    inHouseLabOrdersByAppointmentId,
    externalLabOrdersByAppointmentId,
    nursingOrdersByAppointmentId,
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
                  <Typography variant="body2" sx={{ fontWeight: 500 }}>
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
                        id="visitTypes"
                        sx={{
                          '.MuiButtonBase-root.MuiChip-root': {
                            width: { xs: '100%', sm: '120px' },
                            textAlign: 'start',
                          },
                        }}
                        value={visitType}
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
                            handleSubmit(event as any, value, 'visitTypes');
                          }
                        }}
                        multiple
                        renderInput={(params) => (
                          <TextField name="visitTypes" {...params} label="Visit type" required={false} />
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
              inHouseLabOrdersByAppointmentId={inHouseLabOrdersByAppointmentId}
              externalLabOrdersByAppointmentId={externalLabOrdersByAppointmentId}
              nursingLabOrdersByAppointmentId={nursingOrdersByAppointmentId}
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
