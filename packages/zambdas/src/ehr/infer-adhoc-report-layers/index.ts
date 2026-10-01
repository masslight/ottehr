import { APIGatewayProxyResult } from 'aws-lambda';
import {
  CatalogDataset,
  InferAdHocLayersOutput,
  InferAdHocLayersOutputSchema,
  InferDatasetFeedback,
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
const responseSchema = (datasets: CatalogDataset[]): object => ({
  type: 'object',
  properties: {
    datasets: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'string', enum: datasets.map((d) => d.id) },
          layerIds: { type: 'array', items: { type: 'string' } },
        },
        required: ['id', 'layerIds'],
      },
    },
    unavailable: { type: 'array', items: { type: 'string' } },
    hint: { type: 'string' },
  },
  // "hint" is required so the model always writes one when it rejects; it is dropped below when
  // nothing was rejected. Marking it optional made the model skip it exactly when it was needed.
  required: ['datasets', 'hint'],
});

type CatalogField = { name: string; description?: string; fields?: { name: string; description?: string }[] };

// A record column's members are listed under it: "lot number" lives on vaccines[].lotNumber, and a
// catalogue that showed only the column name made the classifier reject it as missing.
const renderFields = (fields: CatalogField[], indent: string): string =>
  fields.length === 0
    ? `${indent}(none)`
    : fields
        .map((f) => {
          const head = `${indent}- ${f.name}${f.description ? `: ${f.description}` : ''}`;
          if (!f.fields?.length) return head;
          const members = f.fields
            .map((m) => `${indent}    ${f.name}[].${m.name}${m.description ? `: ${m.description}` : ''}`)
            .join('\n');
          return `${head}\n${members}`;
        })
        .join('\n');

const renderCatalog = (datasets: CatalogDataset[]): string =>
  datasets
    .map((dataset) => {
      const head = `DATASET ${dataset.id}: ${dataset.label}${dataset.description ? ` — ${dataset.description}` : ''}`;
      const base = `    ALWAYS-PRESENT FIELDS:\n${renderFields(dataset.fields, '      ')}`;
      const layers = dataset.layers.map(
        (layer) =>
          `    LAYER ${layer.id}: ${layer.label}${layer.description ? ` — ${layer.description}` : ''}\n` +
          `${renderFields(layer.fields, '      ')}`
      );
      return [head, base, ...layers].join('\n');
    })
    .join('\n\n');

const buildFeedbackBlock = (feedback: InferDatasetFeedback | undefined): string =>
  feedback
    ? `
PREVIOUS PASS. Dataset ${feedback.datasetId} was chosen for this request, but the report generator
could not find ${feedback.concepts.map((c) => `"${c}"`).join(', ')} there and pointed to dataset
${feedback.suggestedDatasetId}. Pick again with that in mind. If no single dataset covers the whole
request, return every dataset it needs in "datasets".
`
    : '';

const buildPrompt = (datasets: CatalogDataset[], request: string, feedback?: InferDatasetFeedback): string => {
  return `
You prepare a clinical ad-hoc report BEFORE any data is fetched. You do three things.

JOB 1 — PICK THE DATASETS. Datasets differ in what one row is (see each description) and cannot be
joined. Return in "datasets" the ONE dataset whose rows are the thing the request counts, lists or
compares and whose fields cover EVERY requested concept — through its always-present fields, its
layers, or what can be computed from them (tests 1-3 below). Words like "visits", "patients" or
"diagnoses" do not by themselves point to a dataset: several datasets carry visit counts,
demographics or codes, so judge by the fields. Only when NO single dataset covers the whole request,
return every dataset the request needs, two or more.

JOB 2 — PICK THE LAYERS. Optional layers add columns (and a heavier fetch) to a dataset. For each
returned dataset, put in its "layerIds" ONLY the ids of its own layers the request genuinely needs —
the minimal set. Base fields are always present, so never request a layer for those. When a
borderline layer is doubtful, LEAVE IT OUT: a later step can still pull a missing layer on demand.

JOB 3 — REJECT WHAT THE DATA CANNOT ANSWER. List in "unavailable" every concept the request asks for
that NO dataset holds — not in the chosen dataset, not in any other, not in any layer. Look for it in
the layers of EVERY dataset: when the SAME fact is recorded in another dataset, it is not
"unavailable". Include that dataset in "datasets" only if no single dataset covers the whole
request. A NEAR MATCH is not the same fact, in any dataset: it stays "unavailable" (see ONLY THEN
REJECT below).

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
only, from the catalogue. When "datasets" has several entries, it is one short sentence saying which
requested concept each dataset holds. Refer to a dataset by its label, never its id. Do not apologise
and do not restate the request. Otherwise return an empty string for "hint".

CATALOGUE (every dataset):
${renderCatalog(datasets)}
${buildFeedbackBlock(feedback)}
USER REQUEST:
"""
${request}
"""

Return JSON: { "datasets": [{ "id": "<dataset id>", "layerIds": ["<layer id>", ...] }, ...], "unavailable": ["<concept>", ...], "hint": "<one sentence>" }
"datasets" normally holds exactly one entry. "id" is a DATASET id from the catalogue; "layerIds" holds
only LAYER ids of that dataset and is an empty array when no optional layer is needed. Omit
"unavailable" when every requested concept exists.
`;
};

export const parseDatasets = (value: unknown, catalog: CatalogDataset[]): InferAdHocLayersOutput['datasets'] => {
  if (!Array.isArray(value)) return [];
  const picked = new Map<string, Set<string>>();
  for (const entry of value) {
    const { id, layerIds } = (entry ?? {}) as { id?: unknown; layerIds?: unknown };
    const dataset = catalog.find((d) => d.id === id);
    if (!dataset) continue;
    const validLayerIds = new Set(dataset.layers.map((l) => l.id));
    const layers = picked.get(dataset.id) ?? new Set<string>();
    if (Array.isArray(layerIds)) {
      layerIds.forEach((layerId) => {
        if (typeof layerId === 'string' && validLayerIds.has(layerId)) layers.add(layerId);
      });
    }
    picked.set(dataset.id, layers);
  }
  return Array.from(picked, ([id, layerIds]) => ({ id, layerIds: Array.from(layerIds) }));
};

export const index = wrapHandler(ZAMBDA_NAME, async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  const { datasets, request, feedback, secrets } = validateRequestParameters(input);

  await requireUserWithRole(getUserToken(input), secrets, AD_HOC_REPORT_EDIT_ROLES);

  const raw = await invokeChatbotVertexAI(
    [{ text: buildPrompt(datasets, request, feedback) }],
    secrets,
    responseSchema(datasets),
    VERTEX_AI_MODEL
  );

  const parsed = fixAndParseJsonObjectFromString(raw) as {
    datasets?: unknown;
    unavailable?: unknown;
    hint?: unknown;
  };

  const picked = parseDatasets(parsed?.datasets, datasets);
  const unavailable = Array.isArray(parsed.unavailable)
    ? parsed.unavailable.filter((c): c is string => typeof c === 'string' && c.trim().length > 0)
    : [];
  const hint = typeof parsed.hint === 'string' && parsed.hint.trim() ? parsed.hint.trim() : undefined;

  if (!picked.length && !unavailable.length) {
    throw new Error(`${ZAMBDA_NAME}: model returned no valid datasets (${JSON.stringify(parsed?.datasets)})`);
  }

  const output: InferAdHocLayersOutput = validateOutputWithSchema(
    InferAdHocLayersOutputSchema,
    {
      datasets: picked,
      ...(unavailable.length ? { unavailable: Array.from(new Set(unavailable)) } : {}),
      ...((unavailable.length || picked.length > 1) && hint ? { hint } : {}),
    },
    ZAMBDA_NAME
  );
  return { statusCode: 200, body: JSON.stringify(output) };
});
