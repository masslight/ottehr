// DATA half of the runtime-scope single source of truth: everything that exists inside the report
// iframe — the injected scope parameters, the Report component toolkit, the MUI subset, the value
// formats, the link routes — declared exactly once, here.
//
// This file is deliberately ZOD-FREE and side-effect-free: the iframe runtime bundle deep-imports it
// (for the function wrapper, the scope order, the ValueFormat type) and must not pull zod in. The
// VALIDATION and the prompt rendering live next door in runtime-scope.ts, which parses this catalog
// with real Zod schemas at module load — so a malformed entry fails loud instead of silently feeding
// the model (or the runtime) a broken contract.
//
// Nothing component-related may be hardcoded anywhere else: the generation prompt renders its
// EXECUTION CONTRACT and COMPONENTS sections from this catalog, and the iframe's scope.ts binds the
// real components against the NAMES derived here (a compile error if the two ever drift).
import type { AdHocLinkRoute } from '../sandbox/events';

/** The root component the generated body must define and return. */
export const REPORT_ROOT_NAME = 'ReportRoot';

/** The (conceptual) function the generated body is: shown to the model, built by the runtime. */
export const REPORT_FACTORY_NAME = 'buildReport';

/** The parameters injected into the generated code, IN ORDER. The runtime wrapper, the transpiler's
 *  wrapper and the prompt's execution contract are all derived from this list — add one here and
 *  every consumer is forced (by types) to supply it. */
export const RUNTIME_SCOPE_PARAMS = [
  {
    name: 'React',
    description:
      'the React namespace. Use hooks as React.useState / React.useMemo, or destructure once: ' +
      'const { useState, useMemo } = React;',
  },
  {
    name: 'MUI',
    description: 'the curated MUI building blocks listed under COMPONENTS — nothing else from MUI exists.',
  },
  {
    name: 'Report',
    description: 'the purpose-built report component toolkit listed under COMPONENTS.',
  },
  {
    name: 'data',
    description:
      'an array of row objects. Each row has exactly the fields named in the schema below; values match ' +
      'the described types. This is the REAL dataset; you never see it, only its schema.',
  },
  {
    name: 'schema',
    description: 'the schema object shown below (available if you want to introspect it).',
  },
] as const;

export type RuntimeScopeParamName = (typeof RUNTIME_SCOPE_PARAMS)[number]['name'];

/** The injected parameter names, in the order the runtime passes them. */
export const RUNTIME_SCOPE_PARAM_NAMES: readonly RuntimeScopeParamName[] = RUNTIME_SCOPE_PARAMS.map((p) => p.name);

/** The function wrapper the generated body is compiled inside — shared by the transpiler (which
 *  slices it back off) and the iframe runtime (which evaluates it). */
export const REPORT_WRAP_PREFIX = `(function (${RUNTIME_SCOPE_PARAM_NAMES.join(', ')}) {\n`;
export const REPORT_WRAP_SUFFIX = '\n})';

/** Named value formatters accepted by Report.Kpi / Report.Table columns. */
export const VALUE_FORMATS = ['integer', 'number', 'percent', 'currency'] as const;
export type ValueFormat = (typeof VALUE_FORMATS)[number];

/** What each link route opens, and which row field carries its id (null = static link, no id).
 *  The route ids themselves are the sandbox event contract's (`AdHocLinkRoute`); this adds the
 *  documentation the prompt needs, so route names are never retyped in prose. */
export const ADHOC_LINK_ROUTE_DOCS = {
  patient: { idField: 'patientId', opens: 'the patient chart' },
  visitNote: { idField: 'appointmentId', opens: "the visit's note" },
  trackingBoard: { idField: null, opens: 'the tracking board (static link)' },
} as const satisfies Record<AdHocLinkRoute, { idField: string | null; opens: string }>;

/** The rendered "route — id → what it opens" lines, for the components that take routes. A FUNCTION
 *  on purpose: every top-level initializer in this file must stay side-effect-free so the iframe
 *  bundle tree-shakes the whole model-facing documentation away and keeps only the few consts it
 *  actually imports. */
export const linkRouteLines = (): readonly string[] =>
  Object.entries(ADHOC_LINK_ROUTE_DOCS).map(
    ([route, doc]) => `route "${route}" — ${doc.idField ? `id = ${doc.idField}` : 'no id'} → ${doc.opens}.`
  );

const PATIENT_ID_FIELD = ADHOC_LINK_ROUTE_DOCS.patient.idField;
const APPOINTMENT_ID_FIELD = ADHOC_LINK_ROUTE_DOCS.visitNote.idField;

/** A nested list: literal lines, or a thunk deriving them from another part of the catalog (kept a
 *  thunk so the catalog has no top-level side effects — see linkRouteLines). */
export type ScopeDocItems = readonly string[] | (() => readonly string[]);

/** One documentation bullet: a sentence, optionally with a nested list under it. */
export type ScopeDocRule = string | { text: string; items: ScopeDocItems };

/** One component's model-facing documentation. Strings are single-line and get word-wrapped when
 *  rendered, so entries carry meaning only — never prompt layout. */
export interface ReportComponentDoc {
  /** The props the model writes, e.g. `label="…" value={n}`. The `<Report.Name …>` tag around them
   *  is rendered from the catalog KEY, so a component's name is never spelled out twice. */
  props: string;
  /** Present when the component takes children — renders `<Report.Name …>children</Report.Name>`
   *  instead of a self-closing tag. */
  children?: string;
  /** What it is / when to use it. */
  summary: string;
  /** Its own rules, caveats and interactivity notes. */
  rules?: readonly ScopeDocRule[];
}

/** The Report component catalog — the ONLY home for component-facing documentation. Key order is
 *  the order the model sees them. */
export const REPORT_COMPONENTS = {
  Section: {
    props: 'title="Heading"',
    children: '…',
    summary: 'a titled block; structure the report with these.',
  },
  Kpi: {
    props: 'label="Total visits" value={n} format="integer"',
    summary: 'one KPI card.',
    rules: [
      `format ∈ ${VALUE_FORMATS.join('|')}.`,
      `format="percent" takes a value ALREADY IN PERCENT (42 renders "42%"), NOT a 0..1 fraction — multiply ` +
        `a ratio by 100 before passing it, or the card silently reads "0.4%" instead of "42%". Same for a ` +
        `percent column in Report.Table.`,
      'Put several in <MUI.Stack direction="row" spacing={2} flexWrap="wrap">.',
      'If two KPI cards would always show identical values you mapped them to the same metric — ' +
        'differentiate or drop one.',
    ],
  },
  Note: {
    props: 'tone="info|warn|success"',
    children: 'text',
    summary: 'callout for disclosures.',
    rules: [
      {
        text: 'Use it to:',
        items: [
          "state the selection criteria when a report includes/excludes/groups rows by something the reader can't " +
            'see (list the matched codes/values, not a vague label) and how excluded/unmatched rows were handled;',
          'flag (tone="warn") a requested metric/concept that is NOT available while still rendering what IS ' +
            'computable;',
          'disclose any approximation/proxy or derived mapping you had to use;',
          'show a brief "Loading <concept> data…" placeholder for a not-yet-loaded layer;',
          'cover the empty case (data.length === 0) with a friendly "No data for the selected range" message.',
        ],
      },
    ],
  },
  Table: {
    props:
      'rows={rowsArray} columns={[{ field, label?, format? }]} links={[{ field, route, idField? }]} ' +
      'title="…" pageSize={25} onRowClick={fn?}',
    summary:
      'a FULL interactive data grid (sorting, filtering, a column picker, pagination) rendered inside the frame.',
    rules: [
      'columns defaults to every key of the first row — usually pass an explicit list.',
      'NEVER render a raw HTML <table>; always use Report.Table.',
      'onRowClick gives the clicked row (for drill-down — see PATTERNS).',
      {
        text: 'LINKS make records navigable; the app owns the URL — you only name a route + id:',
        items: linkRouteLines,
      },
      '"field" is the displayed column; "idField" names the row field holding the id.',
      `ALWAYS prefer linking a human-readable column via idField: link "patientName" with idField ` +
        `"${PATIENT_ID_FIELD}" (NOT the raw ${PATIENT_ID_FIELD} column); make sure the id field is present on ` +
        `the row objects you pass.`,
      `For a DEDICATED link column (e.g. "a link to each visit's note") add a constant-label field to each row ` +
        `({ ...r, note: 'View note' }) and link that field with idField "${APPOINTMENT_ID_FIELD}".`,
      `Whenever a per-visit / per-patient table has ${PATIENT_ID_FIELD} or ${APPOINTMENT_ID_FIELD} available, ` +
        `ADD the link.`,
    ],
  },
  EChart: {
    props: 'option={echartsOption} height={400} onClick={(datum) => …}',
    summary: 'an Apache ECharts chart.',
    rules: [
      'Put the data DIRECTLY in the option as plain arrays (you compute them from "data").',
      'USE FOR: single-series bar/line/area/scatter, pie/donut, funnel, sankey, gauge, radar, treemap, sunburst, ' +
        'and combo/dual-axis (two yAxis entries + series[].yAxisIndex).',
      'The component adds a full-width grid, dataZoom for crowded axes, and readable category labels ' +
        'automatically — do NOT set fixed pixel widths.',
      'DO NOT build a MULTI-SERIES chart from long-format rows with ECharts — use Report.VegaChart with a ' +
        '"color" encoding for that.',
      'onClick gives the clicked datum (for drill-down); when a click maps a formatted label back to data, match ' +
        'by the SAME raw value you built the axis from (keep the raw key on the datum) — formatted labels ' +
        '("13:00") never equal raw values (13).',
    ],
  },
  VegaChart: {
    props: 'spec={vegaLiteSpec} rows={rowsArray} onClick={(datum) => …}',
    summary:
      'a Vega-Lite chart over "rows" (the component injects them as the inline dataset — do NOT put "data" in ' +
      'the spec; reference row field names in encodings).',
    rules: [
      'USE FOR: MULTI-SERIES charts from long-format rows (one line/bar per category via a "color" or "detail" ' +
        'encoding), HEATMAPS / shaded matrices ("rect" mark + "color" quantitative), layered statistical ' +
        'transforms (regression/loess), and faceted small multiples (≤ ~6 panels via "column"/"row").',
      'Do NOT set width — the component owns sizing.',
      'onClick gives the clicked datum — same drill-down + label-matching caveat as Report.EChart.',
    ],
  },
  Link: {
    props: `route="patient" id={row.${PATIENT_ID_FIELD}}`,
    children: 'text',
    summary: 'an inline navigation link (routes as in Table links).',
    rules: [
      'For a ready-made app-internal href a row carries (e.g. row.trackingBoardHref) use ' +
        '<Report.Link href={row.trackingBoardHref}>…</Report.Link>.',
      'Links are forwarded to the app as validated events — NEVER use <a href>, window.open, or invent URLs.',
    ],
  },
} as const satisfies Record<string, ReportComponentDoc>;

export type ReportComponentName = keyof typeof REPORT_COMPONENTS;

/** MUI building blocks exposed for custom UI. Name-only (no per-component docs); the prompt lists
 *  them and the iframe's scope.ts binds exactly these. */
export const MUI_COMPONENT_NAMES = [
  'Alert',
  'Box',
  'Button',
  'Card',
  'CardContent',
  'Checkbox',
  'Chip',
  'Divider',
  'FormControl',
  'FormControlLabel',
  'Grid',
  'InputLabel',
  'MenuItem',
  'Paper',
  'Select',
  'Slider',
  'Stack',
  'Switch',
  'Tab',
  'Tabs',
  'TextField',
  'ToggleButton',
  'ToggleButtonGroup',
  'Tooltip',
  'Typography',
] as const;

export type MuiComponentName = (typeof MUI_COMPONENT_NAMES)[number];

/** How the generated body must be written — the rules that follow from HOW it is executed (rather
 *  than from the data it reports on). Rendered as the prompt's EXECUTION CONTRACT bullets, after the
 *  per-parameter descriptions above. */
export const EXECUTION_CONTRACT_RULES: readonly ScopeDocRule[] = [
  `HOOK PLACEMENT (CRITICAL): hooks (useState/useMemo/useEffect/…) may be called ONLY inside the body of a ` +
    `component function you define (e.g. inside ${REPORT_ROOT_NAME}) — NEVER at the top level of the code body. ` +
    `Calling a hook at the top level crashes with "Cannot read properties of null". Data that does not depend on ` +
    `state is prepared at the top level with plain JavaScript and NO hooks (const byLocation = …). INSIDE ` +
    `components: useState for interactive state, and wrap data derived FROM that state in useMemo when it feeds ` +
    `a chart or table (so the chart isn't rebuilt on every keystroke).`,
  `You MUST define a root component and END the body with:  return ${REPORT_ROOT_NAME};`,
  `NO PROPS ON THE ROOT (CRITICAL): the runtime renders ${REPORT_ROOT_NAME} with nothing passed in. Write ` +
    `\`function ${REPORT_ROOT_NAME}() {…}\` and read the injected parameters (${RUNTIME_SCOPE_PARAM_NAMES.join(
      ', '
    )}) straight from the enclosing scope. Writing \`function ${REPORT_ROOT_NAME}({ data }) {…}\` destructures ` +
    `props that do not exist: the value is undefined and the report renders EMPTY (no rows, no bars, "N/A" ` +
    `labels). The same applies to any child component you define — pass what it needs explicitly as props.`,
  'Write JSX freely — it is transpiled before it reaches the browser. Do NOT use import/require/exports.',
  'JSX TEXT IS NOT PLAIN TEXT: a bare < or > inside element children is parsed as a tag and the whole report ' +
    "fails to transpile. Write comparisons and ranges as expressions — {'<'} 92, {'>='} 100.4 — or word them " +
    '("below 92", "at least 100.4"). Braces { } in text need the same treatment.',
  `Use ONLY the parameters above and standard built-in JavaScript. NEVER use the network in any form: no fetch, ` +
    `XMLHttpRequest, WebSocket, import(), require, or any external resource; no window.open / alert / confirm / ` +
    `prompt; no document.* DOM manipulation — render through React only. Everything is computed from "data".`,
];

/** Cross-component interactivity that spans components (not tied to one catalog entry). */
export const COMPONENT_PATTERNS: readonly ScopeDocRule[] = [
  {
    text:
      'THE CHART LIBRARIES ARE YOURS IN FULL. The chart types listed above are the common cases, not a menu: ' +
      'Report.EChart passes "option" to Apache ECharts verbatim, and Report.VegaChart passes "spec" to ' +
      'Vega-Lite verbatim (only the dataset is injected). When no ready-made shape fits the request, reach ' +
      'for the library feature that does — write the option/spec exactly as that library documents it.',
    items: [
      'ECharts — any series type and any option key work. Threshold line: ' +
        "series: [{ type: 'line', data: pts, markLine: { data: [{ yAxis: 90, name: 'target' }] } }]. " +
        'Matrix heat colouring: ' +
        "series: [{ type: 'heatmap', data: cells }], visualMap: { min: 0, max: max, calculable: true }. " +
        'Stacked breakdown: two series sharing stack: ' +
        "series: [{ type: 'bar', stack: 'v', data: a }, { type: 'bar', stack: 'v', data: b }].",
      'Vega-Lite — any single-view or composed spec works; reference row field names in encodings. Trend over ' +
        'points: layer: [{ mark: "point" }, { mark: "line", transform: [{ regression: "y", on: "x" }] }]. ' +
        'Small multiples: { mark: "line", encoding: { …, column: { field: "location" } } }. Aggregation in the ' +
        'spec instead of in JS: transform: [{ aggregate: [{ op: "mean", field: "x", as: "avg" }], groupby: ' +
        '["location"] }].',
      'YOUR SETTINGS WIN over the component defaults: it supplies grid, dataZoom and category axisLabel only ' +
        'when your option does not — so e.g. axisLabel: { rotate: 0 } or your own dataZoom simply takes over.',
      'What the component keeps: SIZING (Report.EChart takes height; width is always the container, and a ' +
        'Vega-Lite width is ignored) and, in Vega-Lite, the inline dataset — never put "data" in the spec.',
      'What does NOT exist: the library namespaces themselves. No echarts / vega import, no chart instance, no ' +
        'imperative API, no custom renderer, no event wiring beyond onClick — everything is declared in the ' +
        'option/spec you pass.',
    ],
  },
  'EMPTY / ALL-ZERO SERIES: before rendering a chart, check the series you computed. An empty series (no ' +
    'categories) or one where EVERY value is 0 draws blank axes that read as a broken report — instead render ' +
    'a <Report.Note tone="warn"> saying what was measured, that the result is zero/absent for every group, and ' +
    'how many rows qualified. Keep the chart only when there is something to see.',
  'PERCENT AXES: a rate is a 0..1 fraction; label it as a percentage explicitly. In Vega-Lite use ' +
    'axis: { format: ".0%" } (a bare "%" prints "0.000000%"); in ECharts multiply by 100 and use ' +
    "axisLabel: { formatter: '{value}%' }. Never leave a rate axis unlabelled — 0.42 and 42 look identical " +
    'to a reader.',
  'Controls: React state + MUI inputs (Select / TextField / ToggleButtonGroup / Slider) that re-filter or ' +
    're-group the in-memory rows. E.g. a provider <Select> whose value filters the rows fed to a chart and a ' +
    'table. Changing the date range or dataset is NOT yours to build — the page owns those pickers.',
  'Drill-down: on a chart/row click, store the selection in ONE state slot and render a detail <Report.Table> ' +
    'from the SAME "data" rows; REPLACE the previous detail on each click, don\'t stack them.',
];
