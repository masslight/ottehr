import {
  Box,
  Button,
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
  Typography,
} from '@mui/material';
import type { ECharts } from 'echarts';
import React, { ReactElement, useMemo, useRef, useState } from 'react';
import { EChart } from 'src/features/report-builder/runtime/components/EChart';
import { LmsRow } from 'utils/lib/helpers/vitals/growth-lms';
import {
  FlowsheetVisit,
  GrowthChartData,
  GrowthChartId,
  GrowthChartPoint,
  GrowthChartSet,
} from 'utils/lib/types/api/flowsheets.types';
import {
  buildGrowthChartOption,
  defaultGrowthSet,
  formatGrowthDate,
  formatGrowthValue,
  GROWTH_CHART_VIEWS,
  GROWTH_SETS,
} from '../growthChartOption';

const TABLE_ROWS_SHOWN = 10;

interface GrowthChartsProps {
  growth: GrowthChartData;
  visits: FlowsheetVisit[];
  currentAppointmentId?: string;
}

/** The growth chart cards (ported from the OTR-3741 report): a WHO / CDC switch, one card per chart with its table. */
export const GrowthCharts = ({ growth, visits, currentAppointmentId }: GrowthChartsProps): ReactElement => {
  const [setId, setSetId] = useState<GrowthChartSet>(defaultGrowthSet(growth.ageMonths));
  const set = GROWTH_SETS[setId];
  // This visit's own column carries its age (the Age row) and the encounter whose points are marked.
  const thisVisit = currentAppointmentId
    ? visits.find((visit) => visit.appointmentId === currentAppointmentId && !visit.isFollowUp)
    : undefined;
  const visitAge = thisVisit?.values.age?.value;
  return (
    <Stack spacing={1.5}>
      <Tabs value={setId} onChange={(_, value: GrowthChartSet) => setSetId(value)} sx={{ minHeight: 36 }}>
        {(Object.keys(GROWTH_SETS) as GrowthChartSet[]).map((id) => (
          <Tab key={id} value={id} label={GROWTH_SETS[id].label} sx={{ textTransform: 'none', minHeight: 36, py: 0 }} />
        ))}
      </Tabs>
      <Typography variant="body2" color="text.secondary">
        {`${growth.sex === 'female' ? 'Girls' : 'Boys'} · ${set.title} · percentiles ${set.percentileSpan}${
          visitAge ? ` · age at this visit: ${visitAge}` : ''
        }`}
      </Typography>
      {set.charts.map((chartId) => (
        <GrowthCard
          key={chartId}
          chartId={chartId}
          sex={growth.sex}
          table={growth.tables[chartId]}
          points={growth.points.filter((point) => point.chart === chartId)}
          outsideRange={growth.outsideRange[chartId] ?? 0}
          setLabel={set.label}
          thisVisitEncounterId={thisVisit?.encounterId}
        />
      ))}
    </Stack>
  );
};

interface GrowthCardProps {
  chartId: GrowthChartId;
  sex: GrowthChartData['sex'];
  table: LmsRow[];
  /** This chart's points, oldest first. */
  points: GrowthChartPoint[];
  outsideRange: number;
  setLabel: string;
  thisVisitEncounterId?: string;
}

const GrowthCard = ({
  chartId,
  sex,
  table,
  points,
  outsideRange,
  setLabel,
  thisVisitEncounterId,
}: GrowthCardProps): ReactElement => {
  const view = GROWTH_CHART_VIEWS[chartId];
  const [hover, setHover] = useState<GrowthChartPoint | null>(null);
  const [all, setAll] = useState(false);
  const chartRef = useRef<ECharts | null>(null);
  const { option, locate } = useMemo(
    () => buildGrowthChartOption(chartId, sex, table, points, thisVisitEncounterId),
    [chartId, sex, table, points, thisVisitEncounterId]
  );
  // Hovering a table row shows the point's tooltip; hovering a point (EChart onHover) highlights its row.
  const hoverRow = (point: GrowthChartPoint | null): void => {
    setHover(point);
    const at = point && locate.get(point);
    chartRef.current?.dispatchAction(at ? { type: 'showTip', ...at } : { type: 'hideTip' });
  };
  const newest = points.slice().reverse();
  const list = all ? newest : newest.slice(0, TABLE_ROWS_SHOWN);
  const cellSx = { whiteSpace: 'nowrap', px: 1 };

  return (
    <Paper variant="outlined" sx={{ p: 1.5 }}>
      <Typography variant="subtitle1" fontWeight={600} sx={{ mb: 0.5 }}>
        {view.title}
      </Typography>
      <Stack direction="row" spacing={2} flexWrap="wrap" useFlexGap alignItems="flex-start">
        <Box sx={{ flex: '3 1 520px', minWidth: 300 }}>
          <EChart
            option={option}
            height={420}
            onHover={(datum) => setHover((datum?.point as GrowthChartPoint | undefined) ?? null)}
            onReady={(chart) => (chartRef.current = chart)}
          />
        </Box>
        {/* Wide enough for all five columns (weight @ length is the widest), else it wraps under the chart. */}
        <Box sx={{ flex: '2 1 440px', minWidth: 280 }}>
          {outsideRange > 0 && (
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', pb: 0.5 }}>
              {`${outsideRange} measurement${outsideRange === 1 ? ' is' : 's are'} outside ${setLabel
                .split(' (')[0]
                .toLowerCase()}${view.inOtherSet ? ' — see the other chart set.' : '.'}`}
            </Typography>
          )}
          <TableContainer sx={{ border: 1, borderColor: 'divider', borderRadius: 1 }}>
            {/* Right padding on the last column so the z value is never cut off. */}
            <Table size="small" sx={{ '& td:last-of-type, & th:last-of-type': { pr: 2 } }}>
              <TableHead>
                <TableRow>
                  {['Date', 'Age', view.xIsLength ? 'Weight @ length' : 'Value', 'Percentile', 'z'].map((header) => (
                    <TableCell key={header} sx={{ fontWeight: 600 }}>
                      {header}
                    </TableCell>
                  ))}
                </TableRow>
              </TableHead>
              <TableBody>
                {list.map((point) => (
                  <TableRow
                    key={point.time}
                    hover
                    selected={hover === point}
                    onMouseEnter={() => hoverRow(point)}
                    onMouseLeave={() => hoverRow(null)}
                  >
                    <TableCell sx={cellSx}>{formatGrowthDate(point.time)}</TableCell>
                    <TableCell sx={cellSx}>{point.age}</TableCell>
                    <TableCell sx={cellSx}>{formatGrowthValue(point, view)}</TableCell>
                    {point.percentile && point.z !== undefined ? (
                      <>
                        <TableCell sx={cellSx}>{point.percentile}</TableCell>
                        <TableCell sx={cellSx}>{point.z.toFixed(2)}</TableCell>
                      </>
                    ) : (
                      <TableCell colSpan={2} sx={{ color: point.implausible ? 'error.dark' : 'text.secondary' }}>
                        {point.implausible ? `⚠ ${point.note}` : point.note}
                      </TableCell>
                    )}
                  </TableRow>
                ))}
                {list.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} sx={{ color: 'text.secondary' }}>
                      No measurements in this age range.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>
          {newest.length > TABLE_ROWS_SHOWN && !all && (
            <Button size="small" onClick={() => setAll(true)} sx={{ textTransform: 'none', mt: 0.5 }}>
              {`Show all (${newest.length})`}
            </Button>
          )}
        </Box>
      </Stack>
    </Paper>
  );
};
