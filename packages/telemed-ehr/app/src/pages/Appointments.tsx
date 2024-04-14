import { Error as ErrorIcon } from '@mui/icons-material';
import AddIcon from '@mui/icons-material/Add';
import { Button, Grid, Paper, Typography } from '@mui/material';
import { Location } from 'fhir/r4';
import { DateTime } from 'luxon';
import { ReactElement, useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { otherColors } from '../CustomThemeProvider';
import { getAppointments } from '../api/api';
import AppointmentTabs from '../components/AppointmentTabs';
import ChatModal from '../components/ChatModal';
import DateSearch from '../components/DateSearch';
import LocationSelect from '../components/LocationSelect';
import { ChatProvider } from '../contexts/ChatContext';
import { useApiClients } from '../hooks/useAppClients';
import PageContainer from '../layout/PageContainer';
import { AppointmentInformation } from '../types/types';

enum LoadingState {
  initial,
  loading,
  idle,
}

interface AppointmentSearchResultData {
  preBooked: AppointmentInformation[] | undefined;
  completed: AppointmentInformation[] | undefined;
  cancelled: AppointmentInformation[] | undefined;
  inOffice: AppointmentInformation[] | undefined;
  activeApptDatesBeforeToday: string[] | undefined;
}

interface StructuredAppointmentData {
  preBookedAppointments: AppointmentInformation[];
  completedAppointments: AppointmentInformation[];
  cancelledAppointments: AppointmentInformation[];
  inOfficeAppointments: AppointmentInformation[];
  activeApptDatesBeforeToday: string[];
}

type CustomFormEventHandler = (event: React.FormEvent<HTMLFormElement>, value: any, field: string) => void;

export default function Appointments(): ReactElement {
  const { zambdaClient } = useApiClients();
  const [locationSelected, setLocationSelected] = useState<Location | undefined>(undefined);
  const [loadingState, setLoadingState] = useState<LoadingState>(LoadingState.initial);
  const [appointmentDate, setAppointmentDate] = useState<DateTime | null>(DateTime.local());
  const [editingComment, setEditingComment] = useState<boolean>(false);
  const [searchResults, setSearchResults] = useState<AppointmentSearchResultData | null>(null);
  const location = useLocation();
  const navigate = useNavigate();
  const handleSubmit: CustomFormEventHandler = (event: any, value: any, field: string): void => {
    if (field === 'date') {
      queryParams?.set('searchDate', value?.toISODate() ?? appointmentDate?.toISODate() ?? '');
    } else if (field === 'location') {
      queryParams?.set('locationId', value?.id ?? locationSelected?.id ?? '');
    }

    setEditingComment(false);
    navigate(`?${queryParams?.toString()}`);
  };

  const queryParams = useMemo(() => {
    return new URLSearchParams(location.search);
  }, [location.search]);
  const locationId = queryParams.get('locationId') || '';
  const searchDate = queryParams.get('searchDate') || '';

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
    const locationStore = localStorage?.getItem('selectedLocation');
    if (locationStore && !locationSelected) {
      setLocationSelected(JSON.parse(locationStore));
    }
    const dateStore = localStorage?.getItem('selectedDate');
    if (dateStore && !appointmentDate) {
      setAppointmentDate?.(JSON.parse(localStorage.getItem('selectedDate') ?? '') ?? null);
    }
  }, [appointmentDate, locationSelected, queryParams]);

  const updateAppointments = useCallback(async () => {
    if (!locationSelected) {
      return;
    }
    if (!zambdaClient) {
      throw new Error('Zambda Client not found');
    }
    if (editingComment) {
      return;
    }
    setLoadingState(LoadingState.loading);
    const timezone = locationSelected.extension?.find(
      (extTemp) => extTemp.url === 'http://hl7.org/fhir/StructureDefinition/timezone',
    )?.valueString;

    if ((locationId || locationSelected?.id) && (searchDate || appointmentDate)) {
      const searchResults = await getAppointments(zambdaClient, {
        locationId: locationId || locationSelected?.id || undefined,
        searchDate: (searchDate && DateTime.fromISO(searchDate, { zone: timezone })) || appointmentDate || undefined,
      });

      if (searchResults == null) {
        setLoadingState(LoadingState.idle);
        return;
      }

      setSearchResults(searchResults);

      setLoadingState(LoadingState.idle);
    }
    // await getConversations();
  }, [appointmentDate, editingComment, locationId, locationSelected, searchDate, zambdaClient]);

  // todo: rework this
  useEffect(() => {
    const appointmentInterval = setInterval(updateAppointments, 14000);
    // Call updateAppointments so we don't need to wait for it to be called

    if (queryParams) {
      updateAppointments().catch((error) => console.log(error));
    }
    // getConversations().catch((error) => console.log(error));
    return () => clearInterval(appointmentInterval);
  }, [editingComment, queryParams, updateAppointments]);

  return (
    <ChatProvider
      appointments={[
        ...preBookedAppointments,
        ...completedAppointments,
        ...inOfficeAppointments,
        ...cancelledAppointments,
      ]}
    >
      <AppointmentsBody
        loadingState={loadingState}
        queryParams={queryParams}
        handleSubmit={handleSubmit}
        activeApptDatesBeforeToday={activeApptDatesBeforeToday}
        preBookedAppointments={preBookedAppointments}
        completedAppointments={completedAppointments}
        cancelledAppointments={cancelledAppointments}
        inOfficeAppointments={inOfficeAppointments}
        appointmentDate={appointmentDate}
        setAppointmentDate={setAppointmentDate}
        locationSelected={locationSelected}
        setLocationSelected={setLocationSelected}
        updateAppointments={updateAppointments}
        setEditingComment={setEditingComment}
      />
    </ChatProvider>
  );
}

interface AppointmentsBodyProps {
  loadingState: LoadingState;
  activeApptDatesBeforeToday: string[];
  preBookedAppointments: AppointmentInformation[];
  completedAppointments: AppointmentInformation[];
  cancelledAppointments: AppointmentInformation[];
  inOfficeAppointments: AppointmentInformation[];
  appointmentDate: DateTime | null;
  locationSelected: Location | undefined;
  handleSubmit: CustomFormEventHandler;
  queryParams?: URLSearchParams;
  setAppointmentDate: (date: DateTime | null) => void;
  setLocationSelected: (location: Location | undefined) => void;
  updateAppointments: () => Promise<void>;
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
    appointmentDate,
    locationSelected,
    setAppointmentDate,
    setLocationSelected,
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
            <Grid container spacing={2}>
              <Grid item xs={5}>
                <LocationSelect
                  queryParams={queryParams}
                  handleSubmit={handleSubmit}
                  location={locationSelected}
                  updateURL={true}
                  storeLocationInLocalStorage={true}
                  setLocation={setLocationSelected}
                ></LocationSelect>
              </Grid>
              <Grid item xs={5}>
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
              <Grid item xs={2} sx={{ alignSelf: 'center' }}>
                <Link to="/visits/add">
                  <Button
                    sx={{
                      borderRadius: 100,
                      textTransform: 'none',
                      fontWeight: 600,
                      marginLeft: '16px',
                    }}
                    color="primary"
                    variant="contained"
                  >
                    <AddIcon />
                    <Typography fontWeight="bold" marginLeft={0.5}>
                      Add patient
                    </Typography>
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
          <ChatModal />
          <AppointmentTabs
            location={locationSelected}
            preBookedAppointments={preBookedAppointments}
            cancelledAppointments={cancelledAppointments}
            completedAppointments={completedAppointments}
            inOfficeAppointments={inOfficeAppointments}
            loading={loadingState === LoadingState.loading}
            updateAppointments={updateAppointments}
            setEditingComment={setEditingComment}
          />
        </>
      </PageContainer>
    </form>
  );
}
