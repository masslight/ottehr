import { Alert, Box } from '@mui/material';
import * as echarts from 'echarts';
import React, { useEffect, useRef, useState } from 'react';
import { optionPointCount, seriesPointCount, withEChartsDefaults } from './chart-utils';

export interface EChartProps {
  /** A full ECharts option. Put the data directly in the option (plain arrays/objects). */
  option: Record<string, unknown>;
  /** Chart height in px. Width always fills the container. */
  height?: number;
  /** Called with the clicked datum (e.g. to drive a drill-down). */
  onClick?: (datum: Record<string, unknown>) => void;
}

// Renders an ECharts option with the accumulated display fixes: full-width grid with contained
// labels, automatic dataZoom (pan/zoom + slider) for crowded cartesian charts, every category label
// rendered (no auto-thinning). The option's own grid/dataZoom/axisLabel settings win.
export function EChart({ option, height = 400, onClick }: EChartProps): React.ReactElement {
  const ref = useRef<HTMLDivElement>(null);
  // A series with no points draws bare axes that read as a broken report — say so instead.
  const isEmpty = seriesPointCount(option) === 0;
  const clickRef = useRef(onClick);
  clickRef.current = onClick;
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!ref.current || isEmpty) return;
    setError(null);
    let chart: echarts.ECharts | null = null;

    try {
      const full = withEChartsDefaults(option, optionPointCount(option));
      chart = echarts.init(ref.current);
      chart.setOption(full as echarts.EChartsCoreOption);
      chart.on(
        'click',
        (params: { name?: unknown; value?: unknown; seriesName?: unknown; dataIndex?: unknown; data?: unknown }) => {
          if (!clickRef.current) return;

          // Forward a consistent datum for EVERY data shape. ECharts gives the category name, the
          // value, the series and the point index even when series data is plain numbers (the common
          // case) — the previous "only if params.data is an object" check dropped those clicks. Object
          // -form data points are spread on top so their own fields are available too.
          const base = {
            name: params.name,
            value: params.value,
            seriesName: params.seriesName,
            dataIndex: params.dataIndex,
          };
          const datum =
            params.data && typeof params.data === 'object'
              ? { ...base, ...(params.data as Record<string, unknown>) }
              : base;

          clickRef.current(datum);
        }
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }

    const onResize = (): void => chart?.resize();
    window.addEventListener('resize', onResize);

    return () => {
      window.removeEventListener('resize', onResize);
      chart?.dispose();
    };
  }, [option, isEmpty]);

  if (isEmpty) return <Alert severity="info">Nothing to plot — no rows matched this chart's grouping.</Alert>;

  return (
    <>
      {error && <Alert severity="error">Chart error: {error}</Alert>}
      <Box ref={ref} sx={{ width: '100%', height }} />
    </>
  );
}
