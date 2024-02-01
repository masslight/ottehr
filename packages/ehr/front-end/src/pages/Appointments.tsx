import { Location } from 'fhir/r4';
import { DateTime } from 'luxon';
import { ReactElement, useCallback, useEffect, useMemo, useState } from 'react';
import { Paper, Button, Typography, Grid } from '@mui/material';
import PageContainer from '../layout/PageContainer';
import AppointmentTabs from '../components/AppointmentTabs';
import LocationSelect from '../components/LocationSelect';
import DateSearch from '../components/DateSearch';
import { useZambdaClient } from '../hooks/useZambdaClient';
import { getAppointments } from '../api/api';
import { AppointmentInformation } from '../types/types';
import ChatModal from '../components/ChatModal';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import AddIcon from '@mui/icons-material/Add';
import { ChatProvider } from '../contexts/ChatContext';

enum LoadingState {
  initial,
  loading,
  idle,
}

type CustomFormEventHandler = (event: React.FormEvent<HTMLFormElement>, value: any, field: string) => void;

export default function Appointments(): ReactElement {
  const zambdaClient = useZambdaClient();
  const [locationSelected, setLocationSelected] = useState<Location | undefined>(undefined);
  const [loadingState, setLoadingState] = useState<LoadingState>(LoadingState.initial);
  const [preBookedAppointments, setPreBookedAppointments] = useState<AppointmentInformation[]>([]);
  const [completedAppointments, setCompletedAppointments] = useState<AppointmentInformation[]>([]);
  const [inOfficeAppointments, setInOfficeAppointments] = useState<AppointmentInformation[]>([]);
  const [appointmentDate, setAppointmentDate] = useState<DateTime | null>(DateTime.local());
  const [editingComment, setEditingComment] = useState<boolean>(false);
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

      setPreBookedAppointments(searchResults?.preBooked);
      setCompletedAppointments(searchResults?.completed);
      setInOfficeAppointments(searchResults?.inOffice);

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
    <ChatProvider appointments={[...preBookedAppointments, ...completedAppointments, ...inOfficeAppointments]}>
      <AppointmentsBody
        loadingState={loadingState}
        queryParams={queryParams}
        handleSubmit={handleSubmit}
        preBookedAppointments={preBookedAppointments}
        completedAppointments={completedAppointments}
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
  preBookedAppointments: AppointmentInformation[];
  completedAppointments: AppointmentInformation[];
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
    preBookedAppointments,
    completedAppointments,
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
                <Link to="/appointments/add">
                  <Button
                    sx={{
                      borderRadius: 100,
                      textTransform: 'none',
                      fontWeight: 600,
                      marginLeft: '16px',
                      backgroundColor: '#2896C6',
                      color: '#FFFFFF',
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
          <ChatModal />
          <AppointmentTabs
            location={locationSelected?.name || ''}
            preBookedAppointments={preBookedAppointments}
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
