// Report-code generation shared by the async flow: generate-adhoc-report starts a Task, and the
// sub-generate-adhoc-report subscription runs this (it can take far longer than an http zambda's 27s).
import { Secrets } from 'utils/lib/secrets';
import { LlmDatasetSchema } from 'utils/lib/types/adhoc/datasets/llm-schema';
import {
  AD_HOC_REPORT_DEFAULT_MODEL,
  AD_HOC_REPORT_LLM_MODELS,
  AdHocReportModel,
  GenerateAdHocReportInput,
  GenerateAdHocReportOutput,
  GenerateAdHocReportOutputSchema,
} from 'utils/lib/types/adhoc/generation/generate.types';
import {
  buildComponentsPromptSection,
  buildExecutionContractPromptSection,
} from 'utils/lib/types/adhoc/generation/runtime-scope';
import { REPORT_FACTORY_NAME, REPORT_ROOT_NAME } from 'utils/lib/types/adhoc/generation/runtime-scope.catalog';
import { LlmModelVariant, LlmProvider } from 'utils/lib/types/api/ai-models.constants';
import { INVALID_INPUT_ERROR } from 'utils/lib/types/errors';
import { fixAndParseJsonObjectFromString } from 'utils/lib/validation/json-fix';
import { invokeChatbot, invokeChatbotVertexAI } from './ai';
import { validateOutputWithSchema } from './validate-zod';

export const explainRuntimeError = (message: string): string => {
  if (/null \(reading 'use[A-Z]/.test(message) || /Invalid hook call/i.test(message)) {
    return (
      `${message} — this means React hooks (useState/useMemo/…) were called OUTSIDE a component. ` +
      `Hooks may only be called inside the body of a component function (e.g. inside ${REPORT_ROOT_NAME}). ` +
      `Top-level data preparation must be plain JavaScript (const byGroup = …) with no hooks.`
    );
  }
  if (/did not transpile/i.test(message)) {
    return (
      `${message} — this is a SYNTAX error in the JSX you wrote, not a data problem; the code never ran. ` +
      `The usual cause is a character that JSX reserves appearing as TEXT inside element children — most ` +
      `often a bare < or > (a comparison or a range written out), which the parser reads as the start of a ` +
      `tag; braces { } are reserved the same way. Escape them as expressions ({'<'}) or reword. Re-read your ` +
      `JSX for unbalanced tags and misplaced quotes too.`
    );
  }
  if (/Objects are not valid as a React child/i.test(message)) {
    return (
      `${message} — an object/array was rendered directly in JSX. Render primitives (strings/numbers) ` +
      `or join arrays first (arr.join(', ')).`
    );
  }
  return message;
};

// Feature label for Vertex billing and the name used in validation logs.
const FEATURE_NAME = 'generate-adhoc-report';

const RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    title: { type: 'string' },
    code: { type: 'string' },
    needsLayers: { type: 'array', items: { type: 'string' } },
  },
  required: ['code'],
};

type ReportModelInvoker = (prompt: string, secrets: Secrets) => Promise<string>;

const CLAUDE_REPORT_OPTIONS = {
  // runs in a subscription zambda (900s): MAX_ATTEMPTS (3) x 2 tries per call (1 retry) x 120s stays under the limit
  timeout: 120_000,
  maxTokens: 32_000,
  // noCache: prevents caching the initiated model, so other callers won't use it from the cache
  noCache: true,
  // structured output: the API guarantees valid JSON; Anthropic requires closed objects
  responseSchema: { ...RESPONSE_SCHEMA, additionalProperties: false },
} as const;

const createVertexReportInvoker =
  ({ model }: LlmModelVariant): ReportModelInvoker =>
  (prompt, secrets) =>
    invokeChatbotVertexAI([{ text: prompt }], secrets, FEATURE_NAME, RESPONSE_SCHEMA, model.id);

const createAnthropicReportInvoker =
  ({ model, effort, thinking }: LlmModelVariant): ReportModelInvoker =>
  async (prompt, secrets) => {
    const response = await invokeChatbot([{ role: 'user', content: prompt }], secrets, {
      ...CLAUDE_REPORT_OPTIONS,
      model: model.id,
      effort,
      thinking,
    });

    return response.text;
  };

const REPORT_INVOKER_FACTORIES: Record<LlmProvider, (variant: LlmModelVariant) => ReportModelInvoker> = {
  vertex: createVertexReportInvoker,
  anthropic: createAnthropicReportInvoker,
};

const buildPrompt = (
  schema: LlmDatasetSchema,
  request: string,
  previousAttempt?: GenerateAdHocReportInput['previousAttempt']
): string => {
  const repairBlock = previousAttempt
    ? `\nYOUR PREVIOUS ATTEMPT at this request CRASHED when it ran. The error comes from EXECUTING your\n` +
      `code (your JSX is compiled to JS and run); any "around line N" refers to line N of the code you\n` +
      `wrote below:\n` +
      `"""\n${explainRuntimeError(previousAttempt.error)}\n"""\n` +
      `The previous code was:\n"""\n${previousAttempt.code}\n"""\n` +
      `Return CORRECTED code that fixes the error — pay special attention to null/undefined guards ` +
      `(some fields are null for some rows) — and otherwise fulfils the same request.\n`
    : '';

  return `
You are a data-reporting code generator for a clinical EHR. You are given the SCHEMA of a tabular
dataset (column metadata only — never the rows) and a user's plain-language request. Produce a
React report component in JSX.

${buildExecutionContractPromptSection()}

${buildComponentsPromptSection()}

RULES:
- Only reference field names that appear in the schema. A field may carry a "values" list, which is
  the set of strings you may match against — either a CLOSED VOCABULARY (e.g. visitType is
  "In-Person"/"Telemed") or, for code/label fields, the distinct values ACTUALLY PRESENT in this
  data (e.g. the ICD/CPT codes and their display names that occur). Filter/group using the EXACT
  strings from "values" — that is how you turn a request ("otitis media", "flu vaccine") into the
  right codes: find the matching entries IN "values" (by code family or by display text) and match
  those. Fields WITHOUT "values" are free values you have never seen — MATCH THEM DEFENSIVELY:
  compare case-insensitively, match code families by prefix, or discover the distinct values from
  "data" at runtime and build controls/groups from those. NEVER hardcode an exact string you
  imagine a field might contain. Dates are "yyyy-MM-dd" strings; numbers are plain numbers; some
  values may be null.
- NULL-SAFETY (REQUIRED): ANY field value may be null/undefined for some rows. NEVER call a method
  or read a property on a value without guarding it first — e.g. row.date && row.date.startsWith(…),
  (row.icdCodes || []).some((c) => c && c.startsWith('H66')). A single null calling
  .startsWith/.toLowerCase/.includes crashes the whole report. Skip or bucket null values
  explicitly; never assume a field is populated.
- NEVER FABRICATE DATA. Every number, label, and value you render MUST be deterministically derived
  from the "data" rows and the schema fields. Math.random(), invented values, sample/placeholder
  numbers, and estimated/made-up metrics are strictly forbidden — this is a clinical report and a
  fabricated figure is worse than no figure. If a requested metric CANNOT be computed from the
  schema fields, do NOT approximate or invent it: clearly flag that it isn't available (and omit that
  column/series), while still rendering whatever parts of the request ARE computable.
- NEVER REPURPOSE AN UNRELATED FIELD to stand in for a requested concept. A field may only be used
  for what its schema description says it MEANS — not because its values superficially resemble the
  request. When no schema field semantically matches the requested concept, treat it as unavailable
  and say so. Mislabeled real data is just as harmful as invented data.
- NEVER SILENTLY SUBSTITUTE A PROXY FOR A CONCEPT. If the request names a concept the schema does
  not carry, do not quietly redefine it with a heuristic (e.g. treating "patients with more than one
  visit" as "patients with follow-up encounters"). Use the real field when one exists; if you must
  approximate, the approximation MUST be disclosed prominently; if you cannot reasonably approximate,
  say the concept is not available.
- A BROADER OR NARROWER FIELD IS A DIFFERENT CONCEPT. A field whose description covers MORE than the
  request (it is set for the requested case AND for others) or LESS is not the requested concept — e.g. a
  "final read issued" time that is also set when the provider finalized in-house is NOT "sent out for a
  final read". Look for the field whose description names the concept exactly; if there is none, the
  concept is unavailable — say so in a warn Note at the top, and only then (if useful) show the broader
  figure, labelled as what it really is.
- NESTED RECORDS (type "object[]"): a record carries ONLY the fields listed under it — the row-level
  fields (date, location, attendingProvider, patientName, links, …) live on the PARENT row. When you report
  per record, keep the parent with each record (data.flatMap((row) => (row.x || []).map((item) => ({ row,
  item })))) and read row-level values from row, record values from item. Never read a row-level field off
  a record: it is undefined there, and every record lands in one "Unknown" bucket.
- A DEFINITION IN THE REQUEST IS BINDING. When the request defines a category, column or metric (a
  condition, threshold or formula — "X = … ; Y = …"), compute EXACTLY that definition for that column,
  in its own expression. Never derive a defined category as a remainder (total minus the other buckets)
  unless the request defines it that way. When rows are split into defined categories that do not cover
  every row, show the leftover as its own clearly labelled bucket (e.g. "Not finalized") — never fold it
  into a defined one — and show that the buckets add up to the total.
- CHECK YOUR GROUP KEYS. A group-by key must be a field of the object you are grouping. If a grouping
  would put every row into a single placeholder bucket ("Unknown", "", null), the key is wrong — fix the
  code rather than render it.
- RESPECT A FIELD'S STATED QUALIFIER. A field means exactly what its description says, including any
  temporal qualifier. A field documented as "(most recent)" is NOT the initial/first value, and a
  field documented as the FIRST charting is NOT the latest. If the request asks for a first/initial
  (or latest/final) value, use the field whose description says so; if no such field exists, treat the
  request as unavailable per the rules above. NEVER relabel a field to match the wording of the
  request.
- A COUNT OF POPULATED COLUMNS IS NOT A COUNT OF EVENTS. Do not answer "how many X were done" by
  counting how many fields on the row are non-null, or by counting rows when a row is not one X.
  Only use a field that explicitly counts the thing asked about; otherwise report it as unavailable.
- WHEN SOMETHING IS UNAVAILABLE, SAY IT WHERE IT CANNOT BE MISSED: render a Report.Note with
  tone="warn" at the TOP of the report naming the requested metric and why it is not available. Never
  bury it in a caption, and never emit a plausible-looking number (e.g. 0 or a repeated constant) in
  its place — a wrong number that looks right is the worst possible outcome.
- DISCLOSE THE RULES YOU APPLIED. Whenever you classify values (abnormal/critical/high/low/on-time,
  etc.), state the exact thresholds in the report (a Report.Note is fine), because the reader cannot
  otherwise tell what the flags mean. If the thresholds are not age-adjusted but the population
  includes children, say so explicitly — adult vital-sign cutoffs misclassify pediatric patients.
- AUTO-LOAD MISSING LAYERS — DON'T tell the user to enable anything. The schema may include
  "availableLayers" (opt-in data layers that EXIST but are NOT loaded; each has id/label/description)
  and "otherDatasets". When the requested concept is not in "fields" but clearly matches an
  availableLayer by name/description, put that layer's "id" into the response's "needsLayers" array —
  the app fetches it and re-runs you with the fuller schema. For THIS render, show a brief
  "Loading <concept> data…" placeholder for the missing part instead of "not
  available". Only when the concept matches NO availableLayer but DOES match an "otherDatasets"
  entry, say it isn't in this dataset and name the dataset to switch to (quoting its label). If it
  matches neither, treat it as unavailable per the no-fabrication rule. Use ONLY ids/labels that
  appear in the schema; never invent one.
- DON'T RECALL CODE SETS FROM MEMORY. A hand-typed list of full codes varies run to run and silently
  misses codes present in the data. Derive the codes instead:
  • When the field provides "values" (the codes/labels actually present), pick the matching entries
    FROM that list — the reliable way to map a concept to real codes. E.g. for "flu vaccine" scan
    the code field's "values" for the influenza-vaccine entries; for a diagnosis, match the display
    "values".
  • ICD-10 is HIERARCHICAL — you may also select a diagnosis FAMILY by category PREFIX
    (c.startsWith('H66')), which catches every subtype whether or not it's in "values".
  • CPT/HCPCS is NOT hierarchical — never prefix-match it. Use "values", the exact codes the user
    names, or a numeric range (e.g. E&M 99202–99499), guarding non-numeric HCPCS codes.
  • To GROUP or BREAK DOWN by a code (e.g. "visits by CPT", "top diagnoses"), enumerate the DISTINCT
    codes present in "data" at runtime ([...new Set(data.flatMap((r) => r.cptCodes || []))]) and
    group/tally by those. Show the display name alongside the code where the row carries one
    (primaryIcdDisplay, icdDisplays, cptDisplays, emDisplay).
- DISCLOSE SELECTION CRITERIA: when a report includes/excludes or groups rows by a criterion the
  reader cannot see at a glance — a code set, a value list, a numeric threshold, a category you
  defined — state the ACTUAL criteria prominently, e.g. in the section title (list the matched
  codes/values, not just a vague label). Also state how excluded/unmatched rows were handled.
- DERIVED SCORES / MAPPINGS: when the request needs knowledge that is not in the data (a scoring
  scale, a code-to-category mapping), prefer a mapping documented in the schema field descriptions;
  else use standard published domain knowledge applied consistently — and visibly display the
  mapping/assumption used (a small legend or footnote table) plus how unmapped values were handled.
- METRIC SEMANTICS — map words to the RIGHT expression: "busiest"/"most visits"/"volume" = row count,
  NOT a sum of minutes. For "top entity" answers (busiest provider, top payer), EXCLUDE placeholder
  buckets ('Unknown', 'Unassigned', '', null) from the RANKING (full breakdown tables may still
  include them).
- COVER THE WHOLE REQUEST. When the request enumerates sections, charts or columns, render EVERY one
  of them — number them off against your code before you finish. Never compute a series and leave it
  unrendered, and never silently drop a requested chart or column: if one truly cannot be built from
  the schema, still render the others and say in a Note which part was dropped and why.
- ONLY BUILD REPORTS. If the USER REQUEST is not a comprehensible report specification (a greeting,
  a general question, advice-seeking, gibberish), do NOT improvise a report and do NOT answer the
  question. Render a short help panel: one sentence that this tool generates reports over the
  fetched dataset, then 3-4 concrete example requests phrased for THIS schema, and the dataset's row
  count. Set title to "How to use Ad-Hoc Reports".

DATASET SCHEMA:
${JSON.stringify(schema, null, 2)}
${repairBlock}
USER REQUEST:
"""
${request}
"""

Return JSON: { "title": "<short report title>", "code": "<the JSX function body, ending with 'return ${REPORT_ROOT_NAME};'>" }
`;
};

const MAX_ATTEMPTS = 3;

// Strip accidental markdown fences around the code payload (the JSON schema usually prevents this,
// but a fenced body still parses as a string and would then fail transpilation confusingly).
const stripFences = (code: string): string => code.replace(/^\s*```[a-z]*\s*\n?/i, '').replace(/\n?```\s*$/, '');

export const generateAdHocReportCode = async (
  { schema, request, previousAttempt }: GenerateAdHocReportInput,
  model: AdHocReportModel,
  secrets: Secrets
): Promise<GenerateAdHocReportOutput> => {
  const basePrompt = buildPrompt(schema, request, previousAttempt);
  const variant = AD_HOC_REPORT_LLM_MODELS[model] ?? AD_HOC_REPORT_LLM_MODELS[AD_HOC_REPORT_DEFAULT_MODEL];
  const invokeReportModel = REPORT_INVOKER_FACTORIES[variant.model.provider](variant);
  let lastError = '';

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const prompt =
      attempt === 0
        ? basePrompt
        : `${basePrompt}\n\nIMPORTANT: your previous attempt produced output that was not usable ` +
          `(${lastError}). Return ONLY a valid JSON object whose "code" field is the JSX function ` +
          `BODY — no markdown fences, no commentary, no \`function ${REPORT_FACTORY_NAME}(){…}\` wrapper. ` +
          `The code must RUN without throwing (guard nulls; watch variable scope), define a root ` +
          `component, and end with \`return ${REPORT_ROOT_NAME};\`.`;

    const raw = await invokeReportModel(prompt, secrets);

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
    const source = stripFences(parsed.code);

    // No code execution happens here — the zambda only checks the RESPONSE SHAPE. The code is
    // validated where it runs: the client hands it to the sandboxed iframe (transpile + execute over
    // the real rows), and a failure comes back as previousAttempt through the bounded auto-repair.
    const needsLayers = Array.isArray(parsed.needsLayers)
      ? parsed.needsLayers.filter((id): id is string => typeof id === 'string')
      : undefined;

    return validateOutputWithSchema(
      GenerateAdHocReportOutputSchema,
      {
        code: source,
        title: typeof parsed.title === 'string' ? parsed.title : undefined,
        ...(needsLayers && needsLayers.length ? { needsLayers } : {}),
      },
      FEATURE_NAME
    );
  }

  throw INVALID_INPUT_ERROR(
    `Could not generate a valid report after ${MAX_ATTEMPTS} attempts (${lastError}). Please rephrase ` +
      `your request and try again.`
  );
};
