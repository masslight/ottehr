import { captureException } from '@sentry/aws-serverless';
import { APIGatewayProxyResult } from 'aws-lambda';
import {
  CatalogDataset,
  InferAdHocLayersOutput,
  InferAdHocLayersOutputSchema,
} from 'utils/lib/types/adhoc/generation/infer.types';
import { AD_HOC_REPORT_EDIT_ROLES } from 'utils/lib/types/api/adhoc-report-access';
import { fixAndParseJsonObjectFromString } from 'utils/lib/validation/json-fix';
import { invokeChatbotVertexAI, VERTEX_AI_MODEL } from '../../shared/ai';
import { getUserToken, requireUserWithRole } from '../../shared/auth';
import { wrapHandler } from '../../shared/sentry';
import { ZambdaInput } from '../../shared/types/common';
import { validateOutputWithSchema } from '../../shared/validate-zod';
import { validateRequestParameters } from './validateRequestParameters';

const ZAMBDA_NAME = 'infer-adhoc-report-layers';

// A cheap pre-fetch classifier with two jobs in one call: pick the opt-in layers a request needs, and
// reject a request that asks for data no dataset holds. The rejection lives here rather than at
// generation time because there the model's task is "produce a report", so it tends to substitute a
// near-miss field (attending provider for referring provider) instead of refusing. Picking layers is
// a classification task, where "nothing covers this" is an ordinary answer.
const RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    layerIds: { type: 'array', items: { type: 'string' } },
    unavailable: { type: 'array', items: { type: 'string' } },
    hint: { type: 'string' },
  },
  // "hint" is required so the model always writes one when it rejects; it is dropped below when
  // nothing was rejected. Marking it optional made the model skip it exactly when it was needed.
  required: ['layerIds', 'hint'],
};

const renderFields = (fields: { name: string; description?: string }[], indent: string): string =>
  fields.length === 0
    ? `${indent}(none)`
    : fields.map((f) => `${indent}- ${f.name}${f.description ? `: ${f.description}` : ''}`).join('\n');

const renderCatalog = (datasets: CatalogDataset[], activeId: string): string =>
  datasets
    .map((dataset) => {
      const head = `${dataset.id === activeId ? '* ' : '  '}DATASET ${dataset.id}: ${dataset.label}`;
      const base = `    ALWAYS-PRESENT FIELDS:\n${renderFields(dataset.fields, '      ')}`;
      const layers = dataset.layers.map(
        (layer) =>
          `    LAYER ${layer.id}: ${layer.label}${layer.description ? ` — ${layer.description}` : ''}\n` +
          `${renderFields(layer.fields, '      ')}`
      );
      return [head, base, ...layers].join('\n');
    })
    .join('\n\n');

const buildPrompt = (activeId: string, datasets: CatalogDataset[], request: string): string => {
  return `
You prepare a clinical ad-hoc report BEFORE any data is fetched. You do two things.

JOB 1 — PICK THE LAYERS. Optional layers add columns (and a heavier fetch) to the active dataset,
marked "*" below. Return the ids of ONLY the layers the request genuinely needs — the minimal set.
Base fields are always present, so never request a layer for those. When a borderline layer is
doubtful, LEAVE IT OUT: a later step can still pull a missing layer on demand.

JOB 2 — REJECT WHAT THE DATA CANNOT ANSWER. List in "unavailable" every concept the request asks for
that NO dataset holds — not in the active dataset, not in any other, not in any layer.

REJECTING IS A LAST RESORT. It blocks the whole report, so a wrong rejection is worse than loading an
unnecessary layer. Reject ONLY a fact that nobody recorded. Apply these tests in order, and stop at
the first one that says AVAILABLE:

TEST 1 — MEANING, NOT WORDING. Requests are written in everyday clinical language, never in field
names. Match on what a field MEANS, per its description, not on how it is spelled. "Chief complaint"
is the reason for the visit; "how long the visit took" is a duration field; "payer" is the insurance
plan. If a field's description means the requested thing, it is AVAILABLE — no matter how differently
it is named.

TEST 2 — CAN IT BE COMPUTED? A metric does not need a field of its own. If it can be calculated from
fields that exist, it is AVAILABLE: differences between dates, gaps between one patient's visits,
counts, rates, averages, ordering, direction of change, "within N days", "first vs last". Computing
is exactly the report's job. DECISIVE CHECK: if you could name a field the answer could be derived
from, then it is AVAILABLE and you MUST NOT reject it — naming such a field and rejecting anyway is
a contradiction.

TEST 3 — IS IT ONLY PRESENTATION? Charts, tables, sorting, highlighting, colours and layout are never
"unavailable". Filtering and grouping count as presentation ONLY when the thing filtered or grouped
on passed test 1 or 2 — "by location" is fine because a location field exists. A filter on something
nobody records ("excluding high-risk patients", "only patients with an interpreter") is a MISSING
FACT, not presentation: judge it exactly as if it had been asked for as a column.

ONLY THEN REJECT — and only for a NEAR MATCH or a MISSING RECORDED FACT. A field naming a different
thing does not cover the request: "attending provider" is not "referring provider", a marketing
"source" is not a referral source, a "most recent" value is not an initial one. Likewise reject an
attribute nobody charts here at all (a pain score, a triage acuity level, an employer). Never let the
report substitute one of these for the other.

So: reject only when, after all three tests, the request needs a fact that is neither recorded in any
dataset nor computable from what is recorded.

Always return "hint". When "unavailable" is not empty it is one short sentence saying WHY the fact
isn't recorded, and naming the closest real field only to contrast it — "The attending provider (who
saw the patient) is recorded, but not who referred them." If nothing comes close, say so plainly:
"No field records this." If you find yourself writing that a field "could be used to derive" the
answer, then it IS available: drop the rejection and return the layers instead. Name real fields
only, from the catalogue. Do not apologise and do not restate the request. When "unavailable" is
empty, return an empty string for "hint".

CATALOGUE (every dataset; "*" marks the active one):
${renderCatalog(datasets, activeId)}

USER REQUEST:
"""
${request}
"""

Return JSON: { "layerIds": ["<id>", ...], "unavailable": ["<concept>", ...], "hint": "<one sentence>" }
"layerIds" is an empty array when no optional layer is needed. Omit "unavailable" and "hint" when
every requested concept exists. Use ONLY layer ids from the active dataset.
`;
};

export const index = wrapHandler(ZAMBDA_NAME, async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  const { datasetId, datasets, request, secrets } = validateRequestParameters(input);

  await requireUserWithRole(getUserToken(input), secrets, AD_HOC_REPORT_EDIT_ROLES);

  const activeLayers = datasets.find((d) => d.id === datasetId)?.layers ?? [];
  const validIds = new Set(activeLayers.map((l) => l.id));
  let layerIds: string[] = [];
  let unavailable: string[] = [];
  let hint: string | undefined;

  try {
    const raw = await invokeChatbotVertexAI(
      [{ text: buildPrompt(datasetId, datasets, request) }],
      secrets,
      RESPONSE_SCHEMA,
      VERTEX_AI_MODEL
    );
    const parsed = fixAndParseJsonObjectFromString(raw) as {
      layerIds?: unknown;
      unavailable?: unknown;
      hint?: unknown;
    };
    if (Array.isArray(parsed?.layerIds)) {
      layerIds = parsed.layerIds.filter((id): id is string => typeof id === 'string' && validIds.has(id));
    }
    if (Array.isArray(parsed?.unavailable)) {
      unavailable = parsed.unavailable.filter((c): c is string => typeof c === 'string' && c.trim().length > 0);
    }
    if (typeof parsed?.hint === 'string' && parsed.hint.trim()) hint = parsed.hint.trim();
  } catch (e) {
    console.warn('infer-adhoc-report-layers: inference failed, returning no layers', e);
    captureException(e);
  }

  const output: InferAdHocLayersOutput = validateOutputWithSchema(
    InferAdHocLayersOutputSchema,
    {
      layerIds: Array.from(new Set(layerIds)),
      ...(unavailable.length ? { unavailable: Array.from(new Set(unavailable)) } : {}),
      ...(unavailable.length && hint ? { hint } : {}),
    },
    ZAMBDA_NAME
  );
  return { statusCode: 200, body: JSON.stringify(output) };
});
