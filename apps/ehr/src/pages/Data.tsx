import { LoadingButton } from '@mui/lab';
import {
  Box,
  CircularProgress,
  FormControl,
  Grid,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from '@mui/material';
import { DatePicker } from '@mui/x-date-pickers';
import { AdapterLuxon } from '@mui/x-date-pickers/AdapterLuxon';
import { LocalizationProvider } from '@mui/x-date-pickers-pro';
import {
  BarElement,
  CategoryScale,
  Chart as ChartJS,
  Colors,
  Legend,
  LinearScale,
  LineElement,
  PointElement,
  Title,
  Tooltip,
} from 'chart.js';
import { Appointment, Encounter } from 'fhir/r4b';
import { DateTime } from 'luxon';
import React from 'react';
import { Bar, Line } from 'react-chartjs-2';
import {
  FhirAppointmentType,
  getVisitStatus,
  getVisitStatusHistory,
  OTTEHR_MODULE,
  VisitStatusHistoryEntry,
  VisitStatusHistoryLabel,
  VisitStatusLabel,
} from 'utils';
import { CHIP_STATUS_MAP } from '../components/AppointmentTableRow';
import LocationSelect from '../components/LocationSelect';
import { getTimezone } from '../helpers/formatDateTime';
import { useApiClients } from '../hooks/useAppClients';
import PageContainer from '../layout/PageContainer';
import { LocationWithWalkinSchedule } from './AddPatient';

interface AppointmentCount {
  date: DateTime;
  appointments: number;
}

interface VisitStatusMetrics {
  numAppointments: number;
  averageTime: number;
}

interface FormattedAppointment {
  id: string;
  visitStatus: VisitStatusLabel;
  visitStatusHistory: VisitStatusHistoryEntry[];
}

export enum ChartType {
  table = 'table',
  chart = 'chart',
}

enum VisitTypeAll {
  All = 'all',
}

enum TimeRange {
  Today = 'Today',
  Yesterday = 'Yesterday',
  ThisWeek = 'This Week',
  ThisMonth = 'This Month',
  LastWeek = 'Last Week',
  LastMonth = 'Last Month',
  PastSeven = 'Past Seven Days',
  PastThirty = 'Past Thirty Days',
  Custom = 'Custom',
}

export default function Data(): React.ReactElement {
  const [appointmentCountByDate, setAppointmentCountByDate] = React.useState<AppointmentCount[] | undefined>(undefined);
  const [appointmentStatuses, setAppointmentStatuses] = React.useState<
    { [status in VisitStatusHistoryLabel]: VisitStatusMetrics } | undefined
  >(undefined);
  const [appointmentsSeenIn45Ratio, setAppointmentsSeenIn45Ratio] = React.useState<number | undefined>(undefined);
  const [avgMinutesToProvider, setAvgMinutesToProvider] = React.useState<number | undefined>(undefined);
  const [totalVisits, setTotalVisits] = React.useState<number | undefined>(undefined);
  const [timeRange, setTimeRange] = React.useState<TimeRange>(TimeRange.Today);
  const [locationSelected, setLocationSelected] = React.useState<LocationWithWalkinSchedule | undefined>(undefined);
  const [visitType, setVisitType] = React.useState<FhirAppointmentType | VisitTypeAll>(VisitTypeAll.All);
  const [filterStartDate, setStartFilterDate] = React.useState<DateTime | null>(DateTime.now());
  const [filterEndDate, setEndFilterDate] = React.useState<DateTime | null>(DateTime.now());
  const [customFilterStartDate, setCustomStartFilterDate] = React.useState<DateTime | null>(null);
  const [customFilterEndDate, setCustomEndFilterDate] = React.useState<DateTime | null>(null);
  const [loading, setLoading] = React.useState<boolean>(true);
  const [error, setError] = React.useState<string | null>(null);
  const [now] = React.useState<DateTime>(DateTime.now());
  const [type, setType] = React.useState<ChartType>(ChartType.chart);
  const { oystehr } = useApiClients();
  ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, BarElement, Legend, Title, Tooltip, Colors);

  // todo clean up
  // passing in an empty query params obj to location select because its required atm
  // not touching any code outside the data page at this point in dev
  const queryParams = new URLSearchParams({});

  React.useEffect(() => {
    const locationStore = localStorage?.getItem('selectedLocation');
    if (locationStore && !locationSelected) {
      setLocationSelected(JSON.parse(locationStore));
    }
  }, [locationSelected]);

  React.useEffect(() => {
    async function updateAppointments(): Promise<void> {
      setLoading(true);
      setError(null);
      if (
        locationSelected &&
        filterStartDate &&
        filterEndDate &&
        filterEndDate.startOf('day') >= filterStartDate.startOf('day')
      ) {
        const timezone = getTimezone(locationSelected);

        let totalVisits = 0;
        const visitCountByDay: Record<string, number> = {};
        const daysDiff = Math.floor(filterEndDate.startOf('day').diff(filterStartDate.startOf('day')).as('days'));
        let temp = filterStartDate;
        for (let i = 0; i <= daysDiff; i++) {
          const formattedDay = temp.toFormat('y-MM-dd');
          if (formattedDay) visitCountByDay[formattedDay] = 0;
          temp = temp.plus({ day: 1 });
        }

        if (!oystehr) return;

        const searchParams = [
          { name: 'date', value: `ge${filterStartDate.setZone(timezone).startOf('day')}` },
          { name: 'date', value: `le${filterEndDate.setZone(timezone).endOf('day')}` },
          {
            name: 'location',
            value: `Location/${locationSelected?.id}`,
          },
          {
            name: '_revinclude:iterate',
            value: 'Encounter:appointment',
          },
          {
            name: '_tag',
            value: OTTEHR_MODULE.IP,
          },
        ];
        if (visitType !== VisitTypeAll.All) searchParams.push({ name: 'appointment-type', value: visitType });
        const appointmentEncounterSearch = (
          await oystehr.fhir.search<Appointment | Encounter>({
            resourceType: 'Appointment',
            params: searchParams,
          })
        ).unbundle();
        console.log('appointmentEncounterSearch', appointmentEncounterSearch);
        const appointmentEncounterMap: Record<string, Encounter | undefined> = {};
        const formattedAppointments: FormattedAppointment[] = [];
        appointmentEncounterSearch.forEach((resource) => {
          if (resource.resourceType === 'Appointment') {
            const fhirAppointment = resource as Appointment;
            if (fhirAppointment.status === 'fulfilled' && fhirAppointment.id) {
              const appointmentDate =
                fhirAppointment.start && DateTime.fromISO(fhirAppointment.start).toFormat('y-MM-dd');
              if (appointmentDate) {
                totalVisits++;
                visitCountByDay[appointmentDate]++;
              }
              const encounter = appointmentEncounterSearch.find(
                (r) =>
                  r.resourceType === 'Encounter' && r.appointment?.[0].reference === `Appointment/${fhirAppointment.id}`
              );
              if (encounter) {
                const fhirEncounter = encounter as Encounter;
                appointmentEncounterMap[fhirAppointment.id] = fhirEncounter;
                const visitStatus = getVisitStatus(fhirAppointment, fhirEncounter);
                const visitStatusHistory = getVisitStatusHistory(fhirEncounter);
                formattedAppointments.push({ id: fhirAppointment.id, visitStatus, visitStatusHistory });
              }
            }
          }
        });
        const appointmentCountByDateTemp = Object.keys(visitCountByDay).map((day) => {
          return { date: DateTime.fromISO(day), appointments: visitCountByDay[day] };
        });
        console.log('visitCountByDay', visitCountByDay);

        const statusesCount: { [status in VisitStatusHistoryLabel]: VisitStatusMetrics } = {
          pending: { numAppointments: 0, averageTime: 0 },
          arrived: { numAppointments: 0, averageTime: 0 },
          intake: { numAppointments: 0, averageTime: 0 },
          'ready for provider': { numAppointments: 0, averageTime: 0 },
          provider: { numAppointments: 0, averageTime: 0 },
          'ready for discharge': { numAppointments: 0, averageTime: 0 },
          cancelled: { numAppointments: 0, averageTime: 0 },
          'no show': { numAppointments: 0, averageTime: 0 },
          completed: { numAppointments: 0, averageTime: 0 },
        };

        let patientToProviderIn45Count = 0; // count of appointments where the patient was seen by provider within 45 minutes of arriving
        const minutesToProvider: number[] = []; // list wait times for patients to reach providers from arrival for each appointment where the patient saw a provider
        formattedAppointments.forEach((appointment) => {
          let timeArrived, timeSeenByProvider;
          appointment.visitStatusHistory?.forEach((statusTemp) => {
            const statusName = statusTemp.status as VisitStatusHistoryLabel;
            const statusPeriod = statusTemp.period;
            if (statusName !== 'no show' && statusName !== 'completed' && statusName !== 'cancelled') {
              if (statusPeriod.end && statusPeriod.start) {
                const statusTime = DateTime.fromISO(statusPeriod.end)
                  .diff(DateTime.fromISO(statusPeriod.start), 'minutes')
                  .toObject().minutes;
                if (statusTime) {
                  statusesCount[statusName].averageTime =
                    (statusesCount[statusName].numAppointments * statusesCount[statusName].averageTime + statusTime) /
                    (statusesCount[statusName].numAppointments + 1);
                  statusesCount[statusName].numAppointments = statusesCount[statusName].numAppointments + 1;
                }
              }
              if (statusName === 'arrived') {
                timeArrived = statusPeriod.start;
              }
              if (statusName === 'provider') {
                timeSeenByProvider = statusPeriod.start;
              }
            }
          });
          if (timeArrived && timeSeenByProvider) {
            const minutesToProviderTemp = DateTime.fromISO(timeSeenByProvider).diff(
              DateTime.fromISO(timeArrived),
              'minutes'
            ).minutes;
            if (minutesToProviderTemp <= 45) patientToProviderIn45Count += 1;
            minutesToProvider.push(minutesToProviderTemp);
          }
          setAppointmentStatuses(statusesCount);
        });

        if (formattedAppointments.length) {
          if (totalVisits > 0) {
            const percentSeen = Math.round((patientToProviderIn45Count / totalVisits) * 1000) / 10;
            setAppointmentsSeenIn45Ratio(percentSeen);
          }
          if (minutesToProvider.length > 0) {
            const avgMinutesToProviderTemp =
              minutesToProvider.reduce((acc, minutes) => acc + minutes, 0) / minutesToProvider.length;
            setAvgMinutesToProvider(Math.round(avgMinutesToProviderTemp * 10) / 10);
          }
        } else {
          setAppointmentStatuses(statusesCount);
        }

        setLoading(false);
        setTotalVisits(totalVisits);
        setAppointmentCountByDate(appointmentCountByDateTemp);
        if (formattedAppointments?.length === 0) {
          setError('No completed (checked out) appointments for this time range');
        }
      } else {
        if (locationSelected) setLoading(false);
        if (filterStartDate && filterEndDate && filterStartDate.startOf('day') > filterEndDate.startOf('day')) {
          setError('Please make sure start date is before end date');
        } else {
          console.log('filterStartDate', filterStartDate?.toISO());
          console.log('filterEndDate', filterEndDate?.toISO());
          setError('Please make sure there is a start and end date for the filter');
        }
      }
    }

    updateAppointments().catch((error) => console.log('error getting appointment update', error));
  }, [oystehr, now, visitType, filterStartDate, filterEndDate, locationSelected]);

  const handleCustomTimeRange = (): void => {
    if (customFilterEndDate && customFilterStartDate) {
      setStartFilterDate(customFilterStartDate);
      setEndFilterDate(customFilterEndDate);
    }
  };

  const setFilterDates = (range: TimeRange): void => {
    let startDate, endDate;
    if (range !== TimeRange.Custom && (customFilterEndDate || customFilterStartDate)) {
      setCustomStartFilterDate(null);
      setCustomEndFilterDate(null);
    }
    if (range === TimeRange.Today) {
      startDate = DateTime.now();
      endDate = DateTime.now();
    }
    if (range === TimeRange.Yesterday) {
      startDate = DateTime.now().minus({ day: 1 });
      endDate = DateTime.now().minus({ day: 1 });
    }
    if (range === TimeRange.ThisWeek) {
      startDate = DateTime.now().startOf('week');
      endDate = startDate.plus({ day: 6 });
    }
    if (range === TimeRange.ThisMonth) {
      startDate = DateTime.now().startOf('month');
      endDate = DateTime.now().minus({ days: 1 });
    }
    if (range === TimeRange.LastWeek) {
      const lastWeekNum = DateTime.now().startOf('week').minus({ day: 1 });
      startDate = lastWeekNum.startOf('week');
      endDate = startDate.plus({ day: 6 });
    }
    if (range === TimeRange.LastMonth) {
      const lastMonthNum = DateTime.now().startOf('month').minus({ day: 1 }).month;
      const lastYearNum = DateTime.now().startOf('month').minus({ day: 1 }).year;
      startDate = DateTime.local(lastYearNum, lastMonthNum, 1);
      endDate = startDate.endOf('month');
    }
    if (range === TimeRange.PastSeven) {
      startDate = DateTime.now().minus({ days: 7 });
      endDate = DateTime.now().minus({ days: 1 });
    }
    if (range === TimeRange.PastThirty) {
      startDate = DateTime.now().minus({ days: 30 });
      endDate = DateTime.now().minus({ days: 1 });
    }
    setStartFilterDate(startDate || null);
    setEndFilterDate(endDate || null);
  };

  const handleLocationChange = (value: any): void => {
    console.log('changing selected location to ', value?.id);
  };

  const singleNumberMetrics = [
    {
      text: '% Time-to-Provider < 45 min',
      metric: `${appointmentsSeenIn45Ratio !== undefined ? `${appointmentsSeenIn45Ratio}%` : 'no data'}`,
    },
    {
      text: 'Avg. Time-to-Provider',
      metric: `${avgMinutesToProvider ? `${avgMinutesToProvider} minutes` : 'no data'}`,
    },
    { text: 'Visits (completed)', metric: totalVisits },
  ];

  return (
    <PageContainer>
      <Grid container spacing={6}>
        <Grid item md={12} xs={12}>
          <Grid container spacing={4}>
            <Grid item md={2.25} xs={8}>
              <FormControl sx={{ width: '100%' }}>
                <LocationSelect
                  queryParams={queryParams}
                  handleSubmit={handleLocationChange}
                  location={locationSelected}
                  updateURL={false}
                  storeLocationInLocalStorage={false}
                  setLocation={setLocationSelected}
                ></LocationSelect>
              </FormControl>
            </Grid>
            <Grid item md={2} xs={8}>
              <FormControl sx={{ width: '100%' }}>
                <InputLabel id="visit-type">Visit Type</InputLabel>
                <Select
                  labelId="visit-type"
                  id="visit-type-select-input"
                  value={visitType}
                  onChange={(event) => setVisitType(event.target.value as FhirAppointmentType)}
                  label="Visit Type"
                >
                  <MenuItem value={FhirAppointmentType.prebook}>Booked</MenuItem>
                  <MenuItem value={FhirAppointmentType.walkin}>Walk-in</MenuItem>
                  <MenuItem value={VisitTypeAll.All}>All</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item md={2} xs={8}>
              <FormControl sx={{ width: '100%' }}>
                <InputLabel id="time-range">Time range</InputLabel>
                <Select
                  labelId="time-range"
                  id="time-range-select-input"
                  value={timeRange}
                  onChange={(event) => {
                    setTimeRange(event.target.value as TimeRange);
                    setFilterDates(event.target.value as TimeRange);
                  }}
                  label="Time range"
                >
                  {Object.values(TimeRange).map((range, idx) => (
                    <MenuItem key={idx} value={range}>
                      {range}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            {timeRange === TimeRange.Custom ? (
              <>
                <Grid item md={2} xs={8}>
                  <LocalizationProvider dateAdapter={AdapterLuxon}>
                    <DatePicker
                      label="Start Date"
                      format="MM/dd/yyyy"
                      onChange={setCustomStartFilterDate}
                      slotProps={{
                        textField: {
                          style: { width: '100%' },
                          name: 'start-date',
                          id: 'start-date',
                          label: 'Start Date',
                        },
                      }}
                      value={customFilterStartDate}
                    />
                  </LocalizationProvider>
                </Grid>
                <Grid item md={2} xs={8}>
                  <LocalizationProvider dateAdapter={AdapterLuxon}>
                    <DatePicker
                      label="End Date"
                      format="MM/dd/yyyy"
                      onChange={setCustomEndFilterDate}
                      slotProps={{
                        textField: {
                          style: { width: '100%' },
                          name: 'end-date',
                          id: 'end-date',
                          label: 'End Date',
                        },
                      }}
                      value={customFilterEndDate}
                    />
                  </LocalizationProvider>
                </Grid>
                <Grid item md={1.5} xs={8} sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                  <LoadingButton
                    sx={{
                      borderRadius: 100,
                      textTransform: 'none',
                      fontWeight: 600,
                      width: '100%',
                    }}
                    color="primary"
                    variant="contained"
                    loading={loading}
                    onClick={handleCustomTimeRange}
                  >
                    <Typography fontWeight="bold" marginLeft={0.5} sx={{ fontSize: '14px' }}>
                      Confirm Range
                    </Typography>
                  </LoadingButton>
                </Grid>
              </>
            ) : (
              <></>
            )}
            <Grid item md={2} xs={8}>
              <ToggleButtonGroup
                aria-label="Type, chart or table"
                exclusive
                value={type}
                onChange={(event, updatedValue) => setType(updatedValue as ChartType)}
                sx={{ width: '100%' }}
              >
                <ToggleButton value="chart">chart</ToggleButton>
                <ToggleButton value="table">table</ToggleButton>
              </ToggleButtonGroup>
            </Grid>
          </Grid>
        </Grid>
        {loading && (
          <Grid item md={12} xs={12} sx={{ textAlign: 'center' }}>
            <CircularProgress />
          </Grid>
        )}
        {error && (
          <Grid item md={12} xs={12} sx={{ textAlign: 'center' }}>
            <Typography
              sx={{
                fontSize: '22px',
              }}
            >
              {error}
            </Typography>
          </Grid>
        )}
        {!loading && !error && appointmentStatuses && (
          <>
            {singleNumberMetrics.map((metric, index) => (
              <Grid key={index} item md={4} xs={12} sx={{ width: '33%' }}>
                <Box
                  sx={{
                    backgroundColor: '#0A2143',
                    color: '#FFFFFF',
                    padding: '20px',
                    height: '100%',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    borderRadius: '15px',
                  }}
                >
                  <Typography
                    sx={{
                      fontSize: '20px',
                    }}
                  >
                    {metric.text}
                  </Typography>
                  <Typography
                    sx={{
                      textAlign: 'center',
                      fontSize: '35px',
                      paddingTop: '10px',
                    }}
                  >
                    {metric.metric}
                  </Typography>
                </Box>
              </Grid>
            ))}
            <Grid item md={12} xs={12}>
              {type === ChartType.chart ? (
                <Line
                  aria-label={`Number of visits from ${filterStartDate?.toLocaleString(
                    DateTime.DATE_SHORT
                  )} - ${filterEndDate?.toLocaleString(
                    DateTime.DATE_SHORT
                  )}, select "table" in the button group above for a table version`}
                  role="img"
                  data={{
                    labels: appointmentCountByDate?.map((countByDay) =>
                      countByDay.date.toLocaleString(DateTime.DATE_SHORT)
                    ),
                    datasets: [
                      {
                        label: 'Appointments',
                        data: appointmentCountByDate?.map((countByDay) => countByDay.appointments),
                      },
                    ],
                  }}
                  options={{
                    scales: {
                      y: {
                        beginAtZero: true,
                      },
                    },
                    plugins: {
                      title: {
                        text: `Number of visits from ${filterStartDate?.toLocaleString(
                          DateTime.DATE_SHORT
                        )} - ${filterEndDate?.toLocaleString(DateTime.DATE_SHORT)}`,
                        display: true,
                        font: {
                          size: 20,
                        },
                      },
                      legend: {
                        display: false,
                      },
                    },
                  }}
                ></Line>
              ) : (
                <TableContainer component={Paper}>
                  <Table
                    aria-label={`Number of visits from ${filterStartDate?.toLocaleString(
                      DateTime.DATE_SHORT
                    )} - ${filterEndDate?.toLocaleString(DateTime.DATE_SHORT)}`}
                  >
                    <TableHead>
                      <TableRow>
                        <TableCell sx={{ width: '40%' }}>Date</TableCell>
                        <TableCell># visits</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {appointmentCountByDate?.map((countByDay) => (
                        <TableRow>
                          <TableCell>{countByDay.date.toLocaleString(DateTime.DATE_SHORT)}</TableCell>
                          <TableCell>{countByDay.appointments}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              )}
            </Grid>
            <br />
            <Grid item md={12} xs={12}>
              {type === ChartType.chart ? (
                <Bar
                  aria-label={`Minutes in each status ${filterStartDate?.toLocaleString(
                    DateTime.DATE_SHORT
                  )} - ${filterEndDate?.toLocaleString(
                    DateTime.DATE_SHORT
                  )}, select "table" in the button group above for a table version`}
                  role="img"
                  data={{
                    labels: Object.keys(appointmentStatuses).filter(
                      (keyTemp) =>
                        keyTemp !== 'no show' &&
                        keyTemp !== 'canceled' &&
                        keyTemp !== 'checked out' &&
                        keyTemp !== 'pending'
                    ),
                    datasets: [
                      {
                        label: 'Status',
                        data: Object.keys(appointmentStatuses)
                          .filter(
                            (keyTemp) =>
                              keyTemp !== 'no show' &&
                              keyTemp !== 'canceled' &&
                              keyTemp !== 'checked out' &&
                              keyTemp !== 'pending'
                          )
                          .map((keyTemp) =>
                            Math.round(appointmentStatuses[keyTemp as VisitStatusHistoryLabel].averageTime)
                          ),
                        backgroundColor: Object.keys(appointmentStatuses).map(
                          (statusTemp) => CHIP_STATUS_MAP[statusTemp as VisitStatusLabel].color.primary
                        ),
                      },
                    ],
                  }}
                  options={{
                    plugins: {
                      title: {
                        text: `Minutes in each status ${filterStartDate?.toLocaleString(
                          DateTime.DATE_SHORT
                        )} - ${filterEndDate?.toLocaleString(DateTime.DATE_SHORT)}`,
                        display: true,
                        font: {
                          size: 20,
                        },
                      },
                      legend: {
                        display: false,
                      },
                    },
                  }}
                ></Bar>
              ) : (
                <TableContainer component={Paper}>
                  <Table
                    aria-label={`Minutes in each status ${filterStartDate?.toLocaleString(
                      DateTime.DATE_SHORT
                    )} - ${filterEndDate?.toLocaleString(DateTime.DATE_SHORT)}`}
                  >
                    <TableHead>
                      <TableRow>
                        <TableCell sx={{ width: '40%' }}>Status</TableCell>
                        <TableCell>Average # of Minutes</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {Object.entries(appointmentStatuses).map(([statusTemp, averageTimeTemp]) => (
                        <TableRow>
                          <TableCell>{statusTemp}</TableCell>
                          <TableCell>{Math.floor(averageTimeTemp.averageTime)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              )}
            </Grid>
          </>
        )}
      </Grid>
    </PageContainer>
  );
}
