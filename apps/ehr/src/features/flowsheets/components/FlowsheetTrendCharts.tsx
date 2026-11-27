import { Box, Typography, useTheme } from '@mui/material';
import { memo, ReactElement, useCallback, useMemo } from 'react';
import { AccordionCard } from 'src/components/AccordionCard';
import { EChart } from 'src/features/report-builder/runtime/components/EChart';
import { VitalAlertCriticality } from 'utils/lib/types/api/chart-data/chart-data.constants';
import { FlowsheetVisit } from 'utils/lib/types/api/flowsheets.types';
import { VitalsHeaderUnitSystem } from 'utils/lib/types/api/progress-note-config/progress-note-config.types';
import { chartPointsOf, timeTickLabel, yAxisBounds } from '../chart';
import { measureLabel, unitOf } from '../format';
import { FlowsheetChart } from '../registry';
import { FlowsheetHighlight } from './FlowsheetTable';

interface TrendChartProps {
  chart: FlowsheetChart;
  visits: FlowsheetVisit[];
  unitSystem: VitalsHeaderUnitSystem;
  onHoverPoint: (highlight: FlowsheetHighlight | null) => void;
}

const FLAGS = [VitalAlertCriticality.Abnormal, VitalAlertCriticality.Critical];

const TrendChart = memo(({ chart, visits, unitSystem, onHoverPoint }: TrendChartProps): ReactElement => {
  const theme = useTheme();
  const flagColors: Record<VitalAlertCriticality, string> = useMemo(
    () => ({
      [VitalAlertCriticality.Critical]: theme.palette.error.main,
      [VitalAlertCriticality.Abnormal]: theme.palette.warning.main,
    }),
    [theme]
  );
  const points = useMemo(() => chartPointsOf(chart, visits, unitSystem), [chart, visits, unitSystem]);
  const plottedFlags = FLAGS.filter((flag) => points.some((line) => line.some((point) => point.flag === flag)));

  // Memoized: a new option object makes EChart redraw, which would drop the hover it just reported.
  const option = useMemo(() => {
    const values = points.flat().map((point) => point.y);
    if (values.length === 0) return undefined;
    const unit = unitOf(chart, unitSystem);
    return {
      color: [theme.palette.primary.main, theme.palette.primary.dark],
      tooltip: {
        trigger: 'item',
        confine: true,
        renderMode: 'richText',
        formatter: ({ data }: { data: { hoverText: string } }) => data.hoverText,
      },
      legend: { show: chart.lines.length > 1, top: 0, selectedMode: false, data: chart.lines },
      // Keeps the EChart wrapper from adding its zoom slider.
      dataZoom: [{ type: 'inside', disabled: true }],
      xAxis: {
        type: 'time',
        axisLabel: { hideOverlap: true, formatter: timeTickLabel },
        splitLine: { show: false },
      },
      yAxis: {
        type: 'value',
        name: unit.label,
        ...yAxisBounds(chart.range, unit, values),
      },
      series: chart.lines.map((name, lineIndex) => ({
        name,
        type: 'line',
        showSymbol: true,
        symbolSize: 8,
        data: points[lineIndex].map((point) => ({
          value: [point.x, point.y],
          visitIndex: point.visitIndex,
          hoverText: point.tooltip,
          ...(point.flag
            ? {
                symbolSize: 12,
                itemStyle: { color: flagColors[point.flag], borderColor: '#fff', borderWidth: 1 },
              }
            : {}),
        })),
      })),
    };
  }, [chart, points, unitSystem, theme, flagColors]);

  const handleHover = useCallback(
    (datum: Record<string, unknown> | null) =>
      onHoverPoint(typeof datum?.visitIndex === 'number' ? { visitIndex: datum.visitIndex, key: chart.key } : null),
    [onHoverPoint, chart.key]
  );

  return (
    <AccordionCard label={measureLabel(chart, unitSystem)}>
      <Box sx={{ p: 2 }}>
        {option ? (
          <>
            <EChart option={option} height={280} onHover={handleHover} />
            {plottedFlags.length > 0 && (
              <Typography variant="caption" color="text.secondary" component="p">
                {plottedFlags.map((flag) => (
                  <Box component="span" key={flag} sx={{ mr: 2 }}>
                    <Box component="span" sx={{ color: flagColors[flag] }}>
                      ●
                    </Box>{' '}
                    {flag}
                  </Box>
                ))}
              </Typography>
            )}
          </>
        ) : (
          <Typography variant="body2" color="text.secondary">
            No data for this patient
          </Typography>
        )}
      </Box>
    </AccordionCard>
  );
});
TrendChart.displayName = 'TrendChart';

interface FlowsheetTrendChartsProps {
  charts: FlowsheetChart[];
  visits: FlowsheetVisit[];
  unitSystem: VitalsHeaderUnitSystem;
  onHoverPoint: (highlight: FlowsheetHighlight | null) => void;
}

export const FlowsheetTrendCharts = ({
  charts,
  visits,
  unitSystem,
  onHoverPoint,
}: FlowsheetTrendChartsProps): ReactElement => (
  <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: 2 }}>
    {charts.map((chart) => (
      <Box key={chart.key} sx={{ minWidth: 0, gridColumn: chart.lines.length > 1 ? '1 / -1' : undefined }}>
        <TrendChart chart={chart} visits={visits} unitSystem={unitSystem} onHoverPoint={onHoverPoint} />
      </Box>
    ))}
  </Box>
);
