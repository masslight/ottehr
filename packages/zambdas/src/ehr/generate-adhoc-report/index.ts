import vm from 'node:vm';
import { APIGatewayProxyResult } from 'aws-lambda';
import {
  AdHocReportTurn,
  fixAndParseJsonObjectFromString,
  GenerateAdHocReportOutput,
  INVALID_INPUT_ERROR,
} from 'utils';
import { wrapHandler, ZambdaInput } from '../../shared';
import { DEFAULT_VERTEX_MODEL, invokeChatbotVertexAI } from '../../shared/ai';
import { validateRequestParameters } from './validateRequestParameters';

const ZAMBDA_NAME = 'generate-adhoc-report';

// Vertex model used to GENERATE the report code. Code generation benefits from a stronger model than
// the default flash-lite, so this is split out for easy tuning — bump to a larger Gemini model
// (one provisioned in this project) to improve generated-report quality. Kept at the default until
// the target model is confirmed available.
const REPORT_MODEL = DEFAULT_VERTEX_MODEL;

const RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    title: { type: 'string' },
    code: { type: 'string' },
    needsLayers: { type: 'array', items: { type: 'string' } },
  },
  required: ['code'],
};

const buildPrompt = (schema: object, request: string, conversation?: AdHocReportTurn[]): string => {
  const conversationBlock =
    conversation && conversation.length > 0
      ? `\nThis is a REFINEMENT of an earlier report. Prior turns (oldest first) — apply the new USER REQUEST\n` +
        `as a modification of the most recent generated report:\n` +
        conversation
          .map((t) => `- ${t.role === 'assistant' ? 'previously generated code' : 'user'}: ${t.content}`)
          .join('\n') +
        `\n`
      : '';

  return `
You are a data-reporting code generator for a clinical EHR. You are given the SCHEMA of a tabular
dataset (column metadata only — never the rows) and a user's plain-language request. Produce
JavaScript that renders the requested report.

EXECUTION CONTRACT — your code is the BODY of a function executed in a sandboxed browser iframe:
  function renderReport(data, schema, Chart) { <YOUR CODE HERE> }
- "data": an array of row objects. Each row has exactly the fields named in the schema below; values
  match the described types. This is the REAL dataset; you never see it, only its schema.
- "schema": the schema object shown below (available if you want to introspect it).
- "Chart": the Chart.js v4 constructor (already loaded). Make charts with new Chart(canvas, config).
- "document": the iframe document. RENDER THE REPORT INTO document.body.

RULES:
- Use ONLY "data", "schema", "Chart", and standard built-in JavaScript + DOM APIs + Math.
- NEVER use the network in any form: no fetch, XMLHttpRequest, WebSocket, import(), require, dynamic
  script/img/link to external URLs, or any external resource. Everything is computed from "data".
- Only reference field names that appear in the schema. For categorical filters, match the EXACT
  value strings from a field's "values" domain (e.g. visitType is "Telemed"/"In-Person", never
  "telemedicine"). Dates are "yyyy-MM-dd" strings; numbers are plain numbers; some values may be null.
- NULL-SAFETY (REQUIRED): ANY field value may be null/undefined for some rows. NEVER call a method or
  read a property on a value without guarding it first — e.g. to filter June visits write
  row.date && row.date.startsWith("2026-06"), and to scan a code array write
  (row.icdCodes || []).some(c => c && c.startsWith("H66")). A single null (e.g. a visit with no
  date) calling .startsWith / .toLowerCase / .includes will crash the whole report. Skip or bucket
  null values explicitly; never assume a field is populated.
- Render tabular output as a real HTML <table> (with <thead>/<th> for the header row and <tbody> for
  the data) — NOT a grid of <div>s. The app lifts every <table> out and re-renders it as an
  interactive data grid (sortable, filterable, exportable columns), so a genuine <table> is what
  gives the report those features; put a heading (<h2>/<h3>) immediately before a table to title it.
  Render charts with Chart.js: create a <canvas>, append it to a sized container, then
  new Chart(canvas, {...}). For a single metric, show a large number with a caption.
- CHART LIBRARY LIMITS — only the bundled Chart.js v4 CORE is available; NO external Chart.js plugins
  are loaded (chartjs-plugin-annotation, datalabels, zoom, etc. do NOT exist — config referencing
  them is silently ignored, so the visual won't appear). To draw a threshold / benchmark / median /
  quadrant reference line, add it as a DATA series instead (e.g. a line dataset holding the constant
  value across the labels), or omit it — never rely on options.plugins.annotation.
- BUBBLE / SCATTER RADIUS — never map a raw data value straight to a bubble radius "r": one large or
  garbage value makes a giant bubble that swamps or blanks the chart. Compute the min and max of the
  size values across ALL bubbles, normalize to a small pixel range, and ALWAYS hard-cap the result so
  no single value can produce an oversized bubble — e.g.
  r = Math.min(24, Math.max(4, 4 + 20 * (value - min) / (max - min || 1))).
  Do NOT scale by a fixed divisor (like value/100) — that is unbounded. Likewise, for any chart, when
  a few extreme outliers would flatten everything else, note it (and consider a sensible axis cap)
  rather than letting the outlier dictate the whole scale.
- HEATMAP TABLES — a table whose cells you shade by value (a "heatmap") is fine, but the app lifts
  tables into a plain data grid; per-cell background colors set via inline style ARE preserved, so
  set them with element.style.backgroundColor on each <td> (not a CSS class) for the shading to carry
  through.
- LINKS: when the user asks for clickable links to app pages, render standard anchors with a
  RELATIVE href ('<a href="/path/...">') built from id fields whose schema descriptions document a
  route. Links automatically open in a new browser tab — do NOT use window.open(), target
  attributes, inline HTML onclick= attributes, or alert()/confirm()/prompt() (all blocked in this
  sandbox). (A Chart.js options.onClick config callback is fine — see INTERACTIVE CHARTS.) Only
  build hrefs from routes documented in the schema field descriptions — never invent URLs or link
  to external sites. Match the link target to the words used: "progress note", "the note", "chart",
  "visit", or "encounter" mean the VISIT's note route (review-and-sign / follow-up-note via
  appointmentId) — NOT the patient profile. Only link to the patient profile when the user asks for
  the "patient", "patient record/profile/chart". If a row is a follow-up (encounterType), use its
  follow-up-note route.
- INTERACTIVE CHARTS (drill-down): a chart MAY be made clickable to reveal detail. Use the Chart.js
  config callback options.onClick(evt, elements) — this is a JS callback that runs in the sandbox
  (NOT an HTML onclick= attribute), and it is allowed. On click, render the corresponding detail
  rows into a container you created. CRITICAL: look up the detail rows by the SAME value you used to
  build the axis. When the axis label is a value formatted for display (e.g. hour 13 shown as
  "13:00", or a number shown with a unit), the safest pattern is to map the clicked element's INDEX
  back to the original category/array (elements[0].index) rather than keying a lookup object by the
  raw value and then reading it with the formatted label — those two keys differ ("13:00" !== 13)
  and the lookup silently returns nothing. The report frame auto-resizes, so a detail table appended
  on click displays normally (you don't need to pre-size for it).
- NEVER FABRICATE DATA. Every number, label, and value you render MUST be deterministically derived
  from the "data" rows and the schema fields. Math.random(), invented values, sample/placeholder
  numbers, and estimated/made-up metrics are strictly forbidden — this is a clinical report and a
  fabricated figure is worse than no figure. If the user asks for a metric that CANNOT be computed
  from the schema fields (e.g. a field that does not exist), do NOT approximate or invent it:
  render a clearly visible note such as "<metric> is not available in this dataset" (and omit that
  column/series), while still rendering whatever parts of the request ARE computable.
- NEVER REPURPOSE AN UNRELATED FIELD to stand in for a requested concept. A field may only be used
  for what its schema description says it MEANS — not because its values superficially resemble the
  request (e.g. if the user asks for "AI documentation type" and no such field exists, do NOT
  present a booking/reason/status field as if it were that concept). When no schema field
  semantically matches the requested concept, treat it as unavailable and say so, exactly as in the
  no-fabrication rule above. Mislabeled real data is just as harmful as invented data.
- NEVER SILENTLY SUBSTITUTE A PROXY FOR A CONCEPT. If the request names a concept the schema does
  not carry, do not quietly redefine it with a heuristic (e.g. treating "patients with more than
  one visit" as "patients with follow-up encounters"). Use the real field when one exists; if you
  must approximate, the approximation MUST be disclosed prominently in the rendered report; if you
  cannot reasonably approximate, say the concept is not available.
- AUTO-LOAD MISSING LAYERS — DON'T tell the user to enable anything. The schema may include
  "availableLayers" (opt-in data layers that EXIST for this dataset but are NOT currently loaded; each
  has an "id", "label", "description") and "otherDatasets" (other datasets the user could pick). When
  the requested concept is not in "fields" but clearly matches an availableLayer by name/description
  (e.g. the user asks for prescribed drugs and a "Medications" layer is listed, or asks about vitals
  and a "Vital signs" layer is listed), put that layer's "id" into the response's "needsLayers" array.
  The app will automatically fetch that layer and re-run you with the fuller schema — there are NO
  checkboxes for the user to tick, so NEVER instruct them to "enable" a layer. For THIS render (before
  the data arrives), render whatever parts of the request ARE computable and, for the missing part,
  show a brief note like "Loading <concept> data…" instead of a hard "not available" message. Only
  when the concept matches NO availableLayer but DOES match an "otherDatasets" entry, render the
  "<concept> is not available in this dataset" note and tell the user to switch to that dataset
  (quoting its label) — switching datasets is a real user choice. Use ONLY ids/labels that appear in
  the schema; never invent one. If the requested concept matches neither, treat it as unavailable per
  the no-fabrication rule.
- DON'T RECALL CODE SETS FROM MEMORY. A hand-typed list of full codes varies run to run and
  silently misses codes actually present in the data, producing wrong or empty results. Instead:
  - ICD-10 is HIERARCHICAL — select a diagnosis FAMILY by category PREFIX
    (code.startsWith("H66") || code.startsWith("H65") for otitis media), which is deterministic and
    catches every subtype.
  - CPT/HCPCS is NOT hierarchical — never prefix-match it. When a code field's schema provides a
    value domain (the distinct codes actually present), filter against THOSE codes. For a CPT
    range/category match by numeric range (e.g. E&M 99202–99499), guarding non-numeric HCPCS codes.
  - When the user names specific codes, match them exactly.
  Disclose the actual criteria used (prefixes, ranges, or the matched codes), per the rule below.
- DISCLOSE SELECTION CRITERIA: when a report includes/excludes or groups rows by a criterion the
- INTERACTIVE TABLES (drill-down): a TABLE can also be made clickable. Tables you render are lifted
  out of the frame and shown as interactive grids in the parent; a row click is posted back to your
  code. To use it, assign a handler: window.reportRowClick = function(row, tableLabel) { ... }.
  "row" is an object keyed by that table's column header text → the clicked cell's text (e.g.
  row["Medication"]); "tableLabel" is the table's heading (use it to ignore clicks from other tables
  if you render several). In the handler, compute the detail from the SAME "data" rows (your handler
  closes over data) and render a detail <table> into the document — give it an <h3> heading, and
  REPLACE the previous detail on each click (keep a single container, e.g.
  document.getElementById("drill") || a div you append once, and overwrite its innerHTML) so detail
  tables don't stack. The detail table is lifted to its own grid automatically. Define
  window.reportRowClick during your initial render (not inside a chart callback). Use this when the
  user asks to click a table row/name to reveal related detail rows.
- DISCLOSE SELECTION CRITERIA: when a report includes/excludes or groups rows by a criterion the
  reader cannot see at a glance — a set of codes (e.g. the specific ICD-10 codes you treat as
  "otitis media"), a value list, a numeric threshold, or a category you defined — state the ACTUAL
  criteria in the report header or a subtitle (list the matched codes/values, not just a vague label
  like "otitis media visits"). The reader must be able to see exactly what was counted without
  reading the code, and how excluded/unmatched rows were handled.
- DERIVED SCORES / MAPPINGS: when the request requires applying knowledge that is not in the data
  itself (a scoring scale, a code-to-category mapping, a grouping rule), prefer a mapping documented
  in the schema field descriptions; only fall back to standard published domain knowledge, applied
  internally consistently. The report MUST visibly display the mapping/assumption it used (a small
  legend or footnote table) and state how unmapped values were handled (e.g. "n visits excluded —
  no mapping") — never bury a derivation rule where only the code shows it.
- ONLY BUILD REPORTS. If the USER REQUEST is not a comprehensible report specification — a general
  question ("what should I do?"), a greeting, advice-seeking, chat, or gibberish — do NOT improvise
  a default report and do NOT answer the question. Instead render a short help panel: one sentence
  stating that this tool generates reports over the currently fetched dataset, then 3-4 concrete
  example requests phrased for THIS schema (e.g. a chart by a categorical field, a table grouped by
  two fields, an average of a numeric field by category), and the dataset's row count and date
  range. Set the title to "How to use Ad-Hoc Reports".
- Handle the empty case (data.length === 0) with a friendly "No data for the selected range" message.
- Be self-contained and side-effecting: render by mutating document.body; return nothing.
- Return ONLY the statements that go INSIDE the function body — do NOT include the function declaration
  and do NOT wrap the code in markdown fences.

DATASET SCHEMA:
${JSON.stringify(schema, null, 2)}
${conversationBlock}
USER REQUEST:
"""
${request}
"""

Return JSON: { "title": "<short report title>", "code": "<the function-body JavaScript>" }
`;
};

// Returns null if the code parses as a JS function body, or the SyntaxError message if not.
// new Function only COMPILES the body (it never runs it), so this is a safe parse check — the same
// parse the sandboxed iframe does via `new Function('data','schema','Chart', code)`. Catching it
// here stops a malformed generation reaching the browser as a cryptic "Invalid or unexpected token".
const jsSyntaxError = (code: string): string | null => {
  try {
    new Function('data', 'schema', 'Chart', code);
    return null;
  } catch (e) {
    return e instanceof Error ? e.message : String(e);
  }
};

// Build a handful of type-plausible synthetic rows from the schema so generated code can be EXECUTED
// (not just compiled) during validation. Values only need to be varied enough to exercise
// grouping/charting; correctness vs the real data is not the goal. A few patientIds repeat across
// near dates so visit-pairing reports (e.g. 72-hour returns) have something to find.
export const synthSampleRows = (schema: {
  fields?: Array<{ name?: string; type?: string; values?: unknown[]; min?: number }>;
}): unknown[] => {
  const fields = Array.isArray(schema?.fields) ? schema.fields : [];
  const rows: Record<string, unknown>[] = [];
  for (let i = 0; i < 12; i++) {
    const row: Record<string, unknown> = {};
    for (const f of fields) {
      const name = f?.name;
      if (!name) continue;
      const vals = Array.isArray(f?.values) ? f!.values : [];
      if (name === 'date' || f?.type === 'date')
        row[name] = `2026-0${1 + (i % 6)}-${String(10 + (i % 18)).padStart(2, '0')}`;
      else if (f?.type === 'number') row[name] = (typeof f?.min === 'number' ? f.min : 0) + (i % 5) + 1;
      else if (f?.type === 'string[]') row[name] = [vals.length ? vals[i % vals.length] : `${name}-${i % 3}`];
      else row[name] = vals.length ? vals[i % vals.length] : `${name}-${i % 4}`;
    }
    if (fields.some((f) => f?.name === 'patientId')) row.patientId = `p${i % 4}`;
    rows.push(row);
  }
  return rows;
};

// EXECUTE the generated code headlessly (vm + a permissive DOM/Chart stub), exactly as the iframe
// runner does — including the renderReport()-declaration fallback. Compile-checking alone misses
// runtime faults (e.g. a ReferenceError from a loop var used out of scope) and no-op output (e.g. a
// `function renderReport(){}` that's never called). Returns the error string, or null if it ran and
// rendered something. Kept permissive (unknown DOM calls no-op) to avoid rejecting valid reports.
export const runtimeError = (code: string, schema: object): string | null => {
  const makeNode = (): unknown => {
    const real: Record<string, unknown> = {
      style: {},
      children: [] as unknown[],
      _attrs: {} as Record<string, unknown>,
      previousElementSibling: null,
      appendChild(c: unknown) {
        (real.children as unknown[]).push(c);
        return c;
      },
      insertBefore(c: unknown) {
        (real.children as unknown[]).push(c);
        return c;
      },
      removeChild(c: unknown) {
        const a = real.children as unknown[];
        const idx = a.indexOf(c);
        if (idx >= 0) a.splice(idx, 1);
      },
      remove() {},
      setAttribute(k: string, v: unknown) {
        (real._attrs as Record<string, unknown>)[k] = v;
      },
      getAttribute(k: string) {
        return (real._attrs as Record<string, unknown>)[k] ?? null;
      },
      addEventListener() {},
      querySelector() {
        return null;
      },
      querySelectorAll() {
        return [] as unknown[];
      },
      getContext() {
        return { save() {}, restore() {}, clearRect() {}, canvas: {} };
      },
      get firstChild() {
        return (real.children as unknown[])[0] ?? null;
      },
      set innerHTML(v: string) {
        real._html = v;
        if (v) (real.children as unknown[]).push(makeNode());
      },
      get innerHTML() {
        return (real._html as string) ?? '';
      },
      set textContent(v: string) {
        real._text = v;
      },
      get textContent() {
        return (real._text as string) ?? '';
      },
    };
    return new Proxy(real, {
      get(t, p: string) {
        return p in t ? (t as Record<string, unknown>)[p] : (): unknown => makeNode();
      },
      set(t, p: string, v) {
        (t as Record<string, unknown>)[p] = v;
        return true;
      },
    });
  };
  const body = makeNode() as { children: unknown[]; innerHTML: string };
  const documentStub = {
    body,
    createElement: () => makeNode(),
    createElementNS: () => makeNode(),
    // Return a live node, not null: reports routinely set body.innerHTML with an `id="chart"` canvas
    // and then `document.getElementById('chart').getContext(...)` — which the browser resolves but a
    // null-returning stub turns into a spurious "Cannot read properties of null" reject. The stub node
    // answers getContext/appendChild, so the chain runs as it would in the iframe.
    getElementById: () => makeNode(),
    querySelector: () => makeNode(),
    querySelectorAll: () => [] as unknown[],
    addEventListener() {},
  };
  // A Chart instance in the iframe exposes update()/resize()/destroy()/etc. and Chart has static
  // register()/defaults; a bare no-op function makes `chart.update()` a TypeError and falsely fails
  // valid reports. Return a stub carrying the common instance methods, and attach the static surface.
  function ChartStub(this: Record<string, unknown>): void {
    this.update = (): void => {};
    this.resize = (): void => {};
    this.destroy = (): void => {};
    this.render = (): void => {};
    this.reset = (): void => {};
    this.stop = (): void => {};
    this.data = {};
    this.options = {};
  }
  (ChartStub as unknown as Record<string, unknown>).register = (): void => {};
  (ChartStub as unknown as Record<string, unknown>).defaults = {};
  // Deferred-render idioms (requestAnimationFrame(() => new Chart(...)), setTimeout(fn, 0)) are
  // valid in the iframe; the vm must provide these globals or code using them fails with a
  // ReferenceError and burns the whole retry budget. Run the callback SYNCHRONOUSLY so the render
  // actually happens within this run (otherwise body stays empty → false "rendered nothing"), with
  // a shared budget so a self-rescheduling animation loop can't spin until the 4s vm timeout.
  let deferredBudget = 200;
  const runDeferred = (fn: unknown): number => {
    if (typeof fn === 'function' && deferredBudget > 0) {
      deferredBudget -= 1;
      (fn as () => void)();
    }
    return 0;
  };
  const sandbox: Record<string, unknown> = {
    data: synthSampleRows(schema as { fields?: [] }),
    schema,
    Chart: ChartStub,
    document: documentStub,
    Math,
    JSON,
    Date,
    Object,
    Array,
    String,
    Number,
    Boolean,
    parseInt,
    parseFloat,
    isNaN,
    isFinite,
    setTimeout: (fn: unknown) => runDeferred(fn),
    setInterval: (fn: unknown) => runDeferred(fn),
    requestAnimationFrame: (fn: unknown) => runDeferred(fn),
    clearTimeout: (): void => {},
    clearInterval: (): void => {},
    cancelAnimationFrame: (): void => {},
    console: { log() {}, warn() {}, error() {} },
  };
  sandbox.window = sandbox; // window.X resolves to the sandbox global, as in the iframe
  // Wrap in a function exactly as the iframe runner does (new Function('data','schema','Chart', code)),
  // so a top-level `return` in the report body is legal — it's a function body, not a script. Running
  // the raw code as a vm SCRIPT instead rejects valid reports (a `if (!data.length) return;` guard is
  // common) with "SyntaxError: Illegal return statement". The IIFE's free `document`/`Chart`/`window`
  // resolve to the sandbox globals, and the renderReport()-declaration fallback runs in the same scope.
  const wrapped =
    '(function (data, schema, Chart) {\n' +
    code +
    '\n;if (typeof renderReport === "function" && !document.body.firstChild) { renderReport(data, schema, Chart); }\n' +
    '})(data, schema, Chart);';
  try {
    vm.createContext(sandbox);
    vm.runInContext(wrapped, sandbox, { timeout: 4000 });
  } catch (e) {
    return e instanceof Error ? e.message : String(e);
  }
  return body.children.length > 0 || (body.innerHTML && body.innerHTML.length > 0)
    ? null
    : 'the code ran without error but rendered nothing into document.body';
};

const MAX_ATTEMPTS = 3;

export const index = wrapHandler(ZAMBDA_NAME, async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  const { schema, request, conversation, secrets } = validateRequestParameters(input);

  const basePrompt = buildPrompt(schema, request, conversation);
  let lastError = '';

  // The model is effectively deterministic per prompt, so a plain retry would reproduce the same bad
  // output — each retry appends the prior failure so the prompt (and thus the output) changes.
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const prompt =
      attempt === 0
        ? basePrompt
        : `${basePrompt}\n\nIMPORTANT: your previous attempt produced output that was not usable ` +
          `(${lastError}). Return ONLY a valid JSON object whose "code" field is the function BODY — ` +
          `no markdown fences, no commentary, no \`function renderReport(){…}\` wrapper. The code must ` +
          `RUN without throwing (watch for variables used outside their scope) and must render into ` +
          `document.body.`;

    const raw = await invokeChatbotVertexAI([{ text: prompt }], secrets, RESPONSE_SCHEMA, REPORT_MODEL);

    let parsed: { code?: unknown; title?: unknown; needsLayers?: unknown };
    try {
      parsed = fixAndParseJsonObjectFromString(raw) as { code?: unknown; title?: unknown; needsLayers?: unknown };
    } catch {
      lastError = 'response was not valid JSON';
      continue;
    }
    if (!parsed || typeof parsed.code !== 'string' || !parsed.code.trim()) {
      lastError = 'no code field was returned';
      continue;
    }

    // Hard backstop for the no-fabrication rule: randomness in a report means invented numbers.
    // Terminal (not retried) — it's a content problem, not a malformed-output problem.
    if (/Math\.random/.test(parsed.code)) {
      throw INVALID_INPUT_ERROR(
        'Generated code attempted to fabricate values (Math.random). Please retry — if you asked for a ' +
          'metric not present in the dataset, the report cannot compute it.'
      );
    }

    const syntaxError = jsSyntaxError(parsed.code);
    if (syntaxError) {
      lastError = `the code did not parse (${syntaxError})`;
      continue;
    }

    // Execute-validate: compile-checking misses runtime faults (ReferenceErrors, calling undefined,
    // a renderReport declaration that never runs). Run it headless over synthetic rows and reject if
    // it throws or renders nothing, so the retry loop regenerates instead of saving broken code.
    const runError = runtimeError(parsed.code, schema);
    if (runError) {
      lastError = `the code failed at runtime (${runError})`;
      continue;
    }

    const needsLayers = Array.isArray(parsed.needsLayers)
      ? parsed.needsLayers.filter((id): id is string => typeof id === 'string')
      : undefined;
    const output: GenerateAdHocReportOutput = {
      code: parsed.code,
      title: typeof parsed.title === 'string' ? parsed.title : undefined,
      ...(needsLayers && needsLayers.length ? { needsLayers } : {}),
    };
    return { statusCode: 200, body: JSON.stringify(output) };
  }

  throw INVALID_INPUT_ERROR(
    `Could not generate a valid report after ${MAX_ATTEMPTS} attempts (${lastError}). Please rephrase ` +
      `your request and try again.`
  );
});
