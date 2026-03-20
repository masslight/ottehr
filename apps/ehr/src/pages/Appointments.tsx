import AddIcon from '@mui/icons-material/Add';
import { Autocomplete, Box, Button, Paper, Stack, TextField, Typography } from '@mui/material';
import Oystehr from '@oystehr/sdk';
import { HealthcareService, Practitioner } from 'fhir/r4b';
import { DateTime } from 'luxon';
import React, { ReactElement, useCallback, useEffect, useMemo, useState } from 'react';
import { usePageVisibility } from 'react-page-visibility';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { FEATURE_FLAGS } from 'src/constants/feature-flags';
import { useGetVitalsForEncounters } from 'src/features/visits/shared/components/vitals/hooks/useGetVitals';
import { useGetOrdersForTrackingBoard } from 'src/hooks/useGetOrdersForTrackingBoard';
import { useDebounce } from 'src/shared/hooks/useDebounce';
import {
  BOOKING_CONFIG,
  GetVitalsForListOfEncountersResponseData,
  InPersonAppointmentInformation,
  OrdersForTrackingBoardTable,
} from 'utils';
import { getAppointments } from '../api/api';
import AppointmentTabs from '../components/AppointmentTabs';
import CreateDemoVisits from '../components/CreateDemoVisits';
import DateSearch from '../components/DateSearch';
import LocationSelect from '../components/LocationSelect';
import ProvidersSelect from '../components/ProvidersSelect';
import { dataTestIds } from '../constants/data-test-ids';
import { adjustTopForBannerHeight } from '../helpers/misc.helper';
import { useApiClients } from '../hooks/useAppClients';
import PageContainer from '../layout/PageContainer';
import { VisitType, visitTypeToInPersonLabel } from '../types/types';
import { LocationWithWalkinSchedule } from './AddPatient';

type LoadingState = { status: 'loading' | 'initial'; id?: string | undefined } | { status: 'loaded'; id: string };

interface AppointmentSearchResultData {
  preBooked: InPersonAppointmentInformation[] | undefined;
  completed: InPersonAppointmentInformation[] | undefined;
  cancelled: InPersonAppointmentInformation[] | undefined;
  inOffice: InPersonAppointmentInformation[] | undefined;
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
  const [appointmentsVersion, setAppointmentsVersion] = useState(0);
  const location = useLocation();
  const navigate = useNavigate();
  const pageIsVisible = usePageVisibility(); // goes to false if tab loses focus and gives the fhir api a break
  const { debounce } = useDebounce(300);

  const queryParams = useMemo(() => {
    return new URLSearchParams(location.search);
  }, [location.search]);

  const handleSubmit: CustomFormEventHandler = useCallback(
    (event: any, value: any, field: string): void => {
      if (field === 'date') {
        queryParams?.set('searchDate', value?.toISODate() ?? appointmentDate?.toISODate() ?? '');
      } else if (field === 'location') {
        queryParams?.set('locationID', value?.id ?? '');
      } else if (field === 'visitTypes') {
        queryParams.set('visitType', value.join(','));
      } else if (field === 'providers') {
        queryParams.set('providers', value.join(','));
      } else if (field === 'serviceCategories') {
        queryParams.set('serviceCategories', value.join(','));
      }

      setEditingComment(false);
      navigate(`?${queryParams?.toString()}`);
    },
    [queryParams, appointmentDate, navigate]
  );

  const { locationID, searchDate, visitType, providers, serviceCategories, queryId } = (() => {
    const locationID = queryParams.get('locationID') || '';
    const searchDate = queryParams.get('searchDate') || '';
    const appointmentTypesString = queryParams.get('visitType') || '';
    let providers = queryParams.get('providers')?.split(',') || [];
    if (providers.length === 1 && providers[0] === '') {
      providers = [];
    }
    let serviceCategories = queryParams.get('serviceCategories')?.split(',') || [];
    if (serviceCategories.length === 1 && serviceCategories[0] === '') {
      serviceCategories = [];
    }
    const queryId = `${locationID}:${locationSelected?.id}:${providers}:${serviceCategories}:${searchDate}:${appointmentTypesString}`;
    const visitType = appointmentTypesString ? appointmentTypesString.split(',') : [];
    return { locationID, searchDate, visitType, providers, serviceCategories, queryId };
  })();

  const {
    preBooked: preBookedAppointments = [],
    completed: completedAppointments = [],
    cancelled: cancelledAppointments = [],
    inOffice: inOfficeAppointments = [],
  } = searchResults || {};

  const inOfficeEncounterIds = inOfficeAppointments.map((appointment) => appointment.encounterId);
  const completedEncounterIds = completedAppointments.map((appointment) => appointment.encounterId);
  const encountersIdsEligibleForOrders = [...inOfficeEncounterIds, ...completedEncounterIds];

  const { orders, refetchOrders } = useGetOrdersForTrackingBoard({
    encounterIds: encountersIdsEligibleForOrders,
    refreshKey: appointmentsVersion,
  });

  const { data: vitals } = useGetVitalsForEncounters({
    encounterIds: [...inOfficeEncounterIds, ...completedEncounterIds],
  });

  useEffect(() => {
    const selectedVisitTypes = localStorage.getItem('selectedVisitTypes');
    if (selectedVisitTypes) {
      queryParams?.set('visitType', JSON.parse(selectedVisitTypes) ?? '');
      navigate(`?${queryParams?.toString()}`);
    } else {
      queryParams?.set('visitType', Object.keys(visitTypeToInPersonLabel).join(','));
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
        (locationID || locationSelected?.id || providers.length > 0 || serviceCategories.length > 0) &&
        searchDate &&
        Array.isArray(visitType)
      ) {
        const searchResults = await getAppointments(client, {
          locationID: locationID || locationSelected?.id || undefined,
          searchDate,
          visitType: visitType,
          providerIDs: providers,
          serviceCategories: serviceCategories,
          supervisorApprovalEnabled: FEATURE_FLAGS.SUPERVISOR_APPROVAL_ENABLED,
        });

        // drives refetch for apis not using react hook query yet
        setAppointmentsVersion(Date.now());
        // drives refetch for apis using react hook query
        void refetchOrders();

        debounce(() => {
          setSearchResults(searchResults || []);
          setLoadingState({ status: 'loaded', id: queryId });
        });
      }
    };
    if (
      (locationSelected || providers.length > 0 || serviceCategories.length > 0) &&
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
    serviceCategories,
    queryParams,
    pageIsVisible,
    debounce,
    refetchOrders,
  ]);

  useEffect(() => {
    const appointmentInterval = setInterval(() => setLoadingState({ status: 'initial' }), 30000);
    // Call updateAppointments so we don't need to wait for it to be called
    // getConversations().catch((error) => console.log(error));
    return () => clearInterval(appointmentInterval);
  }, []);

  const updateAppointments = useCallback(() => {
    setLoadingState({ status: 'initial' });
  }, []);

  return (
    <AppointmentsBody
      loadingState={loadingState}
      queryParams={queryParams}
      handleSubmit={handleSubmit}
      visitType={visitType}
      providers={providers}
      serviceCategories={serviceCategories}
      preBookedAppointments={preBookedAppointments}
      completedAppointments={completedAppointments}
      cancelledAppointments={cancelledAppointments}
      inOfficeAppointments={inOfficeAppointments}
      orders={orders}
      vitals={vitals}
      locationSelected={locationSelected}
      setLocationSelected={setLocationSelected}
      practitioners={practitioners}
      healthcareServices={healthcareServices}
      appointmentDate={appointmentDate}
      setAppointmentDate={setAppointmentDate}
      updateAppointments={updateAppointments}
      setEditingComment={setEditingComment}
    />
  );
}

interface AppointmentsBodyProps {
  loadingState: LoadingState;
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
  serviceCategories: string[];
  setLocationSelected: (location: LocationWithWalkinSchedule | undefined) => void;
  practitioners: Practitioner[] | undefined;
  healthcareServices: HealthcareService[] | undefined;
  setAppointmentDate: (date: DateTime | null) => void;
  updateAppointments: () => void;
  setEditingComment: (editingComment: boolean) => void;
  orders: OrdersForTrackingBoardTable;
  vitals?: GetVitalsForListOfEncountersResponseData;
}
function AppointmentsBody(props: AppointmentsBodyProps): ReactElement {
  const {
    loadingState,
    preBookedAppointments,
    completedAppointments,
    cancelledAppointments,
    inOfficeAppointments,
    locationSelected,
    setLocationSelected,
    appointmentDate,
    visitType,
    providers,
    serviceCategories,
    practitioners,
    setAppointmentDate,
    queryParams,
    handleSubmit,
    updateAppointments,
    setEditingComment,
    orders,
    vitals,
  } = props;

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
              <Stack direction="row" spacing={2} alignItems="flex-start">
                <Box style={{ flex: 1 }}>
                  <LocationSelect
                    queryParams={queryParams}
                    handleSubmit={handleSubmit}
                    location={locationSelected}
                    updateURL={true}
                    storeLocationInLocalStorage={true}
                    setLocation={setLocationSelected}
                  />
                </Box>
                <Autocomplete
                  id="visitTypes"
                  sx={{
                    '.MuiButtonBase-root.MuiChip-root': {
                      textAlign: 'start',
                    },
                  }}
                  style={{ flex: 1.5 }}
                  value={visitType}
                  options={Object.keys(visitTypeToInPersonLabel)}
                  getOptionLabel={(option) => {
                    return visitTypeToInPersonLabel[option as VisitType];
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
                <Autocomplete
                  sx={{
                    '.MuiButtonBase-root.MuiChip-root': {
                      textAlign: 'start',
                    },
                  }}
                  style={{ flex: 1 }}
                  value={serviceCategories}
                  options={BOOKING_CONFIG.serviceCategories.map((category) => category.code)}
                  getOptionLabel={(option) =>
                    BOOKING_CONFIG.serviceCategories.find((category) => category.code === option)?.display ?? 'Unknown'
                  }
                  onChange={(event, value) => {
                    if (value) {
                      localStorage.setItem('selectedServiceCategories', JSON.stringify(value));
                    } else {
                      localStorage.removeItem('selectedServiceCategories');
                    }

                    if (handleSubmit) {
                      handleSubmit(event as any, value, 'serviceCategories');
                    }
                  }}
                  multiple
                  renderInput={(params) => (
                    <TextField name="serviceCategories" {...params} label="Service category" required={false} />
                  )}
                />
                <Box style={{ flex: 0.75 }}>
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
                  />
                </Box>
                <Box style={{ flex: 1 }}>
                  <ProvidersSelect providers={providers} practitioners={practitioners} handleSubmit={handleSubmit} />
                </Box>
                <Link to="/visits/add">
                  <Button
                    data-testid={dataTestIds.dashboard.addPatientButton}
                    sx={{
                      borderRadius: 100,
                      textTransform: 'none',
                      fontWeight: 600,
                      marginTop: '8px',
                    }}
                    color="primary"
                    variant="contained"
                  >
                    <AddIcon />
                    <Typography fontWeight="bold">Visit</Typography>
                  </Button>
                </Link>
              </Stack>
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
                  <Typography fontWeight="bold">Visit</Typography>
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
            <AppointmentTabs
              location={locationSelected}
              providers={providers}
              preBookedAppointments={preBookedAppointments}
              cancelledAppointments={cancelledAppointments}
              completedAppointments={completedAppointments}
              inOfficeAppointments={inOfficeAppointments}
              orders={orders}
              vitals={vitals}
              loading={loadingState.status === 'loading'}
              updateAppointments={updateAppointments}
              setEditingComment={setEditingComment}
            />
          </Box>
          {FEATURE_FLAGS.DEMO_VISITS_ENABLED && <CreateDemoVisits />}
        </>
      </PageContainer>
    </form>
  );
}
