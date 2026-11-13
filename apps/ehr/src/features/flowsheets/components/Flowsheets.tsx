import ErrorIcon from '@mui/icons-material/Error';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import WarningAmberOutlinedIcon from '@mui/icons-material/WarningAmberOutlined';
import {
  alpha,
  Box,
  Grid,
  Link,
  Paper,
  Stack,
  Tab,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tabs,
  Tooltip,
  Typography,
  useTheme,
} from '@mui/material';
import { DateTime } from 'luxon';
import React, { ReactElement, useMemo, useState } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import { AccordionCard } from 'src/components/AccordionCard';
import { RoundedButton } from 'src/components/RoundedButton';
import { EChart } from 'src/features/report-builder/runtime/components/EChart';
import { getInPersonUrlByAppointmentType } from 'src/features/visits/in-person/routing/helpers';
import { ROUTER_PATH } from 'src/features/visits/in-person/routing/routesInPerson';
import { Loader } from 'src/features/visits/shared/components/Loader';
import { useVitalsHeaderUnitSystem } from 'src/features/visits/shared/components/vitals/hooks/useVitalsHeaderUnitSystem';
import { DATE_FORMAT } from 'src/helpers/formatDateTime';
import { useGetFlowsheet } from 'src/hooks/useGetFlowsheet';
import { useServiceCategoryAbbreviationResolver } from 'src/hooks/useServiceCategoryAbbreviation';
import { getVisitTypeLabelForTypeAndServiceMode } from 'src/shared/utils/formatLabelValue';
import { HeightMeasurement } from 'utils/lib/helpers/vitals/vitals-height.helper';
import { LBS_IN_KG } from 'utils/lib/helpers/vitals/vitals-weight.helper';
import { VitalAlertCriticality } from 'utils/lib/types/api/chart-data/chart-data.constants';
import { FlowsheetReading, FlowsheetVisit, GrowthChartData } from 'utils/lib/types/api/flowsheets.types';
import { VitalsHeaderUnitSystem } from 'utils/lib/types/api/progress-note-config/progress-note-config.types';
import { roundNumberToDecimalPlaces } from 'utils/lib/utils/convert';
import { biliToolReadings, canOpenBiliTool } from '../biliTool';
import { chartPoint, HOURS_OF_LIFE_MAX, usesHoursAxis, yAxisBounds } from '../chartPoints';
import { FlowsheetChart, FlowsheetDefinition, FlowsheetRow, FLOWSHEETS } from '../registry';
import { BiliToolDialog } from './BiliToolDialog';
import { GrowthCharts } from './GrowthCharts';

interface FlowsheetsProps {
  patientId: string;
  /** Patient tab only: the tab's title; the flowsheets then sit in a white Paper like the other patient tabs. */
  title?: string;
  /** Visit tab only: hide visits after this instant. */
  asOf?: string;
  /** Visit tab only: the open visit, whose column is highlighted. */
  currentAppointmentId?: string;
}

/** A tab per flowsheet plus the selected one: grid, trend charts, visit list. */
export const Flowsheets = ({ patientId, title, asOf, currentAppointmentId }: FlowsheetsProps): ReactElement => {
  const [selected, setSelected] = useState<FlowsheetDefinition>(FLOWSHEETS[0]);
  const { data, isLoading, error } = useGetFlowsheet({ patientId, flowsheetId: selected.id, asOf });
  const [biliToolOpen, setBiliToolOpen] = useState(false);
  // Newborn bilirubin: BiliTool takes the readings shown (up to this visit on the visit tab).
  const readings = useMemo(
    () => (selected.id === 'newbornBilirubin' && data ? biliToolReadings(data.visits) : []),
    [selected.id, data]
  );
  const showBiliTool = selected.id === 'newbornBilirubin' && canOpenBiliTool(data?.birthHistory, readings);

  const content = (
    <Stack spacing={2}>
      {/* The patient-page tab row: house tab label style, scrolling when there are more flowsheets than fit. */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, borderBottom: 1, borderColor: 'divider' }}>
        <Tabs
          value={selected.id}
          onChange={(_, id: FlowsheetDefinition['id']) =>
            setSelected(FLOWSHEETS.find((flowsheet) => flowsheet.id === id) ?? FLOWSHEETS[0])
          }
          variant="scrollable"
          scrollButtons="auto"
          sx={{ flexGrow: 1, minWidth: 0 }}
        >
          {FLOWSHEETS.map((flowsheet) => (
            <Tab
              key={flowsheet.id}
              value={flowsheet.id}
              label={
                <Typography sx={{ textTransform: 'none', fontWeight: 500, fontSize: '14px' }}>
                  {flowsheet.title}
                </Typography>
              }
            />
          ))}
        </Tabs>
        {showBiliTool && (
          <RoundedButton size="small" startIcon={<OpenInNewIcon />} onClick={() => setBiliToolOpen(true)}>
            Open in BiliTool
          </RoundedButton>
        )}
      </Box>
      {showBiliTool && biliToolOpen && data?.birthHistory && (
        <BiliToolDialog
          open
          onClose={() => setBiliToolOpen(false)}
          birthHistory={data.birthHistory}
          readings={readings}
        />
      )}
      {isLoading ? (
        <Loader height="300px" />
      ) : error ? (
        <Box sx={{ p: 3, textAlign: 'center' }}>
          <Typography variant="body1">Could not load the flowsheet. Please try again.</Typography>
        </Box>
      ) : !data?.visits.length ? (
        <Box sx={{ p: 3, textAlign: 'center' }}>
          <Typography variant="body1">No data for this patient</Typography>
        </Box>
      ) : (
        <FlowsheetBody
          definition={selected}
          visits={data.visits}
          growth={data.growth}
          currentAppointmentId={currentAppointmentId}
        />
      )}
    </Stack>
  );

  return title ? (
    <Paper sx={{ padding: 3 }} component={Stack} spacing={2}>
      <Typography variant="h4" color="primary.dark">
        {title}
      </Typography>
      {content}
    </Paper>
  ) : (
    content
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
      label: visit.isOutsideResult ? `${base} (unsolicited result)` : visit.isFollowUp ? `${base} (follow-up)` : base,
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

// Lab units are saved as UCUM; show the count units the way people write them.
const UCUM_DISPLAY: Record<string, string> = { '10*3/uL': '×10³/µL', '10*6/uL': '×10⁶/µL' };

// Imperial from the stored metric value, at the vitals' display precision (lbs 2 decimals, inches 2 decimals).
const toImperial = (value: number, unit: 'lbs' | 'in'): string =>
  unit === 'lbs'
    ? roundNumberToDecimalPlaces(value * LBS_IN_KG, 2).toFixed(2)
    : HeightMeasurement.fromCm(value).getInches().toFixed(2);

/** The row label in the unit system shown. */
export const rowLabel = (row: FlowsheetRow, unitSystem: VitalsHeaderUnitSystem = 'metric'): string =>
  row.imperial && unitSystem === 'imperial' ? row.imperial.label : row.label;

/** "5.80 kg ≈ 12.79 lbs" for a convertible row's reading, metric first; undefined for other rows. */
export const bothUnits = (row: FlowsheetRow, value: number | string): string | undefined =>
  row.imperial && typeof value === 'number' && row.digits !== undefined
    ? `${roundNumberToDecimalPlaces(value, row.digits).toFixed(row.digits)} ${row.label.match(
        /\((.+)\)/
      )?.[1]} ≈ ${toImperial(value, row.imperial.unit)} ${row.imperial.unit}`
    : undefined;

export const cellOf = (
  row: FlowsheetRow,
  visit: FlowsheetVisit,
  unitSystem: VitalsHeaderUnitSystem = 'metric'
): Cell => {
  const readings = row.keys.map((key) => visit.values[key]).filter((reading) => reading !== undefined);
  if (readings.length < row.keys.length) return { text: '', history: [] };
  // Numbers show exactly the row's digits (3.10, not 3.1); text (a drug name, a coded lab result) is shown as saved.
  // A convertible row shows imperial when the practice's header unit system is imperial.
  const formatOne = ({ value, unit, note }: FlowsheetReading): string => {
    const text =
      typeof value === 'number' && row.imperial && unitSystem === 'imperial'
        ? toImperial(value, row.imperial.unit)
        : typeof value === 'number' && row.digits !== undefined
        ? roundNumberToDecimalPlaces(value, row.digits).toFixed(row.digits)
        : String(value);
    const withUnit = unit ? `${text} ${UCUM_DISPLAY[unit] ?? unit}` : text;
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
  const rows = definition.rows.filter(
    (row) => !(definition.hideEmptyRows || row.hideWhenEmpty) || visits.some((visit) => cellOf(row, visit).text)
  );
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
          sx={{ ...sx, color: theme.palette.warning.dark }}
        />
      </Tooltip>
    );
  return null;
};

/**
 * The cell value; with more than one reading, "+ N more" and a hover list of every reading (local time). A
 * convertible measure shows both units on hover.
 */
const CellValue = ({ cell, both }: { cell: Cell; both?: string }): ReactElement => {
  if (cell.history.length < 2) {
    if (!both || !cell.text) return <>{cell.text || '—'}</>;
    return (
      <Tooltip title={both}>
        <Box component="span">{cell.text}</Box>
      </Tooltip>
    );
  }
  // As the lab tables show several values in one cell: the latest, then "+ N more", every reading on hover.
  return (
    <Tooltip
      arrow
      placement="top"
      title={
        <Stack>
          {cell.history.map((reading) => (
            <Typography key={reading.time} variant="caption">
              {DateTime.fromISO(reading.time).toFormat('HH:mm')} {reading.text}
              {reading.flag ? ` (${reading.flag})` : ''}
            </Typography>
          ))}
          {both && <Typography variant="caption">{both}</Typography>}
        </Stack>
      }
    >
      <Box component="span">
        {cell.text}{' '}
        <Box component="span" sx={{ color: 'text.secondary' }}>
          + {cell.history.length - 1} more
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

/** "Pre-booked In Person Visit / UC", as on the patient Visits tab; follow-ups and unsolicited results say so. */
export const visitTypeLabel = (
  visit: FlowsheetVisit,
  resolveServiceCategoryAbbr: (codeOrName?: string) => string | undefined
): string => {
  if (visit.isOutsideResult) return 'Unsolicited result';
  if (visit.isFollowUp) return 'Follow-up';
  if (!visit.appointmentType) return '-';
  const type = getVisitTypeLabelForTypeAndServiceMode({ type: visit.appointmentType, serviceMode: visit.serviceMode });
  const category = resolveServiceCategoryAbbr(visit.serviceCategory);
  return category ? `${type} / ${category}` : type;
};

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
  const unitSystem = useVitalsHeaderUnitSystem();
  const resolveServiceCategoryAbbr = useServiceCategoryAbbreviationResolver();
  const columns = useMemo(() => toColumns(visits), [visits]);
  const rows = useMemo(() => rowsToShow(definition, visits), [definition, visits]);
  // The open visit's own (main) column; its follow-up columns are not it.
  const isCurrent = (visit: VisitColumn): boolean =>
    !!currentAppointmentId && visit.appointmentId === currentAppointmentId && !visit.isFollowUp;
  // A tint over the cell's own background, so the sticky header stays opaque.
  const tint = alpha(theme.palette.primary.main, 0.1);
  const currentSx = (visit: VisitColumn): Record<string, unknown> =>
    isCurrent(visit) ? { backgroundImage: `linear-gradient(${tint}, ${tint})` } : {};
  const flagColor = (flag?: VitalAlertCriticality): string | undefined =>
    flag === VitalAlertCriticality.Critical
      ? theme.palette.error.main
      : flag === VitalAlertCriticality.Abnormal
      ? theme.palette.warning.dark
      : undefined;

  // ECharts option per chart. Series names and units come from the registry, values are numbers, so the
  // default tooltip renders nothing a user or patient typed.
  const chartOption = (chart: FlowsheetChart): Record<string, unknown> => {
    const hoursAxis = usesHoursAxis(chart, columns);
    return {
      // Theme blues, told apart by lightness, in place of the ECharts defaults (low contrast on white).
      color: [theme.palette.primary.main, theme.palette.primary.dark, theme.palette.text.secondary],
      tooltip: { trigger: 'axis', confine: true },
      // The card title already names a single line.
      legend: {
        show: chart.lines.length > 1,
        top: 0,
        selectedMode: false,
        data: chart.lines.map((line) => line.name),
      },
      // Our own disabled dataZoom keeps the EChart wrapper from adding its slider.
      dataZoom: [{ type: 'inside', disabled: true }],
      // EChart's own grid; the hours axis needs room for its name.
      ...(hoursAxis ? { grid: { bottom: 48, containLabel: true } } : {}),
      xAxis: hoursAxis
        ? {
            type: 'value',
            min: 0,
            max: HOURS_OF_LIFE_MAX,
            interval: 24,
            name: 'Age (hours)',
            nameLocation: 'middle',
            nameGap: 28,
            splitLine: { show: false },
          }
        : { type: 'time', axisLabel: { hideOverlap: true, formatter: '{MM}/{dd}' }, splitLine: { show: false } },
      yAxis: {
        type: 'value',
        name: chart.unit,
        min: ({ min, max }: { min: number; max: number }) => yAxisBounds(chart, min, max)[0],
        max: ({ min, max }: { min: number; max: number }) => yAxisBounds(chart, min, max)[1],
      },
      series: chart.lines.map((line) => ({
        name: line.name,
        type: 'line',
        showSymbol: true,
        symbolSize: 6,
        data: columns
          .slice()
          .reverse()
          .flatMap((visit) => {
            // Only numeric readings plot; a text value (e.g. a coded lab result) has no point.
            const value = chartPoint(visit, line.key, hoursAxis);
            if (!value) return [];
            const color = flagColor(visit.values[line.key].flag);
            return [
              color ? { value, symbolSize: 11, itemStyle: { color, borderColor: '#fff', borderWidth: 1 } } : { value },
            ];
          }),
      })),
    };
  };
  const hasPoints = (chart: FlowsheetChart): boolean =>
    chart.lines.some((line) => columns.some((visit) => typeof visit.values[line.key]?.value === 'number'));
  // The flags a chart draws as larger coloured points, for the key under it.
  const plottedFlags = (chart: FlowsheetChart): VitalAlertCriticality[] =>
    [VitalAlertCriticality.Abnormal, VitalAlertCriticality.Critical].filter((flag) =>
      chart.lines.some((line) =>
        columns.some(
          (visit) => visit.values[line.key]?.flag === flag && chartPoint(visit, line.key, usesHoursAxis(chart, columns))
        )
      )
    );

  return (
    <>
      {/* Sticky dates and a capped height keep the dates and the horizontal scrollbar in view, as in PatientsMergeDifference. */}
      <TableContainer
        sx={{ border: 1, borderColor: 'divider', borderRadius: 1, bgcolor: 'background.paper', maxHeight: '60vh' }}
      >
        <Table stickyHeader size="small" sx={{ width: 'max-content', minWidth: '100%' }}>
          <TableHead>
            <TableRow>
              <TableCell sx={{ ...pinned, zIndex: 3, fontWeight: 700 }}>Measure</TableCell>
              {columns.map((visit, i) => (
                <TableCell
                  key={`${visit.start}-${i}`}
                  sx={{ fontWeight: 700, whiteSpace: 'nowrap', verticalAlign: 'bottom', ...currentSx(visit) }}
                >
                  {isCurrent(visit) && (
                    <Typography variant="caption" display="block" color="primary.dark">
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
                  {/* The lab tables' panel heading row (LabsTableBundleHeaderRow). */}
                  <TableCell
                    colSpan={columns.length + 1}
                    sx={{
                      ...pinned,
                      p: '8px 18px',
                      fontWeight: 500,
                      color: 'primary.dark',
                      backgroundColor: alpha(theme.palette.primary.main, 0.08),
                    }}
                  >
                    {row.heading}
                  </TableCell>
                </TableRow>
              ) : (
                <TableRow key={`${row.group ?? ''}-${row.label}`}>
                  <TableCell sx={{ ...pinned, fontWeight: 600 }}>{rowLabel(row, unitSystem)}</TableCell>
                  {columns.map((visit, i) => {
                    const cell = cellOf(row, visit, unitSystem);
                    const latest = row.keys.length === 1 ? visit.values[row.keys[0]]?.value : undefined;
                    // Text (a coded result, a drug name) wraps in a narrow column instead of widening it.
                    const isText = typeof latest === 'string';
                    return (
                      <TableCell
                        key={`${visit.start}-${i}`}
                        sx={{
                          whiteSpace: isText ? 'normal' : 'nowrap',
                          ...(isText ? { minWidth: 120, maxWidth: 160 } : {}),
                          color: flagColor(cell.flag) ?? (cell.text ? 'text.primary' : 'text.disabled'),
                          fontWeight: cell.flag ? 'bold' : undefined,
                          ...currentSx(visit),
                        }}
                      >
                        <CellValue cell={cell} both={latest !== undefined ? bothUnits(row, latest) : undefined} />
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
              <AccordionCard label={`${chart.title} (${chart.unit})`}>
                <Box sx={{ p: 2 }}>
                  <EChart option={chartOption(chart)} height={280} />
                  {plottedFlags(chart).length > 0 && (
                    <Typography variant="caption" color="text.secondary" component="p">
                      {plottedFlags(chart).map((flag) => (
                        <span key={flag}>
                          <Box component="span" sx={{ color: flagColor(flag) }}>
                            ●
                          </Box>{' '}
                          {flag === VitalAlertCriticality.Critical ? 'critical' : 'abnormal'}
                          {'   '}
                        </span>
                      ))}
                    </Typography>
                  )}
                </Box>
              </AccordionCard>
            </Grid>
          ))}
        </Grid>
      )}

      {/* Column names and visit type labels as on the patient Visits tab; "-" for an empty cell. */}
      <AccordionCard label="Visits">
        <TableContainer sx={{ bgcolor: 'background.paper' }}>
          <Table size="small">
            <TableHead>
              <TableRow>
                {['Date', 'Type & Service Category', 'Reason for visit', 'Primary diagnosis', 'Provider'].map(
                  (header) => (
                    <TableCell key={header} sx={{ fontWeight: 700, whiteSpace: 'nowrap' }}>
                      {header}
                    </TableCell>
                  )
                )}
              </TableRow>
            </TableHead>
            <TableBody>
              {columns.map((visit, i) => (
                <TableRow key={`${visit.start}-${i}`}>
                  <TableCell sx={{ whiteSpace: 'nowrap' }}>
                    <VisitLink visit={visit} />
                  </TableCell>
                  <TableCell sx={{ whiteSpace: 'nowrap' }}>
                    {visitTypeLabel(visit, resolveServiceCategoryAbbr)}
                  </TableCell>
                  <TableCell>{visit.reason || '-'}</TableCell>
                  <TableCell>{visit.primaryDiagnosis || '-'}</TableCell>
                  <TableCell sx={{ whiteSpace: 'nowrap' }}>{visit.attending || '-'}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </AccordionCard>
    </>
  );
};
