import { APIGatewayProxyResult } from 'aws-lambda';
import {
  AdHocReportTurn,
  fixAndParseJsonObjectFromString,
  GenerateAdHocReportOutput,
  INVALID_INPUT_ERROR,
} from 'utils';
import { wrapHandler, ZambdaInput } from '../../shared';
import { invokeChatbotVertexAI } from '../../shared/ai';
import { validateRequestParameters } from './validateRequestParameters';

const ZAMBDA_NAME = 'generate-adhoc-report';

const RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    title: { type: 'string' },
    code: { type: 'string' },
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
- Render tables as HTML elements you create. Render charts with Chart.js: create a <canvas>, append
  it to a sized container, then new Chart(canvas, {...}). For a single metric, show a large number
  with a caption.
- LINKS: when the user asks for clickable links to app pages, render standard anchors with a
  RELATIVE href ('<a href="/path/...">') built from id fields whose schema descriptions document a
  route. Links automatically open in a new browser tab — do NOT use window.open(), target
  attributes, onclick handlers, or alert()/confirm()/prompt() (all blocked in this sandbox). Only
  build hrefs from routes documented in the schema field descriptions — never invent URLs or link
  to external sites.
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

export const index = wrapHandler(ZAMBDA_NAME, async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  const { schema, request, conversation, secrets } = validateRequestParameters(input);

  const raw = await invokeChatbotVertexAI(
    [{ text: buildPrompt(schema, request, conversation) }],
    secrets,
    RESPONSE_SCHEMA
  );

  let parsed: { code?: unknown; title?: unknown };
  try {
    parsed = fixAndParseJsonObjectFromString(raw) as { code?: unknown; title?: unknown };
  } catch {
    throw INVALID_INPUT_ERROR('Model returned non-JSON output');
  }
  if (!parsed || typeof parsed.code !== 'string' || !parsed.code.trim()) {
    throw INVALID_INPUT_ERROR('Model did not return report code');
  }

  // Hard backstop for the no-fabrication rule: randomness in a report means invented numbers.
  if (/Math\.random/.test(parsed.code)) {
    throw INVALID_INPUT_ERROR(
      'Generated code attempted to fabricate values (Math.random). Please retry — if you asked for a ' +
        'metric not present in the dataset, the report cannot compute it.'
    );
  }

  const output: GenerateAdHocReportOutput = {
    code: parsed.code,
    title: typeof parsed.title === 'string' ? parsed.title : undefined,
  };
  return { statusCode: 200, body: JSON.stringify(output) };
});
