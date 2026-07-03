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
      chart.on('click', (params: { data?: unknown }) => {
        const datum = params.data as Record<string, unknown> | undefined;
        if (datum && typeof datum === 'object' && clickRef.current) clickRef.current(datum);
      });
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
