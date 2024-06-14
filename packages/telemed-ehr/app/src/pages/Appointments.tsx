import { Error as ErrorIcon } from '@mui/icons-material';
import AddIcon from '@mui/icons-material/Add';
import { Autocomplete, Button, Grid, Paper, TextField, Typography } from '@mui/material';
import { ZambdaClient } from '@zapehr/sdk';
import { Location } from 'fhir/r4';
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
  const { zambdaClient } = useApiClients();
  const [locationSelected, setLocationSelected] = useState<Location | undefined>(undefined);
  const [loadingState, setLoadingState] = useState<LoadingState>({ status: 'initial' });
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
      queryParams?.set('locationId', value?.id ?? locationSelected?.id ?? '');
    } else if (field === 'visittypes') {
      const appointmentTypesString = value.join(',');
      queryParams.set('visitType', appointmentTypesString);
    }

    setEditingComment(false);
    navigate(`?${queryParams?.toString()}`);
  };

  const queryParams = useMemo(() => {
    return new URLSearchParams(location.search);
  }, [location.search]);

  const { locationId, searchDate, visitType, queryId } = useMemo(() => {
    const locationId = queryParams.get('locationId') || '';
    const searchDate = queryParams.get('searchDate') || '';
    const appointmentTypesString = queryParams.get('visitType') || '';
    const queryId = `${locationId}-${searchDate}-${appointmentTypesString}`;
    const visitType = appointmentTypesString ? appointmentTypesString.split(',') : [];
    return { locationId, searchDate, visitType, queryId };
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
    const fetchStuff = async (zambdaClient: ZambdaClient, searchDate: DateTime | undefined): Promise<void> => {
      setLoadingState({ status: 'loading' });

      if ((locationId || locationSelected?.id) && (searchDate || appointmentDate) && Array.isArray(visitType)) {
        const searchResults = await getAppointments(zambdaClient, {
          locationId: locationId || locationSelected?.id || undefined,
          searchDate,
          visitType: visitType || [],
        });

        setSearchResults(searchResults || []);

        setLoadingState({ status: 'loaded', id: queryId });
      }
    };
    if (
      locationSelected &&
      zambdaClient &&
      !editingComment &&
      loadingState.id !== queryId &&
      loadingState.status !== 'loading' &&
      pageIsVisible
    ) {
      const timezone =
        locationSelected.extension?.find(
          (extTemp) => extTemp.url === 'http://hl7.org/fhir/StructureDefinition/timezone',
        )?.valueString ?? 'America/New_York';
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
    locationId,
    searchDate,
    appointmentDate,
    visitType,
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
      activeApptDatesBeforeToday={activeApptDatesBeforeToday}
      preBookedAppointments={preBookedAppointments}
      completedAppointments={completedAppointments}
      cancelledAppointments={cancelledAppointments}
      inOfficeAppointments={inOfficeAppointments}
      locationSelected={locationSelected}
      setLocationSelected={setLocationSelected}
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
  setLocationSelected: (location: Location | undefined) => void;
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
              <Grid item xs={2.8}>
                <LocationSelect
                  queryParams={queryParams}
                  handleSubmit={handleSubmit}
                  location={locationSelected}
                  updateURL={true}
                  storeLocationInLocalStorage={true}
                  setLocation={setLocationSelected}
                ></LocationSelect>
              </Grid>
              <Grid item xs={4.7}>
                <Autocomplete
                  id="visittypes"
                  sx={{
                    '.MuiButtonBase-root.MuiChip-root': {
                      width: '120px',
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
              <Grid item xs={2.8}>
                <DateSearch
                  label="Select Date"
                  queryParams={queryParams}
                  handleSubmit={handleSubmit}
                  date={appointmentDate}
                  setDate={setAppointmentDate}
                  updateURL={true}
                  storeDateInLocalStorage={true}
                  defaultValue={DateTime.now().toLocaleString(DateTime.DATE_SHORT)}
                ></DateSearch>
              </Grid>
              <Grid item xs={1.4} sx={{ alignSelf: 'center' }}>
                <Link to="/visits/add">
                  <Button
                    sx={{
                      borderRadius: 100,
                      textTransform: 'none',
                      fontWeight: 600,
                    }}
                    color="secondary"
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
            preBookedAppointments={preBookedAppointments}
            cancelledAppointments={cancelledAppointments}
            completedAppointments={completedAppointments}
            inOfficeAppointments={inOfficeAppointments}
            loading={loadingState.status === 'loading'}
            updateAppointments={updateAppointments}
            setEditingComment={setEditingComment}
          />
        </>
      </PageContainer>
    </form>
  );
}
