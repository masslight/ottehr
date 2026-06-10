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

  const output: GenerateAdHocReportOutput = {
    code: parsed.code,
    title: typeof parsed.title === 'string' ? parsed.title : undefined,
  };
  return { statusCode: 200, body: JSON.stringify(output) };
});
