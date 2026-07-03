// Pure chart-config helpers holding the accumulated display fixes (responsive sizing, themes, label
// normalization); the configs themselves come from generated code running inside the iframe.

type Rows = Record<string, unknown>[];

// Recursively drop every `url` key. Vega/Vega-Lite use `url` only as a remote data source; data is
// always inline here, so a spec should never load a URL. The frame's CSP already blocks network
// egress — stripping is defense-in-depth.
export function stripDataUrls(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stripDataUrls);
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (k === 'url') continue;
      out[k] = stripDataUrls(v);
    }
    return out;
  }
  return value;
}

/** Vega-Lite: the component owns the top-level `data` (inline rows); any `url` is stripped first. */
export function injectVegaData(spec: Record<string, unknown>, rows: Rows): Record<string, unknown> {
  return { ...(stripDataUrls(spec) as Record<string, unknown>), data: { values: rows } };
}

// Top-level keys whose views manage their own size; Vega-Lite rejects width:"container" on them.
const SELF_SIZING_KEYS = ['facet', 'repeat', 'concat', 'hconcat', 'vconcat'];
const DEFAULT_VEGA_HEIGHT = 320;
const DEFAULT_FACET_CELL_HEIGHT = 240;

// Light default theme so charts don't look "wooden": tooltips on every mark, softer axis/legend
// colors, rounded bars, points on lines, no default gray view border. The spec's own `config` wins.
const VEGA_CONFIG: Record<string, unknown> = {
  background: 'transparent',
  view: { stroke: 'transparent' },
  mark: { tooltip: true },
  axis: {
    labelColor: '#5f6368',
    titleColor: '#3c4043',
    titleFontWeight: 600,
    gridColor: '#eef0f2',
    domainColor: '#dadce0',
    tickColor: '#dadce0',
    labelFontSize: 11,
    titleFontSize: 12,
  },
  legend: { labelColor: '#5f6368', titleColor: '#3c4043', titleFontWeight: 600, labelFontSize: 11, titleFontSize: 12 },
  bar: { cornerRadiusEnd: 2 },
  line: { strokeWidth: 2.5, point: true },
  area: { line: true, opacity: 0.75 },
  point: { size: 55, filled: true },
};

/** Merge the default theme under the spec's own config (spec config wins per top-level key). */
export function withVegaTheme(spec: Record<string, unknown>): Record<string, unknown> {
  const specConfig = spec.config && typeof spec.config === 'object' ? (spec.config as Record<string, unknown>) : {};
  return { ...spec, config: { ...VEGA_CONFIG, ...specConfig } };
}

function isEncodingFaceted(spec: Record<string, unknown>): boolean {
  const enc = spec.encoding;
  return !!enc && typeof enc === 'object' && ('column' in enc || 'row' in enc || 'facet' in enc);
}

function isFaceted(spec: Record<string, unknown>): boolean {
  return SELF_SIZING_KEYS.some((k) => k in spec) || isEncodingFaceted(spec);
}

// Force charts to fill the container width instead of Vega-Lite's tiny default. The component owns
// sizing (not the generated code): width→"container", default height when none given, fit-x
// autosize. Faceted/concat/repeat specs size their own sub-views and REJECT width:"container" +
// autosize:fit (rendering blank), so those get the invalid container width stripped instead; for
// encoding-facets a per-facet cell height keeps the panels from being squished flat.
export function withResponsiveSize(spec: Record<string, unknown>): Record<string, unknown> {
  if (isFaceted(spec)) {
    const clone = { ...spec };
    if (clone.width === 'container') delete clone.width;
    if (clone.autosize && typeof clone.autosize === 'object') delete clone.autosize;
    if (isEncodingFaceted(spec) && typeof clone.height !== 'number') clone.height = DEFAULT_FACET_CELL_HEIGHT;
    return clone;
  }
  return {
    autosize: { type: 'fit-x', contains: 'padding' },
    ...spec,
    width: 'container',
    height: typeof spec.height === 'number' ? spec.height : DEFAULT_VEGA_HEIGHT,
  };
}

// --- ECharts helpers (ported from the previous EChartsBlock) ------------------------------------

// Which axis holds the categories — so dataZoom targets the right one (vertical for horizontal bars).
export function isCategoryAxis(axis: unknown): boolean {
  const one = (a: unknown): boolean => !!a && typeof a === 'object' && (a as { type?: string }).type === 'category';
  return Array.isArray(axis) ? axis.some(one) : one(axis);
}

// Force EVERY category label to render (interval:0), aligned under its bar. ECharts otherwise
// auto-thins labels, so the few shown can land on empty positions and look desynced from the bars.
// Rotate x labels so they don't collide; the option's own axisLabel settings win.
export function normalizeCategoryAxes(axis: unknown, isX: boolean): unknown {
  const one = (a: unknown): unknown => {
    if (!a || typeof a !== 'object' || (a as { type?: string }).type !== 'category') return a;
    const ax = a as Record<string, unknown>;
    const existing = (ax.axisLabel as Record<string, unknown> | undefined) ?? {};
    return { ...ax, axisLabel: { interval: 0, ...(isX ? { rotate: 30 } : {}), ...existing } };
  };
  return Array.isArray(axis) ? axis.map(one) : one(axis);
}

/** True when any series is a matrix mark (heatmap): both axes are meaningful categories and the
 *  "points" are CELLS, so the crowded-axis heuristics below must not treat them as a long series. */
function isMatrixChart(option: Record<string, unknown>): boolean {
  const series = option.series;
  const list = Array.isArray(series) ? series : series ? [series] : [];
  return list.some((entry) => (entry as { type?: string } | null)?.type === 'heatmap');
}

// Room reserved on the left for a visualMap legend, which ECharts places there by default and which
// would otherwise sit on top of the plot.
const VISUAL_MAP_GUTTER = 72;
// Widest a bar may get. With few categories ECharts stretches bars across the whole grid, which reads
// as a solid slab rather than a chart.
const MAX_BAR_WIDTH = 72;

/** Full-width grid + built-in dataZoom for crowded cartesian charts. Option's own settings win. */
export function withEChartsDefaults(
  option: Record<string, unknown>,
  seriesPointCount: number
): Record<string, unknown> {
  const hasAxes = 'xAxis' in option || 'yAxis' in option;
  // A heatmap's cells are not a crowded axis — zooming one hides most of the matrix.
  const wantZoom = hasAxes && !isMatrixChart(option) && seriesPointCount > 12 && !('dataZoom' in option);
  const full: Record<string, unknown> = { ...option };

  if (hasAxes && !('grid' in full)) {
    full.grid = {
      left: 'visualMap' in full ? VISUAL_MAP_GUTTER : 8,
      right: 24,
      top: 32,
      bottom: wantZoom ? 76 : 48,
      containLabel: true,
    };
  }

  // Cap bar width unless the option sets its own — a two-category stack should not become a slab.
  if (Array.isArray(full.series)) {
    full.series = full.series.map((entry) => {
      const s = entry as Record<string, unknown> | null;
      if (!s || s.type !== 'bar' || 'barMaxWidth' in s) return entry;
      return { ...s, barMaxWidth: MAX_BAR_WIDTH };
    });
  }

  if (wantZoom) {
    const axis = isCategoryAxis(option.yAxis) ? { yAxisIndex: 0 } : { xAxisIndex: 0 };
    full.dataZoom = [
      { type: 'inside', ...axis },
      { type: 'slider', ...axis, bottom: 8 },
    ];
  }

  if ('xAxis' in full) full.xAxis = normalizeCategoryAxes(full.xAxis, true);
  if ('yAxis' in full) full.yAxis = normalizeCategoryAxes(full.yAxis, false);
  return full;
}

/** Data points across every series of the option. 0 means there is nothing to draw — a chart built
 *  from a grouping that matched no rows. ECharts would render bare axes, which reads as a broken
 *  report, so the component shows an explicit empty state instead. */
export function seriesPointCount(option: Record<string, unknown>): number {
  const series = option.series;
  const list = Array.isArray(series) ? series : series ? [series] : [];
  return list.reduce((total: number, entry: unknown) => {
    const data = (entry as { data?: unknown } | null)?.data;
    return total + (Array.isArray(data) ? data.length : 0);
  }, 0);
}

/** The longest category/data array in the option — drives the dataZoom heuristic. */
export function optionPointCount(option: Record<string, unknown>): number {
  let max = 0;
  const walk = (v: unknown): void => {
    if (Array.isArray(v)) {
      max = Math.max(max, v.length);
      v.forEach(walk);
    } else if (v && typeof v === 'object') {
      Object.values(v as Record<string, unknown>).forEach(walk);
    }
  };

  walk(option.xAxis);
  walk(option.yAxis);
  if (max === 0) walk(option.series);
  return max;
}
