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
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from '@mui/material';
import { DatePicker } from '@mui/x-date-pickers';
import { LocalizationProvider } from '@mui/x-date-pickers-pro';
import { AdapterLuxon } from '@mui/x-date-pickers/AdapterLuxon';
import {
  BarElement,
  CategoryScale,
  Chart as ChartJS,
  Colors,
  Legend,
  LineElement,
  LinearScale,
  PointElement,
  Title,
  Tooltip,
} from 'chart.js';
import { Appointment, Location } from 'fhir/r4';
import { DateTime } from 'luxon';
import React from 'react';
import { Bar, Line } from 'react-chartjs-2';
import { CHIP_STATUS_MAP } from '../components/AppointmentTableRow';
import LocationSelect from '../components/LocationSelect';
import WaitTimeAnalysis from '../components/charts/WaitTimeAnalysis';
import { StatusLabel, getVisitStatusHistory } from '../helpers/mappingUtils';
import { useApiClients } from '../hooks/useAppClients';
import PageContainer from '../layout/PageContainer';
import { VisitType } from '../types/types';

interface AppointmentCount {
  date: DateTime;
  appointments: number;
}

interface AppointmentStatus {
  numAppointments: number;
  averageTime: number;
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
  const [fhirAppointments, setFhirAppointments] = React.useState<Appointment[] | undefined>(undefined);
  const [appointments, setAppointments] = React.useState<AppointmentCount[] | undefined>(undefined);
  const [appointmentStati, setAppointmentStati] = React.useState<
    { [status in StatusLabel]: AppointmentStatus } | undefined
  >(undefined);
  const [appointmentsSeenIn45Ratio, setAppointmentsSeenIn45Ratio] = React.useState<number | undefined>(undefined);
  const [avgMinutesToProvider, setAvgMinutesToProvider] = React.useState<number | undefined>(undefined);
  const [totalVisits, setTotalVisits] = React.useState<number | undefined>(undefined);
  const [timeRange, setTimeRange] = React.useState<TimeRange>(TimeRange.Today);
  const [locationSelected, setLocationSelected] = React.useState<Location | undefined>(undefined);
  const [visitType, setVisitType] = React.useState<VisitType | VisitTypeAll>(VisitTypeAll.All);
  const [filterStartDate, setStartFilterDate] = React.useState<DateTime | null>(DateTime.now());
  const [filterEndDate, setEndFilterDate] = React.useState<DateTime | null>(DateTime.now());
  const [customfilterStartDate, setCustomStartFilterDate] = React.useState<DateTime | null>(null);
  const [customfilterEndDate, setCustomEndFilterDate] = React.useState<DateTime | null>(null);
  const [loading, setLoading] = React.useState<boolean>(true);
  const [error, setError] = React.useState<string | null>(null);
  const [now] = React.useState<DateTime>(DateTime.now());
  const [type, setType] = React.useState<ChartType>(ChartType.chart);
  const { fhirClient } = useApiClients();
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
        const daysDiff = Math.floor(filterEndDate.startOf('day').diff(filterStartDate.startOf('day')).as('days'));
        let temp = filterStartDate;
        const days = [];
        for (let i = 0; i <= daysDiff; i++) {
          days.push(temp.toFormat('y-MM-dd'));
          temp = temp.plus({ day: 1 });
        }
        console.log('days: ', days);
        const test = await fhirClient?.transactionRequest({
          requests: days.map((day) => ({
            id: 'test',
            method: 'GET',
            url: `Appointment?date=ge${DateTime.fromISO(day)
              .setZone('America/New_York')
              .startOf('day')}&date=le${DateTime.fromISO(day)
              .setZone('America/New_York')
              .endOf('day')}&_tag=OTTEHR-UC&location=Location/${locationSelected?.id}&${
              visitType === VisitTypeAll.All ? '' : `&appointment-type=${visitType.toUpperCase()}`
            }`,
          })),
        });
        const appointments: Appointment[] = [];
        const appointmentsTemp = test?.entry?.map((item) => {
          const url = (item.resource as any).link[0].url;
          const urlParameters = new URLSearchParams(url);
          const resources = (item.resource as any).entry;
          let checkedOutApptCount = 0;
          resources.forEach((resourceTemp: any) => {
            const isCheckedOut = isAppointmentCheckedOut(resourceTemp.resource);
            if (isCheckedOut) {
              appointments.push(resourceTemp.resource);
              checkedOutApptCount++;
            }
          });
          return {
            date: DateTime.fromISO(urlParameters.get('date')?.substring(2) || 'Unknown'),
            appointments: checkedOutApptCount,
          };
        });
        setFhirAppointments(appointments);
        console.log('appointments: ', appointments);
        console.log('appointmentsTemp: ', appointmentsTemp);

        const statiCount: { [status in StatusLabel]: AppointmentStatus } = {
          PENDING: { numAppointments: 0, averageTime: 0 },
          ARRIVED: { numAppointments: 0, averageTime: 0 },
          READY: { numAppointments: 0, averageTime: 0 },
          INTAKE: { numAppointments: 0, averageTime: 0 },
          'PROVIDER-READY': { numAppointments: 0, averageTime: 0 },
          PROVIDER: { numAppointments: 0, averageTime: 0 },
          DISCHARGE: { numAppointments: 0, averageTime: 0 },
          'CHECKED-OUT': { numAppointments: 0, averageTime: 0 },
          CANCELLED: { numAppointments: 0, averageTime: 0 },
          'NO-SHOW': { numAppointments: 0, averageTime: 0 },
          UNKNOWN: { numAppointments: 0, averageTime: 0 },
        };

        let patientToProviderIn45Count = 0; // count of appointments where the patient was seen by provider within 45 minutes of arriving
        const minutesToProvider: number[] = []; // list wait times for patients to reach providers from arrival for each appointment where the patient saw a provider
        appointments?.forEach((appointment) => {
          let timeArrived, timeSeenByProvider;
          const statusHist = getVisitStatusHistory(appointment);
          statusHist?.forEach((statusTemp) => {
            const statusName = statusTemp.label;
            const statusPeriod = statusTemp.period;
            if (statusName !== 'NO-SHOW' && statusName !== 'CHECKED-OUT' && statusName !== 'CANCELLED') {
              if (statusPeriod.end && statusPeriod.start) {
                const statusTime = DateTime.fromISO(statusPeriod.end)
                  .diff(DateTime.fromISO(statusPeriod.start), 'minutes')
                  .toObject().minutes;
                // stati.push({ status: statusName, seconds: statusTime });
                // console.log(statusName, statusPeriod);
                if (statusTime) {
                  statiCount[statusName].averageTime =
                    (statiCount[statusName].numAppointments * statiCount[statusName].averageTime + statusTime) /
                    (statiCount[statusName].numAppointments + 1);
                  statiCount[statusName].numAppointments = statiCount[statusName].numAppointments + 1;
                }
              }
              if (statusName === 'ARRIVED') {
                timeArrived = statusPeriod.start;
              }
              if (statusName === 'PROVIDER') {
                timeSeenByProvider = statusPeriod.start;
              }
            }
          });
          if (timeArrived && timeSeenByProvider) {
            const minutesToProviderTemp = DateTime.fromISO(timeSeenByProvider).diff(
              DateTime.fromISO(timeArrived),
              'minutes',
            ).minutes;
            if (minutesToProviderTemp <= 45) patientToProviderIn45Count += 1;
            minutesToProvider.push(minutesToProviderTemp);
          }
          setAppointmentStati(statiCount);
        });
        if (appointmentsTemp) {
          const totalAppointments = appointmentsTemp.reduce((acc, apptResource) => acc + apptResource.appointments, 0);
          setTotalVisits(totalAppointments);
          if (totalAppointments > 0) {
            const percentSeen = Math.round((patientToProviderIn45Count / totalAppointments) * 1000) / 10;
            setAppointmentsSeenIn45Ratio(percentSeen);
          }
          if (minutesToProvider.length > 0) {
            const avgMinutesToProviderTemp =
              minutesToProvider.reduce((acc, minutes) => acc + minutes, 0) / minutesToProvider.length;
            setAvgMinutesToProvider(Math.round(avgMinutesToProviderTemp * 10) / 10);
          }
        } else {
          setAppointmentStati(statiCount);
        }
        setLoading(false);
        setAppointments(appointmentsTemp);
        if (appointments?.length === 0) {
          setError('No completed (checked out) appointments for this time range');
        }
      } else {
        if (locationSelected) setLoading(false);
        if (filterStartDate && filterEndDate && filterStartDate.startOf('day') > filterEndDate.startOf('day')) {
          setError('Please make sure start date is before end date');
        } else {
          setError('Please make sure there is a start and end date for the filter');
        }
      }
    }

    updateAppointments().catch((error) => console.log('error getting appointment update', error));
  }, [fhirClient, now, visitType, filterStartDate, filterEndDate, locationSelected]);

  const isAppointmentCheckedOut = (appointment: Appointment): boolean => {
    const statusHist = getVisitStatusHistory(appointment);
    const reduced = statusHist.reduce((acc, status) => {
      if (status.label === 'CHECKED-OUT') {
        acc *= 0;
      }
      return acc;
    }, 1);
    return !reduced;
  };

  const handleCustomTimeRange = (): void => {
    if (customfilterEndDate && customfilterStartDate) {
      setStartFilterDate(customfilterStartDate);
      setEndFilterDate(customfilterEndDate);
    }
  };

  const setFilterDates = (range: TimeRange): void => {
    let startDate, endDate;
    if (range !== TimeRange.Custom && (customfilterEndDate || customfilterStartDate)) {
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
                  onChange={(event) => setVisitType(event.target.value as VisitType)}
                  label="Visit Type"
                >
                  <MenuItem value={VisitType.PreBook}>Booked</MenuItem>
                  <MenuItem value={VisitType.WalkIn}>Walk-in</MenuItem>
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
                      onChange={setCustomStartFilterDate}
                      inputFormat="MM/dd/yyyy"
                      value={customfilterStartDate}
                      renderInput={(params) => (
                        <TextField
                          style={{ width: '100%' }}
                          name="start-date"
                          id="start-date"
                          label="Start Date"
                          {...params}
                        />
                      )}
                    />
                  </LocalizationProvider>
                </Grid>
                <Grid item md={2} xs={8}>
                  <LocalizationProvider dateAdapter={AdapterLuxon}>
                    <DatePicker
                      label="End Date"
                      onChange={setCustomEndFilterDate}
                      inputFormat="MM/dd/yyyy"
                      value={customfilterEndDate}
                      renderInput={(params) => (
                        <TextField
                          style={{ width: '100%' }}
                          name="end-date"
                          id="end-date"
                          label="End Date"
                          {...params}
                        />
                      )}
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
        {!loading && !error && appointmentStati && (
          <>
            {singleNumberMetrics.map((metric, index) => (
              <Grid key={index} item md={4} xs={12} sx={{ width: '33%' }}>
                <Box
                  sx={{
                    backgroundColor: '#301367',
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
                    DateTime.DATE_SHORT,
                  )} - ${filterEndDate?.toLocaleString(
                    DateTime.DATE_SHORT,
                  )}, select "table" in the button group above for a table version`}
                  role="img"
                  data={{
                    labels: appointments?.map((appointment) => appointment.date.toLocaleString(DateTime.DATE_SHORT)),
                    datasets: [
                      {
                        label: 'Appointments',
                        data: appointments?.map((appointment) => appointment.appointments),
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
                          DateTime.DATE_SHORT,
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
                      DateTime.DATE_SHORT,
                    )} - ${filterEndDate?.toLocaleString(DateTime.DATE_SHORT)}`}
                  >
                    <TableHead>
                      <TableRow>
                        <TableCell sx={{ width: '40%' }}>Date</TableCell>
                        <TableCell># visits</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {appointments?.map((appointmentsTemp) => (
                        <TableRow>
                          <TableCell>{appointmentsTemp.date.toLocaleString(DateTime.DATE_SHORT)}</TableCell>
                          <TableCell>{appointmentsTemp.appointments}</TableCell>
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
                    DateTime.DATE_SHORT,
                  )} - ${filterEndDate?.toLocaleString(
                    DateTime.DATE_SHORT,
                  )}, select "table" in the button group above for a table version`}
                  role="img"
                  data={{
                    labels: Object.keys(appointmentStati).filter(
                      (keyTemp) =>
                        keyTemp !== 'no show' &&
                        keyTemp !== 'canceled' &&
                        keyTemp !== 'checked out' &&
                        keyTemp !== 'pending',
                    ),
                    datasets: [
                      {
                        label: 'Status',
                        data: Object.keys(appointmentStati)
                          .filter(
                            (keyTemp) =>
                              keyTemp !== 'no show' &&
                              keyTemp !== 'canceled' &&
                              keyTemp !== 'checked out' &&
                              keyTemp !== 'pending',
                          )
                          .map((keyTemp) => Math.round(appointmentStati[keyTemp as StatusLabel].averageTime)),
                        backgroundColor: Object.keys(appointmentStati).map(
                          (statusTemp) => CHIP_STATUS_MAP[statusTemp as StatusLabel].color.primary,
                        ),
                      },
                    ],
                  }}
                  options={{
                    plugins: {
                      title: {
                        text: `Minutes in each status ${filterStartDate?.toLocaleString(
                          DateTime.DATE_SHORT,
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
                      DateTime.DATE_SHORT,
                    )} - ${filterEndDate?.toLocaleString(DateTime.DATE_SHORT)}`}
                  >
                    <TableHead>
                      <TableRow>
                        <TableCell sx={{ width: '40%' }}>Status</TableCell>
                        <TableCell>Average # of Minutes</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {Object.entries(appointmentStati).map(([statusTemp, averageTimeTemp]) => (
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
            <br />
            <Grid item md={12} xs={12}>
              <WaitTimeAnalysis chartType={type} appointments={fhirAppointments} />
            </Grid>
          </>
        )}
      </Grid>
    </PageContainer>
  );
}
