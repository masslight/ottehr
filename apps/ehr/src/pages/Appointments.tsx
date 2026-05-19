import AddIcon from '@mui/icons-material/Add';
import { Autocomplete, Box, Button, Paper, Stack, TextField, Typography } from '@mui/material';
import Oystehr from '@oystehr/sdk';
import { VisitType } from 'config-types';
import { Practitioner } from 'fhir/r4b';
import { DateTime } from 'luxon';
import React, { ReactElement, useCallback, useEffect, useMemo, useState } from 'react';
import { usePageVisibility } from 'react-page-visibility';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import AppointmentsFilters from 'src/components/AppointmentsFilters';
import { FEATURE_FLAGS } from 'src/constants/feature-flags';
import { useGetVitalsForEncounters } from 'src/features/visits/shared/components/vitals/hooks/useGetVitals';
import { useGetOrdersForTrackingBoard } from 'src/hooks/useGetOrdersForTrackingBoard';
import { useDebounce } from 'src/shared/hooks/useDebounce';
import { AppointmentType, BOOKING_CONFIG, InPersonAppointmentInformation } from 'utils';
import { getAppointments } from '../api/api';
import AppointmentTabs from '../components/AppointmentTabs';
import CreateDemoVisits from '../components/CreateDemoVisits';
import DateSearch from '../components/DateSearch';
import LocationSelect, { LocationType } from '../components/LocationSelect';
import ProvidersSelect from '../components/ProvidersSelect';
import { dataTestIds } from '../constants/data-test-ids';
import { adjustTopForBannerHeight } from '../helpers/misc.helper';
import { useApiClients } from '../hooks/useAppClients';
import PageContainer from '../layout/PageContainer';
import { LocationWithWalkinSchedule } from './AddPatient';

// keys are the appointment-type strings get-appointments uses:
// `${'in-person' | 'virtual'}-${AppointmentType}`
const ALL_VISIT_TYPE_LABELS = {
  'in-person-walk-in': 'Walk-in In Person Visit',
  'in-person-pre-booked': 'Pre-booked In Person Visit',
  'in-person-post-telemed': 'Post Telemed Lab Only',
  'virtual-walk-in': 'On-demand Telemed',
  'virtual-pre-booked': 'Pre-booked Telemed',
} as const satisfies Partial<Record<`${'in-person' | 'virtual'}-${AppointmentType}`, string>>;
type VisitTypeFilterKey = keyof typeof ALL_VISIT_TYPE_LABELS;

// this map bridges visit and appointment types so we can filter only the options configured for the
// project
const FILTER_KEY_TO_BOOKING_OPTION_ID: Record<VisitTypeFilterKey, VisitType> = {
  'in-person-walk-in': VisitType.InPersonWalkIn,
  'in-person-pre-booked': VisitType.InPersonPreBook,
  'in-person-post-telemed': VisitType.InPersonPostTelemed,
  'virtual-walk-in': VisitType.VirtualOnDemand,
  'virtual-pre-booked': VisitType.VirtualScheduled,
};

const getVisitTypeToLabel = (): Partial<typeof ALL_VISIT_TYPE_LABELS> => {
  const enabledBookingOptionIds = new Set(BOOKING_CONFIG.ehrBookingOptions.map((opt) => opt.id));
  return Object.fromEntries(
    (Object.entries(ALL_VISIT_TYPE_LABELS) as [VisitTypeFilterKey, string][]).filter(([key]) =>
      enabledBookingOptionIds.has(FILTER_KEY_TO_BOOKING_OPTION_ID[key])
    )
  );
};

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

  const visitTypeToLabel = useMemo(() => getVisitTypeToLabel(), []);

  useEffect(() => {
    const allowedKeys = Object.keys(visitTypeToLabel);
    const stored = localStorage.getItem('selectedVisitTypes');
    let selected: string[] | null = null;
    if (stored) {
      try {
        const parsed: unknown = JSON.parse(stored);
        if (Array.isArray(parsed)) {
          const filtered = parsed.filter((k): k is string => typeof k === 'string' && allowedKeys.includes(k));
          if (filtered.length > 0) selected = filtered;
        }
      } catch {
        // malformed storage, fall through to defaults
      }
    }
    const next = (selected ?? allowedKeys).join(',');
    if (queryParams.get('visitType') === next) return;
    queryParams.set('visitType', next);
    navigate(`?${queryParams.toString()}`);
  }, [navigate, queryParams, visitTypeToLabel]);

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

    if (oystehrZambda) {
      void getPractitioners(oystehrZambda);
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
          searchDate,
          locationIds: [locationID],
          providerIds: providers,
          serviceCategories,
          visitType,
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
            <AppointmentsFilters s={''} />
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
                    locationType={[LocationType.IN_PERSON, LocationType.VIRTUAL]}
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
                  options={Object.keys(visitTypeToLabel)}
                  getOptionLabel={(option) => {
                    return (visitTypeToLabel as Record<string, string>)[option];
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
                  options={BOOKING_CONFIG.serviceCategories.map((sc) => sc.category.code)}
                  getOptionLabel={(option) =>
                    BOOKING_CONFIG.serviceCategories.find((sc) => sc.category.code === option)?.category.display ??
                    'Unknown'
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
              showSelectFiltersMessage={!locationSelected && providers?.length === 0 && serviceCategories?.length === 0}
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
