import { Alert, Box, Typography } from '@mui/material';
import React, { useEffect, useRef, useState } from 'react';
import embed, { Result as EmbedResult } from 'vega-embed';
import { injectVegaData, withResponsiveSize, withVegaTheme } from './chart-utils';

export interface VegaChartProps {
  /** A Vega-Lite spec WITHOUT data — the component injects `rows` as the inline dataset. */
  spec: Record<string, unknown>;
  /** The rows to plot; reference their field names in the spec's encodings. */
  rows: Record<string, unknown>[];
  /** Called with the clicked mark's datum (e.g. to drive a drill-down). */
  onClick?: (datum: Record<string, unknown>) => void;
}

// Renders a Vega-Lite spec over inline rows with the accumulated display behavior: responsive
// container width (with the faceted/concat exceptions Vega-Lite requires), a light default theme,
// tooltips on every mark, and an overflow hint for wide charts.
export function VegaChart({ spec, rows, onClick }: VegaChartProps): React.ReactElement {
  const ref = useRef<HTMLDivElement>(null);
  // No rows means empty axes, which reads as a broken report — say so instead.
  const isEmpty = !Array.isArray(rows) || rows.length === 0;
  const clickRef = useRef(onClick);
  clickRef.current = onClick;
  const [error, setError] = useState<string | null>(null);
  // Vega-Lite has no built-in scroll UI; wide charts (e.g. faceted small multiples) overflow their
  // container. Detect that and show a hint — the scrollbar alone is easy to miss.
  const [overflowing, setOverflowing] = useState(false);

  useEffect(() => {
    if (!ref.current || isEmpty) return;
    let view: EmbedResult['view'] | null = null;
    let cancelled = false;
    setError(null);
    setOverflowing(false);

    const full = withVegaTheme(withResponsiveSize(injectVegaData(spec, rows)));
    // tooltip:true installs vega-tooltip; with config.mark.tooltip the hovered mark shows its values
    // — essential once a wide chart is scrolled and its axis labels are off-screen.
    void embed(ref.current, full as never, { actions: false, renderer: 'canvas', tooltip: true })
      .then((r) => {
        if (cancelled) {
          r.finalize();
          return;
        }
        view = r.view;

        // Once rendered: is the chart wider than its container (i.e. horizontally scrollable)?
        requestAnimationFrame(() => {
          const el = ref.current;
          if (el) setOverflowing(el.scrollWidth - el.clientWidth > 4);
        });

        view.addEventListener('click', (_evt, item) => {
          const datum = item?.datum as Record<string, unknown> | undefined;
          if (datum && clickRef.current) clickRef.current(datum);
        });
      })
      .catch((e) => {
        if (cancelled) return;
        // A malformed spec (bad field name, unknown mark) rejects here — show it, not a blank box.
        setError(e instanceof Error ? e.message : String(e));
      });
    return () => {
      cancelled = true;
      view?.finalize();
    };
  }, [spec, rows, isEmpty]);

  if (isEmpty) return <Alert severity="info">Nothing to plot — no rows matched this chart's grouping.</Alert>;

  return (
    <>
      {error && <Alert severity="error">Chart error: {error}</Alert>}
      {overflowing && (
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>
          Scroll horizontally to see all data →
        </Typography>
      )}
      <Box
        ref={ref}
        sx={{
          width: '100%',
          minHeight: 260,
          overflowX: 'auto',
          // Keep the horizontal scrollbar visible (overlay scrollbars hide until scrolled) so it's
          // obvious a wide chart has more off-screen.
          '&::-webkit-scrollbar': { height: 8 },
          '&::-webkit-scrollbar-thumb': { backgroundColor: 'rgba(0,0,0,0.28)', borderRadius: 4 },
          '&::-webkit-scrollbar-track': { backgroundColor: 'rgba(0,0,0,0.06)' },
        }}
      />
    </>
  );
}
