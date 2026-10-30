import { Box, Typography, useTheme } from '@mui/material';
import { PointerEvent, useEffect, useMemo, useRef, useState } from 'react';
import { otherColors } from 'src/IntakeThemeProvider';
import { getAxisTicks, VitalTrendPoint } from '../vitals-trend.helpers';

const CHART_HEIGHT = 140;
const PADDING = { top: 12, right: 12, bottom: 24, left: 36 };
const TOOLTIP_OFFSET = 56;

interface VitalTrendChartProps {
  points: VitalTrendPoint[];
  unit: string;
  title: string;
  onSelectPoint?: (point: VitalTrendPoint) => void;
}

export const VitalTrendChart = ({ points, unit, title, onSelectPoint }: VitalTrendChartProps): JSX.Element => {
  const theme = useTheme();
  const containerRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  const [activeIndex, setActiveIndex] = useState<number | undefined>();

  useEffect(() => {
    const element = containerRef.current;
    if (!element) return;
    const observer = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width));
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const ticks = useMemo(() => getAxisTicks(points.map((point) => point.value)), [points]);
  const plotWidth = Math.max(width - PADDING.left - PADDING.right, 0);
  const plotHeight = CHART_HEIGHT - PADDING.top - PADDING.bottom;

  // Points are spaced by visit date so long gaps between visits read as gaps.
  const times = points.map((point) => new Date(point.date).getTime());
  const firstTime = Math.min(...times);
  const timeSpan = Math.max(...times) - firstTime;
  const xFor = (index: number): number =>
    PADDING.left + (timeSpan === 0 ? plotWidth / 2 : ((times[index] - firstTime) / timeSpan) * plotWidth);
  const yFor = (value: number): number =>
    PADDING.top + plotHeight - ((value - ticks[0]) / (ticks[2] - ticks[0])) * plotHeight;

  const linePath = points
    .map((point, index) => `${index === 0 ? 'M' : 'L'}${xFor(index)},${yFor(point.value)}`)
    .join('');

  const handlePointerMove = (event: PointerEvent<SVGRectElement>): void => {
    const x = event.clientX - event.currentTarget.getBoundingClientRect().left + PADDING.left;
    let nearest = 0;
    points.forEach((_, index) => {
      if (Math.abs(xFor(index) - x) < Math.abs(xFor(nearest) - x)) nearest = index;
    });
    setActiveIndex(nearest);
  };

  const activePoint = activeIndex === undefined ? undefined : points[activeIndex];
  const lineColor = theme.palette.primary.light;

  return (
    <Box ref={containerRef} sx={{ position: 'relative', width: '100%', height: CHART_HEIGHT }}>
      {width > 0 && (
        <svg
          width={width}
          height={CHART_HEIGHT}
          role="img"
          aria-label={`${title} at each visit: ${points
            .map((point) => `${point.dateLabel}, ${point.valueLabel} ${unit}`)
            .join('; ')}`}
        >
          {ticks.map((tick) => (
            <g key={tick}>
              <line
                x1={PADDING.left}
                x2={PADDING.left + plotWidth}
                y1={yFor(tick)}
                y2={yFor(tick)}
                stroke={otherColors.borderGray}
                strokeWidth={1}
                strokeDasharray={tick === ticks[0] ? undefined : '2 4'}
              />
              <text
                x={PADDING.left - 8}
                y={yFor(tick)}
                textAnchor="end"
                dominantBaseline="middle"
                fontSize={11}
                fill={theme.palette.text.secondary}
              >
                {Number.isInteger(tick) ? tick : tick.toFixed(1)}
              </text>
            </g>
          ))}

          <text x={PADDING.left} y={CHART_HEIGHT - 4} fontSize={11} fill={theme.palette.text.secondary}>
            {points[0].dateLabel}
          </text>
          {/* the last date only fits when the plot is wide enough to keep it clear of the first */}
          {points.length > 1 && plotWidth > 180 && (
            <text
              x={PADDING.left + plotWidth}
              y={CHART_HEIGHT - 4}
              textAnchor="end"
              fontSize={11}
              fill={theme.palette.text.secondary}
            >
              {points[points.length - 1].dateLabel}
            </text>
          )}

          {activePoint && (
            <line
              x1={xFor(activeIndex!)}
              x2={xFor(activeIndex!)}
              y1={PADDING.top}
              y2={PADDING.top + plotHeight}
              stroke={theme.palette.text.secondary}
              strokeWidth={1}
            />
          )}

          <path d={linePath} fill="none" stroke={lineColor} strokeWidth={2} strokeLinejoin="round" />
          {points.map((point, index) => (
            <circle
              key={point.appointmentId}
              cx={xFor(index)}
              cy={yFor(point.value)}
              r={index === activeIndex ? 6 : 4}
              fill={lineColor}
              stroke={otherColors.white}
              strokeWidth={2}
            />
          ))}

          {/* A plot-sized hit area makes the nearest visit easy to reach with a finger or a mouse. */}
          <rect
            x={PADDING.left - 8}
            y={0}
            width={plotWidth + 16}
            height={CHART_HEIGHT}
            fill="transparent"
            style={{ cursor: onSelectPoint ? 'pointer' : 'default', touchAction: 'pan-y' }}
            onPointerMove={handlePointerMove}
            onPointerDown={handlePointerMove}
            onPointerLeave={() => setActiveIndex(undefined)}
            onClick={() => activePoint && onSelectPoint?.(activePoint)}
          />
        </svg>
      )}

      {activePoint && (
        <Box
          sx={{
            position: 'absolute',
            // above the point, or below it when the point sits too close to the top to fit the tooltip
            top:
              yFor(activePoint.value) >= TOOLTIP_OFFSET
                ? yFor(activePoint.value) - TOOLTIP_OFFSET
                : yFor(activePoint.value) + 12,
            left: Math.min(Math.max(xFor(activeIndex!) - 60, 0), Math.max(width - 120, 0)),
            width: 120,
            pointerEvents: 'none',
            backgroundColor: otherColors.white,
            border: '1px solid',
            borderColor: otherColors.borderGray,
            borderRadius: 1,
            boxShadow: '0 2px 8px rgba(0, 0, 0, 0.12)',
            px: 1,
            py: 0.5,
            textAlign: 'center',
          }}
        >
          <Typography variant="body2" sx={{ fontWeight: 600 }} color="text.primary">
            {activePoint.valueLabel} {unit}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {activePoint.dateLabel}
          </Typography>
        </Box>
      )}
    </Box>
  );
};
