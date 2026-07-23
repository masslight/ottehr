import AddIcon from '@mui/icons-material/Add';
import { Box, Button, Typography } from '@mui/material';
import Oystehr from '@oystehr/sdk';
import { DateTime } from 'luxon';
import { enqueueSnackbar } from 'notistack';
import { ReactElement, useCallback, useEffect, useRef, useState } from 'react';
import { usePageVisibility } from 'react-page-visibility';
import { Link, useLocation, useSearchParams } from 'react-router-dom';
import AppointmentsFilters from 'src/components/AppointmentsFilters';
import { FEATURE_FLAGS } from 'src/constants/feature-flags';
import { useGetVitalsForEncounters } from 'src/features/visits/shared/components/vitals/hooks/useGetVitals';
import { useStopAmbientScribeOnLeave } from 'src/features/visits/shared/stores/audioRecording.store';
import { useGetOrdersForTrackingBoard } from 'src/hooks/useGetOrdersForTrackingBoard';
import { useDebounce } from 'src/shared/hooks/useDebounce';
import { APIErrorCode, InPersonAppointmentInformation, MAX_APPOINTMENT_SEARCH_RANGE_DAYS } from 'utils';
import { getAppointments } from '../api/api';
import AppointmentTabs from '../components/AppointmentTabs';
import CreateDemoVisits from '../components/CreateDemoVisits';
import { adjustTopForBannerHeight } from '../helpers/misc.helper';
import { useApiClients } from '../hooks/useAppClients';
import PageContainer from '../layout/PageContainer';

type LoadingState = { status: 'loading' | 'initial'; id?: string | undefined } | { status: 'loaded'; id: string };

interface AppointmentSearchResultData {
  preBooked: InPersonAppointmentInformation[] | undefined;
  completed: InPersonAppointmentInformation[] | undefined;
  cancelled: InPersonAppointmentInformation[] | undefined;
  inOffice: InPersonAppointmentInformation[] | undefined;
}

export default function Appointments(): ReactElement {
  const { oystehrZambda } = useApiClients();
  const [loadingState, setLoadingState] = useState<LoadingState>({ status: 'initial' });
  const [editingComment, setEditingComment] = useState<boolean>(false);
  const [searchParams] = useSearchParams();
  const [searchResults, setSearchResults] = useState<AppointmentSearchResultData | null>(null);
  const [appointmentsVersion, setAppointmentsVersion] = useState(0);
  const pageIsVisible = usePageVisibility(); // goes to false if tab loses focus and gives the fhir api a break
  const { debounce } = useDebounce(300);
  // Mobile appointment rows host the Ambient Scribe recorder; continue across rotation, save on leave.
  const { pathname } = useLocation();
  useStopAmbientScribeOnLeave({ hostKey: pathname });

  const locationParam = searchParams.get('location');
  const visitTypeParam = searchParams.get('visitType');
  const serviceCategoryParam = searchParams.get('serviceCategory');
  const dateFromParam = searchParams.get('dateFrom');
  const dateToParam = searchParams.get('dateTo');
  const providerParam = searchParams.get('provider');
  const queryId = [locationParam, visitTypeParam, serviceCategoryParam, dateFromParam, dateToParam, providerParam].join(
    ':'
  );
  // Latest filters, readable from inside an in-flight fetch: when the filters change mid-request,
  // the response that comes back is for a query the user is no longer looking at and is discarded.
  const latestQueryIdRef = useRef(queryId);
  latestQueryIdRef.current = queryId;
  // Validate as real ISO dates (not just truthy + string ordering) so a malformed `dateFrom`/`dateTo`
  // link can't trigger a get-appointments request that only fails server-side. ISO dates also sort
  // correctly lexicographically, so the string comparison is safe once both are confirmed valid. The
  // span is also capped to match the zambda, so an over-large range is skipped instead of round-tripping
  // to a guaranteed server-side rejection.
  const hasValidDateRange = Boolean(
    dateFromParam &&
      dateToParam &&
      DateTime.fromISO(dateFromParam).isValid &&
      DateTime.fromISO(dateToParam).isValid &&
      dateFromParam <= dateToParam &&
      DateTime.fromISO(dateToParam, { zone: 'utc' }).diff(DateTime.fromISO(dateFromParam, { zone: 'utc' }), 'days')
        .days <= MAX_APPOINTMENT_SEARCH_RANGE_DAYS
  );

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
    const locations = locationParam?.split(',') ?? [];
    const visitType = visitTypeParam?.split(',') ?? [];
    const serviceCategories = serviceCategoryParam?.split(',') ?? [];
    const providers = providerParam?.split(',') ?? [];

    const discardStaleFetch = (): void => {
      setLoadingState((prev) => (prev.status === 'loading' && prev.id === queryId ? { status: 'initial' } : prev));
    };

    const fetchStuff = async (client: Oystehr): Promise<void> => {
      setLoadingState({ status: 'loading', id: queryId });

      if (
        (locations.length > 0 || providers.length > 0 || serviceCategories.length > 0) &&
        dateFromParam &&
        dateToParam &&
        visitType
      ) {
        try {
          const searchResults = await getAppointments(client, {
            searchDateFrom: dateFromParam,
            searchDateTo: dateToParam,
            timezone: DateTime.now().zoneName,
            locationIds: locations,
            providerIds: providers,
            serviceCategories,
            visitType,
            supervisorApprovalEnabled: FEATURE_FLAGS.SUPERVISOR_APPROVAL_ENABLED,
          });

          if (latestQueryIdRef.current !== queryId) {
            // The filters changed while this request was in flight; rendering this response would
            // briefly show the old filters' results.
            discardStaleFetch();
            return;
          }

          // drives refetch for apis not using react hook query yet
          setAppointmentsVersion(Date.now());
          // drives refetch for apis using react hook query
          void refetchOrders();

          debounce(() => {
            if (latestQueryIdRef.current !== queryId) {
              discardStaleFetch();
              return;
            }
            setSearchResults(searchResults || []);
            setLoadingState({ status: 'loaded', id: queryId });
          });
        } catch (error) {
          if (latestQueryIdRef.current !== queryId) {
            discardStaleFetch();
            return;
          }
          console.error('error fetching appointments', error);
          const sdkError = error as Oystehr.OystehrSdkError;
          const message =
            sdkError?.code === APIErrorCode.APPOINTMENT_SEARCH_TOO_BROAD
              ? sdkError.message
              : 'Failed to load visits. Please try again in a moment.';
          enqueueSnackbar(message, { variant: 'error', preventDuplicate: true });
          setLoadingState({ status: 'loaded', id: queryId });
        }
      }
    };
    if (
      (locations.length > 0 || providers.length > 0 || serviceCategories.length > 0) &&
      hasValidDateRange &&
      oystehrZambda &&
      !editingComment &&
      // A fetch already running for different filters does not block: the new filters' fetch
      // starts immediately and the stale response is dropped above instead of rendering first.
      loadingState.id !== queryId &&
      pageIsVisible
    ) {
      void fetchStuff(oystehrZambda);
    }
  }, [
    oystehrZambda,
    editingComment,
    loadingState,
    queryId,
    pageIsVisible,
    debounce,
    refetchOrders,
    locationParam,
    visitTypeParam,
    serviceCategoryParam,
    providerParam,
    dateFromParam,
    dateToParam,
    hasValidDateRange,
  ]);

  useEffect(() => {
    const appointmentInterval = setInterval(
      // The periodic refresh skips ticks that land while a fetch is running — unlike a filter
      // change, it has nothing new to ask for, so preempting would just duplicate the request.
      () => setLoadingState((prev) => (prev.status === 'loading' ? prev : { status: 'initial' })),
      30000
    );
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
            <AppointmentsFilters />
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
              showSelectFiltersMessage={!locationParam && !providerParam && !serviceCategoryParam}
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
