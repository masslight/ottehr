import ErrorIcon from '@mui/icons-material/Error';
import WarningAmberOutlinedIcon from '@mui/icons-material/WarningAmberOutlined';
import {
  alpha,
  Box,
  Grid,
  Link,
  List,
  ListItemButton,
  ListItemText,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tooltip,
  Typography,
  useTheme,
} from '@mui/material';
import { DateTime } from 'luxon';
import React, { ReactElement, useMemo, useState } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import { EChart } from 'src/features/report-builder/runtime/components/EChart';
import { getInPersonUrlByAppointmentType } from 'src/features/visits/in-person/routing/helpers';
import { ROUTER_PATH } from 'src/features/visits/in-person/routing/routesInPerson';
import { Loader } from 'src/features/visits/shared/components/Loader';
import { DATE_FORMAT } from 'src/helpers/formatDateTime';
import { useGetFlowsheet } from 'src/hooks/useGetFlowsheet';
import { VitalAlertCriticality } from 'utils/lib/types/api/chart-data/chart-data.constants';
import { FlowsheetReading, FlowsheetVisit, GrowthChartData } from 'utils/lib/types/api/flowsheets.types';
import { roundNumberToDecimalPlaces } from 'utils/lib/utils/convert';
import { FlowsheetChart, FlowsheetDefinition, FlowsheetRow, FLOWSHEETS } from '../registry';
import { GrowthCharts } from './GrowthCharts';

interface FlowsheetsProps {
  patientId: string;
  /** Visit tab only: hide visits after this instant. */
  asOf?: string;
  /** Visit tab only: the open visit, whose column is highlighted. */
  currentAppointmentId?: string;
}

/** Side list of every flowsheet plus the selected one: grid, trend charts, visit list. */
export const Flowsheets = ({ patientId, asOf, currentAppointmentId }: FlowsheetsProps): ReactElement => {
  const [selected, setSelected] = useState<FlowsheetDefinition>(FLOWSHEETS[0]);
  const { data, isLoading, error } = useGetFlowsheet({ patientId, flowsheetId: selected.id, asOf });

  return (
    <Stack direction="row" spacing={2} alignItems="flex-start">
      <List dense disablePadding sx={{ width: 200, flexShrink: 0 }}>
        {FLOWSHEETS.map((flowsheet) => (
          <ListItemButton
            key={flowsheet.id}
            selected={flowsheet.id === selected.id}
            onClick={() => setSelected(flowsheet)}
          >
            <ListItemText primary={flowsheet.title} />
          </ListItemButton>
        ))}
      </List>
      <Stack spacing={2} sx={{ flex: 1, minWidth: 0 }}>
        <Typography variant="h5" color="primary.dark">
          {selected.title}
        </Typography>
        {isLoading ? (
          <Loader />
        ) : error ? (
          <Typography color="error">{error.message}</Typography>
        ) : !data?.visits.length ? (
          <Typography>No data for this patient</Typography>
        ) : (
          <FlowsheetBody
            definition={selected}
            visits={data.visits}
            growth={data.growth}
            currentAppointmentId={currentAppointmentId}
          />
        )}
      </Stack>
    </Stack>
  );
};

interface VisitColumn extends FlowsheetVisit {
  label: string;
  url?: string;
}

// Newest first; the time is added only when two columns share a day. Dates render in the browser's zone.
export const toColumns = (visits: FlowsheetVisit[]): VisitColumn[] => {
  const days = visits.map((visit) => DateTime.fromISO(visit.start).toFormat(DATE_FORMAT));
  return visits.map((visit, i) => {
    const day = days[i];
    const base =
      days.filter((d) => d === day).length > 1 ? DateTime.fromISO(visit.start).toFormat(`${DATE_FORMAT} HH:mm`) : day;
    return {
      ...visit,
      label: visit.isOutsideResult ? `${base} (outside result)` : visit.isFollowUp ? `${base} (follow-up)` : base,
      url: visit.appointmentId
        ? getInPersonUrlByAppointmentType(
            { id: visit.appointmentId, encounterId: visit.encounterId ?? '', isFollowUp: visit.isFollowUp },
            ROUTER_PATH.REVIEW_AND_SIGN
          )
        : undefined,
    };
  });
};

const worstFlag = (flags: (VitalAlertCriticality | undefined)[]): VitalAlertCriticality | undefined =>
  flags.includes(VitalAlertCriticality.Critical)
    ? VitalAlertCriticality.Critical
    : flags.includes(VitalAlertCriticality.Abnormal)
    ? VitalAlertCriticality.Abnormal
    : undefined;

interface Cell {
  text: string;
  flag?: VitalAlertCriticality;
  /** Every reading of the row in this visit, oldest first (shown on hover when there is more than one). */
  history: { time: string; text: string; flag?: VitalAlertCriticality }[];
}

export const cellOf = (row: FlowsheetRow, visit: FlowsheetVisit): Cell => {
  const readings = row.keys.map((key) => visit.values[key]).filter((reading) => reading !== undefined);
  if (readings.length < row.keys.length) return { text: '', history: [] };
  // Numbers show exactly the row's digits (3.10, not 3.1); text (a drug name, a coded lab result) is shown as saved.
  const formatOne = ({ value, unit, note }: FlowsheetReading): string => {
    const text =
      typeof value === 'number' && row.digits !== undefined
        ? roundNumberToDecimalPlaces(value, row.digits).toFixed(row.digits)
        : String(value);
    const withUnit = unit ? `${text} ${unit}` : text;
    return note ? `${withUnit} (${note})` : withUnit;
  };
  const format = (at: FlowsheetReading[]): string => at.map(formatOne).join('/');
  // A two-key row (blood pressure) reads both keys from one Observation, so the readings pair up by index.
  const history = readings[0].readings.map((_, i) => {
    const at = readings.map((reading) => reading.readings[i]).filter((reading) => reading !== undefined);
    return { time: at[0].time, text: format(at), flag: worstFlag(at.map((reading) => reading.flag)) };
  });
  return { text: format(readings), flag: worstFlag(readings.map((reading) => reading.flag)), history };
};

export interface GroupHeading {
  heading: string;
}

/**
 * The grid's rows in order, with a heading before each run of grouped rows. A hide-empty flowsheet shows only the
 * rows some column has a value for, so a heading whose rows are all empty goes too.
 */
export const rowsToShow = (
  definition: FlowsheetDefinition,
  visits: FlowsheetVisit[]
): (FlowsheetRow | GroupHeading)[] => {
  const rows = definition.hideEmptyRows
    ? definition.rows.filter((row) => visits.some((visit) => cellOf(row, visit).text))
    : definition.rows;
  return rows.flatMap((row, i) =>
    row.group && row.group !== rows[i - 1]?.group ? [{ heading: row.group }, row] : [row]
  );
};

const FlagMark = ({ flag }: { flag?: VitalAlertCriticality }): ReactElement | null => {
  const theme = useTheme();
  const sx = { ml: '4px', verticalAlign: 'middle' };
  if (flag === VitalAlertCriticality.Critical)
    return (
      <Tooltip title="Critical">
        <ErrorIcon fontSize="small" aria-label="Critical" sx={{ ...sx, color: theme.palette.error.main }} />
      </Tooltip>
    );
  if (flag === VitalAlertCriticality.Abnormal)
    return (
      <Tooltip title="Abnormal">
        <WarningAmberOutlinedIcon
          fontSize="small"
          aria-label="Abnormal"
          sx={{ ...sx, color: theme.palette.warning.light }}
        />
      </Tooltip>
    );
  return null;
};

/** The cell value; with more than one reading, a count marker and a hover list of every reading (local time). */
const CellValue = ({ cell }: { cell: Cell }): ReactElement => {
  if (cell.history.length < 2) return <>{cell.text || '—'}</>;
  return (
    <Tooltip
      title={
        <Stack>
          {cell.history.map((reading) => (
            <Typography key={reading.time} variant="caption">
              {DateTime.fromISO(reading.time).toFormat('HH:mm')} {reading.text}
              {reading.flag ? ` (${reading.flag})` : ''}
            </Typography>
          ))}
        </Stack>
      }
    >
      <Box component="span">
        {cell.text}
        <Box
          component="span"
          sx={{ ml: 0.5, px: 0.5, borderRadius: 1, fontSize: 10, bgcolor: 'action.selected', verticalAlign: 'super' }}
        >
          {cell.history.length}
        </Box>
      </Box>
    </Tooltip>
  );
};

const VisitLink = ({ visit }: { visit: VisitColumn }): ReactElement =>
  visit.url ? (
    <Link component={RouterLink} to={visit.url}>
      {visit.label}
    </Link>
  ) : (
    <>{visit.label}</>
  );

const pinned = { position: 'sticky', left: 0, zIndex: 1, backgroundColor: 'background.paper', minWidth: 190 };

const FlowsheetBody = ({
  definition,
  visits,
  growth,
  currentAppointmentId,
}: {
  definition: FlowsheetDefinition;
  visits: FlowsheetVisit[];
  /** The Growth flowsheet's chart cards, drawn in place of the trend charts. */
  growth?: GrowthChartData;
  currentAppointmentId?: string;
}): ReactElement => {
  const theme = useTheme();
  const columns = useMemo(() => toColumns(visits), [visits]);
  const rows = useMemo(() => rowsToShow(definition, visits), [definition, visits]);
  // The open visit's own (main) column; its follow-up columns are not it.
  const isCurrent = (visit: VisitColumn): boolean =>
    !!currentAppointmentId && visit.appointmentId === currentAppointmentId && !visit.isFollowUp;
  const currentSx = (visit: VisitColumn): Record<string, unknown> =>
    isCurrent(visit) ? { backgroundColor: alpha(theme.palette.primary.main, 0.1) } : {};
  const flagColor = (flag?: VitalAlertCriticality): string | undefined =>
    flag === VitalAlertCriticality.Critical
      ? theme.palette.error.main
      : flag === VitalAlertCriticality.Abnormal
      ? theme.palette.warning.main
      : undefined;

  // ECharts option per chart. Series names and units come from the registry, values are numbers, so the
  // default tooltip renders nothing a user or patient typed.
  const chartOption = (chart: FlowsheetChart): Record<string, unknown> => ({
    tooltip: { trigger: 'axis' },
    legend: { top: 0, selectedMode: false, data: chart.lines.map((line) => line.name) },
    // Our own disabled dataZoom keeps the EChart wrapper from adding its slider.
    dataZoom: [{ type: 'inside', disabled: true }],
    grid: { left: 48, right: 24, top: 40, bottom: 32, containLabel: true },
    xAxis: { type: 'time', axisLabel: { hideOverlap: true }, splitLine: { show: false } },
    yAxis: { type: 'value', name: chart.unit, scale: true },
    series: chart.lines.map((line) => ({
      name: line.name,
      type: 'line',
      showSymbol: true,
      symbolSize: 6,
      data: columns
        .slice()
        .reverse()
        .flatMap((visit) => {
          const reading = visit.values[line.key];
          // Only numeric readings plot; a text value (e.g. a coded lab result) has no point.
          if (!reading || typeof reading.value !== 'number') return [];
          const color = flagColor(reading.flag);
          const point = { value: [Date.parse(visit.start), reading.value] };
          return [
            color ? { ...point, symbolSize: 11, itemStyle: { color, borderColor: '#fff', borderWidth: 1 } } : point,
          ];
        }),
    })),
  });
  const hasPoints = (chart: FlowsheetChart): boolean =>
    chart.lines.some((line) => columns.some((visit) => typeof visit.values[line.key]?.value === 'number'));

  return (
    <>
      <TableContainer sx={{ border: 1, borderColor: 'divider', borderRadius: 1 }}>
        <Table size="small" sx={{ width: 'max-content', minWidth: '100%' }}>
          <TableHead>
            <TableRow>
              <TableCell sx={{ ...pinned, zIndex: 2, fontWeight: 700 }}>Measure</TableCell>
              {columns.map((visit, i) => (
                <TableCell
                  key={`${visit.start}-${i}`}
                  align="right"
                  sx={{ fontWeight: 700, whiteSpace: 'nowrap', verticalAlign: 'bottom', ...currentSx(visit) }}
                >
                  {isCurrent(visit) && (
                    <Typography variant="caption" display="block" color="primary" sx={{ textTransform: 'uppercase' }}>
                      This visit
                    </Typography>
                  )}
                  <VisitLink visit={visit} />
                </TableCell>
              ))}
            </TableRow>
          </TableHead>
          <TableBody>
            {rows.map((row) =>
              'heading' in row ? (
                <TableRow key={row.heading}>
                  <TableCell
                    colSpan={columns.length + 1}
                    sx={{ ...pinned, fontWeight: 700, color: 'primary.dark', backgroundColor: 'action.hover' }}
                  >
                    {row.heading}
                  </TableCell>
                </TableRow>
              ) : (
                <TableRow key={`${row.group ?? ''}-${row.label}`}>
                  <TableCell sx={{ ...pinned, fontWeight: 600 }}>{row.label}</TableCell>
                  {columns.map((visit, i) => {
                    const cell = cellOf(row, visit);
                    return (
                      <TableCell
                        key={`${visit.start}-${i}`}
                        align="right"
                        sx={{
                          whiteSpace: 'nowrap',
                          color: flagColor(cell.flag) ?? (cell.text ? 'text.primary' : 'text.disabled'),
                          ...currentSx(visit),
                        }}
                      >
                        <CellValue cell={cell} />
                        <FlagMark flag={cell.flag} />
                      </TableCell>
                    );
                  })}
                </TableRow>
              )
            )}
          </TableBody>
        </Table>
      </TableContainer>

      {growth ? (
        <GrowthCharts growth={growth} visits={visits} currentAppointmentId={currentAppointmentId} />
      ) : (
        <Grid container spacing={2}>
          {definition.charts.filter(hasPoints).map((chart) => (
            <Grid item xs={12} md={chart.lines.length > 1 ? 12 : 6} key={chart.title}>
              <Typography variant="subtitle1" fontWeight={600}>
                {chart.title} ({chart.unit})
              </Typography>
              <EChart option={chartOption(chart)} height={280} />
            </Grid>
          ))}
        </Grid>
      )}

      <Typography variant="subtitle1" fontWeight={600}>
        Visits
      </Typography>
      <Table size="small">
        <TableHead>
          <TableRow>
            {['Date', 'Visit type', 'Reason for visit', 'Primary diagnosis', 'Attending provider'].map((header) => (
              <TableCell key={header} sx={{ fontWeight: 700 }}>
                {header}
              </TableCell>
            ))}
          </TableRow>
        </TableHead>
        <TableBody>
          {columns.map((visit, i) => (
            <TableRow key={`${visit.start}-${i}`}>
              <TableCell sx={{ whiteSpace: 'nowrap' }}>
                <VisitLink visit={visit} />
              </TableCell>
              <TableCell>{visit.visitType}</TableCell>
              <TableCell>{visit.reason}</TableCell>
              <TableCell>{visit.primaryDiagnosis}</TableCell>
              <TableCell>{visit.attending}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </>
  );
};
