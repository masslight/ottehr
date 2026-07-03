import { APIGatewayProxyResult } from 'aws-lambda';
import {
  buildComponentsPromptSection,
  buildExecutionContractPromptSection,
  fixAndParseJsonObjectFromString,
  GenerateAdHocReportInput,
  GenerateAdHocReportOutput,
  GenerateAdHocReportOutputSchema,
  INVALID_INPUT_ERROR,
  LlmDatasetSchema,
  REPORT_FACTORY_NAME,
  REPORT_ROOT_NAME,
} from 'utils';
import { wrapHandler, ZambdaInput } from '../../shared';
import { DEFAULT_VERTEX_MODEL, invokeChatbotVertexAI } from '../../shared/ai';
import { validateOutputWithSchema } from '../../shared/validate-zod';
import { validateRequestParameters } from './validateRequestParameters';

// The browser reports runtime failures with production-React's opaque TypeErrors; translate the
// known ones into instructions the model can act on before they go into the repair prompt.
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

const ZAMBDA_NAME = 'generate-adhoc-report';

// Vertex model used to GENERATE the report code. Code generation benefits from a stronger model than
// the default flash-lite, so this is split out for easy tuning — bump to a larger Gemini model
// (one provisioned in this project) to improve generated-report quality.
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

export const index = wrapHandler(ZAMBDA_NAME, async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  const { schema, request, previousAttempt, secrets } = validateRequestParameters(input);

  const basePrompt = buildPrompt(schema, request, previousAttempt);
  let lastError = '';

  // The model is effectively deterministic per prompt, so a plain retry would reproduce the same bad
  // output — each retry appends the prior failure so the prompt (and thus the output) changes.
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const prompt =
      attempt === 0
        ? basePrompt
        : `${basePrompt}\n\nIMPORTANT: your previous attempt produced output that was not usable ` +
          `(${lastError}). Return ONLY a valid JSON object whose "code" field is the JSX function ` +
          `BODY — no markdown fences, no commentary, no \`function ${REPORT_FACTORY_NAME}(){…}\` wrapper. ` +
          `The code must RUN without throwing (guard nulls; watch variable scope), define a root ` +
          `component, and end with \`return ${REPORT_ROOT_NAME};\`.`;

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
    const source = stripFences(parsed.code);

    // No code execution happens here — the zambda only checks the RESPONSE SHAPE. The code itself
    // is validated where it runs: the client hands it to the sandboxed iframe (transpile + execute
    // over the real rows), and a failure comes back as previousAttempt through the client's bounded
    // auto-repair. That keeps untrusted generated code off the server entirely and validates
    // against the real environment instead of stubs.
    const needsLayers = Array.isArray(parsed.needsLayers)
      ? parsed.needsLayers.filter((id): id is string => typeof id === 'string')
      : undefined;
    const output: GenerateAdHocReportOutput = validateOutputWithSchema(
      GenerateAdHocReportOutputSchema,
      {
        code: source,
        title: typeof parsed.title === 'string' ? parsed.title : undefined,
        ...(needsLayers && needsLayers.length ? { needsLayers } : {}),
      },
      ZAMBDA_NAME
    );
    return { statusCode: 200, body: JSON.stringify(output) };
  }

  throw INVALID_INPUT_ERROR(
    `Could not generate a valid report after ${MAX_ATTEMPTS} attempts (${lastError}). Please rephrase ` +
      `your request and try again.`
  );
});
