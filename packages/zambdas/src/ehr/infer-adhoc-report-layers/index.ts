import { captureException } from '@sentry/aws-serverless';
import { APIGatewayProxyResult } from 'aws-lambda';
import { fixAndParseJsonObjectFromString, InferAdHocLayersOutput, InferAdHocLayersOutputSchema } from 'utils';
import { wrapHandler, ZambdaInput } from '../../shared';
import { DEFAULT_VERTEX_MODEL, invokeChatbotVertexAI } from '../../shared/ai';
import { validateOutputWithSchema } from '../../shared/validate-zod';
import { validateRequestParameters } from './validateRequestParameters';

const ZAMBDA_NAME = 'infer-adhoc-report-layers';

// A cheap pre-fetch classifier: given the opt-in data layers a dataset can load and a plain-language
// report request, return ONLY the layer ids whose data the request actually needs. The client fetches
// exactly those, so the heavy clinical layers are pulled on demand — no checkboxes, no over-fetching.
// Failure is non-fatal upstream: the generate step's `needsLayers` still backfills any layer this miss.
const RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    layerIds: { type: 'array', items: { type: 'string' } },
  },
  required: ['layerIds'],
};

const buildPrompt = (layers: { id: string; label: string; description?: string }[], request: string): string => {
  return `
You select which optional DATA LAYERS to load for a clinical ad-hoc report, BEFORE the data is fetched.

Each layer adds extra columns (and a heavier fetch) to a base dataset. Given the user's report request,
return the ids of ONLY the layers whose data the report genuinely needs — the minimal set. The base
dataset already includes visit, patient, location/provider, and registration fields, so do NOT request
a layer for those. When in doubt about whether a borderline layer is needed, LEAVE IT OUT — a later
step can still pull a missing layer on demand. Loading an unneeded layer only makes the fetch slower.

AVAILABLE LAYERS (choose ids from this list only):
${layers.map((l) => `- ${l.id}: ${l.label}${l.description ? ` — ${l.description}` : ''}`).join('\n')}

USER REQUEST:
"""
${request}
"""

Return JSON: { "layerIds": ["<id>", ...] }  — an empty array if no optional layer is needed.
`;
};

export const index = wrapHandler(ZAMBDA_NAME, async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  const { layers, request, secrets } = validateRequestParameters(input);

  const validIds = new Set(layers.map((l) => l.id));
  let layerIds: string[] = [];

  // Best-effort: a malformed/empty model response just yields no layers — the generate step's
  // needsLayers backfill is the safety net, so we never hard-fail the report on a classifier miss.
  try {
    const raw = await invokeChatbotVertexAI(
      [{ text: buildPrompt(layers, request) }],
      secrets,
      RESPONSE_SCHEMA,
      DEFAULT_VERTEX_MODEL
    );
    const parsed = fixAndParseJsonObjectFromString(raw) as { layerIds?: unknown };
    if (Array.isArray(parsed?.layerIds)) {
      layerIds = parsed.layerIds.filter((id): id is string => typeof id === 'string' && validIds.has(id));
    }
  } catch (e) {
    // Designed degradation (the report proceeds with no pre-selected layers), but the failure must
    // still surface so a persistent classifier problem doesn't go unnoticed.
    console.warn('infer-adhoc-report-layers: inference failed, returning no layers', e);
    captureException(e);
  }

  const output: InferAdHocLayersOutput = validateOutputWithSchema(
    InferAdHocLayersOutputSchema,
    { layerIds: Array.from(new Set(layerIds)) },
    ZAMBDA_NAME
  );
  return { statusCode: 200, body: JSON.stringify(output) };
});
