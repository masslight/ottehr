import React from 'react';
import { ChartType } from '../../pages/Data';
import { Appointment } from 'fhir/r4';
import { DateTime } from 'luxon';
import { getVisitStatusHistory, VisitStatusHistoryEntry } from '../../helpers/mappingUtils';
import {
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
  Box,
} from '@mui/material';
import {
  Chart as ChartJS,
  CategoryScale,
  Colors,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  SubTitle,
} from 'chart.js';
import { Bar } from 'react-chartjs-2';

interface WaitTimeAnalysisProps {
  chartType: ChartType;
  appointments: Appointment[] | undefined;
}

interface WaitTimeRange {
  low: number;
  high: number;
}

interface WaitTimeBuckets {
  [key: string]: number;
}

interface WaitTimeTableData {
  id: string;
  actualWaitTime: number | undefined;
  waitRange: WaitTimeRange | undefined;
  waitingMinutes: number | undefined;
}

const SET_BUCKETS = [
  [undefined, -60],
  [-60, -30],
  [-30, -10],
  [-10, 0],
  [0, 10],
  [10, 30],
  [30, 60],
  [60, undefined],
];

// todo add dates to titles
export default function WaitTimeAnalysis({ chartType, appointments }: WaitTimeAnalysisProps): React.ReactElement {
  const [waitTimeBuckets, setWaitTimeBuckets] = React.useState<WaitTimeBuckets | undefined>(undefined);
  const [staticWaitTimeBuckets, setStaticWaitTimeBuckets] = React.useState<WaitTimeBuckets | undefined>(undefined);
  const [waitTimeTableData, setWaitTimeTableData] = React.useState<WaitTimeTableData[] | undefined>(undefined);
  const [percentWithInEstimate, setPercentWithInEstimate] = React.useState<number | undefined>(undefined);

  ChartJS.register(
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    BarElement,
    Legend,
    Title,
    Tooltip,
    Colors,
    SubTitle,
  );

  React.useEffect(() => {
    if (appointments) {
      const { buckets, staticBuckets, tableData } = analyzeAppointments(appointments);
      setWaitTimeBuckets(buckets);
      setStaticWaitTimeBuckets(staticBuckets);
      setWaitTimeTableData(tableData);
      console.log('tableData: ', tableData);
      const success = percentSuccess(tableData);
      setPercentWithInEstimate(Math.round(success * 100));
    }
  }, [appointments]);

  // how many appointments fell into the new projected wait range?
  // for each appointment, check if actual wait time is less than range high and greater than range low, if yes count
  // metric is that number / total
  return (
    <>
      {chartType === ChartType.chart ? (
        waitTimeBuckets &&
        staticWaitTimeBuckets && (
          <>
            <Typography
              variant="subtitle1"
              sx={{ fontWeight: 600, marginBottom: '5px', textAlign: 'center', fontSize: '24px' }}
            >
              Wait Time Analysis (in minutes)
            </Typography>
            <Box
              sx={{
                backgroundColor: 'rgba(173, 216, 230, 0.8)',
                padding: '10px',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                alignItems: 'center',
                borderRadius: '15px',
                width: '40%',
                margin: 'auto',
              }}
            >
              <Typography
                sx={{
                  fontSize: '14px',
                }}
              >
                PERCENT OF APPOINTMENTS WITHIN ESTIMATED RANGE: {percentWithInEstimate}%
              </Typography>
            </Box>
            <Typography sx={{ width: '80%', margin: 'auto', paddingTop: '10px' }}>
              This graph represents the variance from the actual wait time to the low end of the estimated wait time
              range. For example, if 5 appointments had a low wait time estimate that was between 1 hour and 30 minutes
              less than the actual wait time, there would be a range of -60 - -30 with a count of 5.
            </Typography>
            {/* leaving this here for now but i think the set buckets make more sense for this analysis */}
            {/* <Bar
              aria-label="Wait Time Analysis (in minutes)"
              role="img"
              data={{
                labels: Object.keys(waitTimeBuckets || ''),
                datasets: [
                  {
                    label: 'Status',
                    data: Object.values(waitTimeBuckets || ''),
                  },
                ],
              }}
              options={{
                scales: {
                  y: {
                    beginAtZero: true,
                    min: 0,
                    max: Math.ceil(Math.max(...Object.values(waitTimeBuckets || ''))),
                    ticks: {
                      stepSize: 1,
                    },
                  },
                },
                plugins: {
                  legend: {
                    display: false,
                  },
                },
              }}
            ></Bar> */}
            <Bar
              aria-label="Wait Time Analysis (in minutes)"
              role="img"
              data={{
                labels: Object.keys(staticWaitTimeBuckets || ''),
                datasets: [
                  {
                    label: 'Status',
                    data: Object.values(staticWaitTimeBuckets || ''),
                  },
                ],
              }}
              options={{
                scales: {
                  y: {
                    beginAtZero: true,
                    min: 0,
                    max: Math.ceil(Math.max(...Object.values(staticWaitTimeBuckets || ''))),
                    ticks: {
                      stepSize: 1,
                    },
                  },
                },
                plugins: {
                  legend: {
                    display: false,
                  },
                },
              }}
            ></Bar>
          </>
        )
      ) : (
        <>
          <Typography variant="subtitle1" sx={{ fontWeight: 600, marginBottom: '16px', textAlign: 'center' }}>
            Wait Time Analysis (in minutes)
          </Typography>
          <TableContainer component={Paper}>
            <Table aria-label="Wait Time Estimates vs Actual">
              <TableHead>
                <TableRow>
                  <TableCell sx={{ width: '40%' }}>Appointment ID</TableCell>
                  <TableCell>Actual Wait Time</TableCell>
                  <TableCell>Wait Time Range (New)</TableCell>
                  <TableCell>Waiting Minutes (Old / Current)</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {waitTimeTableData?.map((data) => {
                  return (
                    <TableRow>
                      <TableCell>{data.id}</TableCell>
                      <TableCell>{data.actualWaitTime}</TableCell>
                      <TableCell>{data.waitRange ? `${data.waitRange.low} - ${data.waitRange.high}` : ''}</TableCell>
                      <TableCell>{data.waitingMinutes}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </TableContainer>
        </>
      )}
    </>
  );
}

const getActualWaitTime = (appointment: Appointment): number | undefined => {
  // get the wait time for an appointment by getting the time they reached exam room
  // and subtracting their arrived time
  const statusHistory = getVisitStatusHistory(appointment);
  const arrivedStatus = statusHistory.find((status) => status.status === 'ARRIVED');

  // find the wait end time by checking each of the following stati
  // if an appointment went into intake, thats when the wait time would end
  // if the appointment never entered intake but went straight to ready for provider, then that would be the wait time end
  // and so on
  const statiToCheck = [['Intake', '4-INT'], ['rPROV', '5-rPROV'], ['PROV'], ['D/Cd', '7-rDC'], ['CHK']];
  let waitEndStatus: VisitStatusHistoryEntry | undefined;
  let count = 0;
  while (!waitEndStatus && count < statiToCheck.length) {
    waitEndStatus = statusHistory.find((status) => statiToCheck[count].includes(status.status));
    count++;
  }

  let waitTime: number | undefined;
  if (arrivedStatus?.period.start && waitEndStatus?.period.start) {
    const arrivedStatusDate = DateTime.fromISO(arrivedStatus.period.start);
    const waitEndStatusDate = DateTime.fromISO(waitEndStatus.period.start);
    waitTime = waitEndStatusDate.diff(arrivedStatusDate, 'minutes').minutes;
  }
  if (waitTime) {
    return Math.round(waitTime * 10) / 10;
  }
  return;
};

const getWaitRange = (appointment: Appointment): WaitTimeRange | undefined => {
  const waitTimeRange = appointment.meta?.tag?.find((tag) => tag.system === 'wait-time-range-estimate')?.code;
  if (waitTimeRange) {
    const waitRangeWithType = JSON.parse(waitTimeRange) as unknown as WaitTimeRange;
    return waitRangeWithType;
  }
  return;
};

const getWaitingMintues = (appointment: Appointment): number | undefined => {
  const waitingMinutes = appointment.meta?.tag?.find((tag) => tag.system === 'waiting-minutes-estimate')?.code;
  if (waitingMinutes) {
    const waitingMinutesWithType = waitingMinutes as unknown as number;
    return Math.round(waitingMinutesWithType * 10) / 10;
  }
  return;
};

const analyzeAppointments = (
  appointments: Appointment[],
): { buckets: WaitTimeBuckets; staticBuckets: WaitTimeBuckets; tableData: WaitTimeTableData[] } => {
  const { waitTimeVariances, tableData } = appointments.reduce(
    (acc: { waitTimeVariances: number[]; tableData: WaitTimeTableData[] }, appointment) => {
      const actualWaitTime = getActualWaitTime(appointment);
      const waitRange = getWaitRange(appointment);
      if (actualWaitTime && waitRange) {
        acc.waitTimeVariances.push(actualWaitTime - waitRange.low);
      }
      const data: WaitTimeTableData = {
        id: appointment.id || 'id missing',
        actualWaitTime: actualWaitTime,
        waitRange: waitRange,
        waitingMinutes: getWaitingMintues(appointment),
      };
      acc.tableData.push(data);
      return acc;
    },
    { waitTimeVariances: [], tableData: [] },
  );

  const maxVariance = Math.max(...waitTimeVariances);
  const minVariance = Math.min(...waitTimeVariances);

  const numBuckets = Math.min(Math.max(Math.ceil(Math.sqrt(waitTimeVariances.length)), 5), 10);
  const bucketSize = (maxVariance - minVariance) / numBuckets;
  const ranges: { [key: number]: { low: number; high: number } } = {};
  const waitTimeBuckets: Record<string, number> = {};
  for (let i = 0; i < numBuckets; i++) {
    const startRange = i === 0 ? Math.floor(minVariance + i * bucketSize) : ranges[i - 1].high;
    const endRange = i === numBuckets - 1 ? Math.ceil(maxVariance) : Math.ceil(minVariance + (i + 1) * bucketSize);

    const rangeKey = `${startRange} - ${endRange}`;
    ranges[i] = { low: startRange, high: endRange };

    const valuesInBucket = waitTimeVariances.filter(
      (variance) => variance >= startRange && variance <= endRange,
    ).length;
    waitTimeBuckets[rangeKey] = valuesInBucket;
  }

  const staticWaitTimeBuckets: Record<string, number> = {};
  for (let i = 0; i < SET_BUCKETS.length; i++) {
    const startRange = SET_BUCKETS[i][0];
    const endRange = SET_BUCKETS[i][1];

    const rangeKey = `${endRange !== undefined ? '' : '>'} ${startRange !== undefined ? `${startRange} -` : '<'} ${
      endRange !== undefined ? endRange : ''
    }`;

    const valuesInBucket = waitTimeVariances.filter((variance) => {
      if (startRange && endRange) {
        return variance >= startRange && variance <= endRange;
      } else if (!startRange && endRange) {
        return variance <= endRange;
      } else if (!endRange && startRange) {
        return variance >= startRange;
      }
      return;
    }).length;
    staticWaitTimeBuckets[rangeKey] = valuesInBucket;
  }
  console.log('waitTimeBuckets: ', waitTimeBuckets);
  console.log('staticWaitTimeBuckets: ', staticWaitTimeBuckets);

  return { buckets: waitTimeBuckets, staticBuckets: staticWaitTimeBuckets, tableData };
};

const percentSuccess = (data: WaitTimeTableData[]): number => {
  const totalAppointments = data.length;
  const withInRange: number = data.reduce((acc: number, data) => {
    const rangeLow = data.waitRange?.low;
    const rangeHigh = data.waitRange?.high;
    if (rangeLow && rangeHigh && data.actualWaitTime) {
      if (data.actualWaitTime <= rangeHigh && data.actualWaitTime >= rangeLow) acc += 1;
    }
    return acc;
  }, 0);
  const success = withInRange / totalAppointments;
  return Math.round(success * 100) / 100;
};
