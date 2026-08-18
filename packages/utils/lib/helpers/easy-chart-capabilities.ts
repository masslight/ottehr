// THE registry of what the easy-chart assistant can do.
//
// Before this file the action vocabulary was spelled out in six independent places — the kind array,
// the intent union, three hand-written JSON schemas, three hand-written post-parse normalizers, a
// separate ACTION_KINDS list in the review zambda, and the client's dispatcher — none of them
// connected. Adding one chartable thing meant editing all of them; missing one failed silently
// (see the drift modes documented on EasyChartIntentKindsInSync).
//
// Everything mechanical is now DERIVED from the entries below: the three response schemas, the
// per-surface kind enums, and the required-field gate every surface runs before trusting model
// output. What is deliberately NOT derived is the PROSE of the prompts: those bytes are tuned
// against real eval runs and pinned by tests, so generating them would trade a real property
// (measured prompt quality) for a cosmetic one. Instead easy-chart-capability-coverage.test.ts
// asserts every capability a surface offers is actually documented in that surface's prompt — the
// same guarantee, without rewriting tuned text.
import type { AllChartValues } from '../types/api/chart-data/chart-data.types';
import { EASY_CHART_INTENT_KINDS, EasyChartIntentKind } from '../types/data/easy-chart-agent.types';

// A property of the chart-data payload (save-chart-data / delete-chart-data / getChartData all build
// on AllChartValues). Deriving it from the DTO rather than re-typing the names is the point: rename a
// property there and every registry entry, field union and dispatcher map that referenced it fails to
// compile, instead of quietly sending a key the zambda drops on the floor.
export type EasyChartChartField = keyof AllChartValues;

// The three LLM surfaces that emit intents. `agent` classifies one typed request, `planner`
// decomposes a narrative into ordered steps, `review` proposes corrections to a written note.
export const EASY_CHART_SURFACES = ['agent', 'planner', 'review'] as const;
export type EasyChartSurface = (typeof EASY_CHART_SURFACES)[number];

// Every field any intent can carry, with its JSON-schema fragment. ONE definition per field, so a
// field can no longer be declared `string` in one zambda's schema and `number` in another's — which
// is exactly the class of bug the digit-loop guard exists to contain.
//
// DIGIT-LOOP GUARD: value/systolic/diastolic/followUpInDays are deliberately `string`, NOT `number`.
// Under Vertex constrained decoding a JSON number has no closing token, so when a model emits one on
// a kind where it is meaningless (`"value": 0.` on add-diagnosis) the digit run self-reinforces at
// temperature 0 and runs to the token cap — 31% of one planner run died this way. A string gives the
// decoder a closing quote at every position; coerceNumericStepFields() restores the numeric contract
// right after parse. Do NOT change these to `number`.
export const EASY_CHART_INTENT_FIELD_SCHEMAS = {
  display: { type: 'string' },
  searchTerms: { type: 'array', items: { type: 'string' } },
  strength: { type: 'string' },
  doseForm: { type: 'string' },
  unit: { type: 'string' },
  isPrimary: { type: 'boolean' },
  code: { type: 'string' },
  message: { type: 'string' },
  procedureMatch: { type: 'string' },
  updates: {
    type: 'array',
    items: {
      type: 'object',
      properties: { field: { type: 'string' }, value: { type: 'string' } },
      required: ['field', 'value'],
    },
  },
  field: { type: 'string' },
  newText: { type: 'string' },
  text: { type: 'string' },
  dispositionType: { type: 'string' },
  followUpInDays: { type: 'string' },
  finding: { type: 'string', enum: ['reports', 'denies'] },
  value: { type: 'string' },
  systolic: { type: 'string' },
  diastolic: { type: 'string' },
  sourceText: { type: 'string' },
} as const;

export type EasyChartIntentField = keyof typeof EASY_CHART_INTENT_FIELD_SCHEMAS;

// The fields declared as `string` for the digit-loop guard but consumed as NUMBERS downstream (client
// handlers, precompute stamps, the eval sim). coerceNumericStepFields() walks exactly this list right
// after parse. It lives here, next to the schemas that make them strings, so the guard and its undo
// can't drift apart — they were previously a schema comment in one file and a literal array in
// another, and a field added to one but not the other reaches the client as a string.
export const EASY_CHART_NUMERIC_INTENT_FIELDS = ['value', 'systolic', 'diastolic', 'followUpInDays'] as const;

// The fields each surface's schema declares, IN THE ORDER it declares them. Order is preserved
// because the serialized schema is part of the prompt payload the provider caches — reordering it
// would silently invalidate prompt caching for no benefit.
export const EASY_CHART_SURFACE_FIELDS: Record<EasyChartSurface, readonly EasyChartIntentField[]> = {
  agent: [
    'display',
    'searchTerms',
    'strength',
    'doseForm',
    'isPrimary',
    'code',
    'message',
    'procedureMatch',
    'text',
    'dispositionType',
    'followUpInDays',
    'finding',
    'updates',
    'field',
    'newText',
    'value',
    'unit',
    'systolic',
    'diastolic',
  ],
  planner: [
    'display',
    'searchTerms',
    'strength',
    'doseForm',
    'isPrimary',
    'code',
    'message',
    'procedureMatch',
    'updates',
    'field',
    'newText',
    'text',
    'dispositionType',
    'followUpInDays',
    'finding',
    'value',
    'unit',
    'systolic',
    'diastolic',
    // PROVENANCE, planner only: the verbatim narrative snippet justifying this step. Absent for steps
    // the planner INFERRED (default-normal exam, template defaults, deduced codes) — that is how the
    // client tells sourced items from guessed ones.
    'sourceText',
  ],
  review: [
    'display',
    'searchTerms',
    'code',
    'isPrimary',
    'field',
    'newText',
    'finding',
    'strength',
    'doseForm',
    'text',
    'dispositionType',
    'followUpInDays',
  ],
};

export interface EasyChartCapability {
  // Which surfaces may emit this kind. The review surface intentionally offers a narrow subset — it
  // corrects a written note, it does not chart a visit from scratch.
  surfaces: readonly EasyChartSurface[];
  // The chart-data property this intent writes to, for the kinds that land in save-chart-data's
  // payload. Typed as keyof AllChartValues, so this is the seam that ties the assistant's vocabulary
  // to the ZAMBDA'S contract: rename `episodeOfCare` on the DTO and this entry stops compiling.
  //
  // Absent for intents that don't write a chart-data property: the ones that go through a different
  // zambda (labs, radiology, nursing orders, procedures, templates), and the ones that write nothing
  // (unknown, provider-note). See EASY_CHART_NON_CHART_DATA_TARGETS for why each is absent.
  chartField?: EasyChartChartField;
  // Fields WITHOUT WHICH the client cannot execute this intent. Checked at runtime on every surface
  // (see easyChartIntentHasRequiredFields) so malformed model output is rejected where it arrives
  // rather than becoming an item that charts as `undefined` or a step that reports a bare "no match".
  required: readonly EasyChartIntentField[];
}

// One entry per intent kind. `satisfies Record<EasyChartIntentKind, …>` is what makes this a registry
// rather than documentation: add a kind to the vocabulary and the compiler demands an entry here,
// which in turn puts it in the right surfaces' schema enums and under the required-field gate.
export const EASY_CHART_CAPABILITIES = {
  // Not a charting action: the model's way of saying it could not interpret the request.
  unknown: { surfaces: ['agent', 'planner'], required: [] },
  // A message for the provider, rendered in the chat; nothing is written to the encounter.
  // NOT offered to the single-shot agent: its prompt documents no provider-note action, so the kind
  // was in that schema's enum untaught — a typed "the urinalysis showed positive nitrites" answers
  // 'unknown' today rather than pointing at the In-House Labs flow. Worth adding, but it needs the
  // prompt guidance written and eval'd, not just the surface flipped; the coverage test keeps the two
  // together.
  'provider-note': { surfaces: ['planner', 'review'], required: ['text'] },

  // Search-based adds — the client resolves `display`/`searchTerms` against a canonical source.
  'add-allergy': { surfaces: ['agent', 'planner'], required: ['display'] },
  // NOT offered to review: its prompt has no check that proposes adding past medical history, so the
  // kind sat in the review schema's enum as dead vocabulary the model was never taught to emit. Add
  // 'review' here together with the prompt guidance — the coverage test enforces that pairing.
  'add-condition': { surfaces: ['agent', 'planner'], required: ['display'] },
  'add-medication': { surfaces: ['agent', 'planner', 'review'], required: ['display'] },
  'add-surgical-history': { surfaces: ['agent', 'planner'], required: ['display'] },
  'add-hospitalization': { surfaces: ['agent', 'planner'], required: ['display'] },
  'add-diagnosis': { surfaces: ['agent', 'planner', 'review'], required: ['display'] },

  // Removes — matched against what is already on this chart.
  'remove-allergy': { surfaces: ['agent', 'planner'], required: ['display'] },
  'remove-condition': { surfaces: ['agent', 'planner'], required: ['display'] },
  'remove-medication': { surfaces: ['agent', 'planner', 'review'], required: ['display'] },
  'remove-surgical-history': { surfaces: ['agent', 'planner'], required: ['display'] },
  'remove-hospitalization': { surfaces: ['agent', 'planner'], required: ['display'] },
  'remove-diagnosis': { surfaces: ['agent', 'planner', 'review'], required: ['display'] },

  // Billing codes — the model supplies the code directly.
  'set-em-code': { surfaces: ['agent', 'planner', 'review'], required: ['code'] },
  'add-cpt': { surfaces: ['agent', 'planner', 'review'], required: ['code'] },
  // No code needed: "remove the E&M" is unambiguous, there is only ever one. Not offered to review —
  // its E&M check CHANGES the level (set-em-code), it never strips it, so this was dead vocabulary in
  // the review schema too.
  'remove-em-code': { surfaces: ['agent', 'planner'], required: [] },
  'remove-cpt': { surfaces: ['agent', 'planner', 'review'], required: ['code'] },

  'apply-template': { surfaces: ['agent', 'planner'], required: ['display'] },
  'add-procedure': { surfaces: ['agent', 'planner'], required: ['display'] },
  // `updates` carries the (field, value) pairs; procedureMatch is optional and only disambiguates
  // which procedure when several are on the encounter.
  'update-procedure': { surfaces: ['agent', 'planner'], required: ['updates'] },
  // newText is the FULL replacement text for the field, so requiring it non-blank is deliberate: a
  // model that omits it would otherwise wipe the section. The cost is that "clear the MDM" typed at
  // the assistant now answers "couldn't extract enough to act on" instead of emptying the field —
  // acceptable, because every free-text section is directly editable in the note itself. (The review
  // surface has always enforced this; the agent used to accept a blank and save it.)
  'edit-note-text': { surfaces: ['agent', 'planner', 'review'], required: ['field', 'newText'] },

  'add-exam-finding': { surfaces: ['agent', 'planner', 'review'], required: ['display'] },
  // Not offered to review: the review's pertinent-negative check only ADDS findings, and its prompt
  // never describes a removal — a third piece of dead vocabulary the old hand-written ACTION_KINDS
  // list carried.
  'remove-exam-finding': { surfaces: ['agent', 'planner'], required: ['display'] },
  // Polarity rides in `display` ("Denies …" / "Reports …"); `finding` is only a secondary signal.
  'add-ros-finding': { surfaces: ['agent', 'planner', 'review'], required: ['display'] },
  'remove-ros-finding': { surfaces: ['agent', 'planner'], required: ['display'] },

  'add-in-house-lab': { surfaces: ['agent', 'planner'], required: ['display'] },
  'add-external-lab': { surfaces: ['agent', 'planner'], required: ['display'] },
  'add-radiology': { surfaces: ['agent', 'planner'], required: ['display'] },
  'add-patient-instruction': { surfaces: ['agent', 'planner'], required: ['text'] },
  'add-nursing-order': { surfaces: ['agent', 'planner'], required: ['text'] },
  // The disposition NOTE is deliberately NOT required: when the dictation gives none the client fills
  // in the practice's configured default text for that type (the same default the regular chart's
  // Disposition card prefills). The review surface used to drop a textless disposition card entirely,
  // which threw away a real sign-off gap over missing boilerplate.
  'set-disposition': { surfaces: ['agent', 'planner', 'review'], required: ['dispositionType'] },
  // `display` carries the reading the client parses the numbers out of, so it is load-bearing.
  'set-vital': { surfaces: ['agent', 'planner'], required: ['field', 'display'] },
} as const satisfies Record<EasyChartIntentKind, EasyChartCapability>;

// Why each remaining kind has no `chartField`. Every kind must appear either with a chartField above
// or here — enforced by easy-chart-capability-coverage.test.ts — so "no chart field" is always a
// recorded decision rather than an oversight that silently drops the item's write target.
export const EASY_CHART_NON_CHART_DATA_TARGETS: Partial<Record<EasyChartIntentKind, string>> = {
  unknown: 'writes nothing — the model reporting it could not interpret the request',
  'provider-note': 'writes nothing — rendered as a chat message for the provider',
  'apply-template': 'applies a saved chart template (List resource) through the template zambdas',
  'add-procedure': 'procedures zambda; the DTO is ProcedureDTO, saved via its own path',
  'update-procedure': 'procedures zambda — edits fields on an existing ProcedureDTO',
  'edit-note-text': 'writes one of the free-text note fields, keyed by the intent\'s own `field` value',
  'add-in-house-lab': 'create-in-house-lab-order zambda (a ServiceRequest, not chart data)',
  'add-external-lab': 'create-lab-order zambda (a ServiceRequest, not chart data)',
  'add-radiology': 'radiology order zambda (a ServiceRequest, not chart data)',
  'add-nursing-order': 'nursing-order zambda (a ServiceRequest, not chart data)',
};

// An interface-typed VIEW of the registry, for the accessors below. The registry itself is declared
// `as const satisfies …` so that each entry keeps its literal types (that is what makes a renamed
// chart-data property, a bad surface name or an unknown required field a build error at the entry).
// The price is that entries without an optional key don't have it at all, so `.chartField` can't be
// read off the union — this assignment (checked, not cast) restores the uniform shape for reads.
const CAPABILITIES: Record<EasyChartIntentKind, EasyChartCapability> = EASY_CHART_CAPABILITIES;

// The chart-data property a kind writes, or undefined when it writes somewhere else (see above).
export function easyChartFieldForKind(kind: EasyChartIntentKind): EasyChartChartField | undefined {
  return CAPABILITIES[kind].chartField;
}

// The kinds a surface may emit, in canonical vocabulary order. Replaces the hand-written enum lists
// that used to sit in each zambda.
export function easyChartKindsForSurface(surface: EasyChartSurface): EasyChartIntentKind[] {
  return EASY_CHART_INTENT_KINDS.filter((kind) =>
    (EASY_CHART_CAPABILITIES[kind].surfaces as readonly string[]).includes(surface)
  );
}

// The `properties` object for a surface's intent/step/action schema: the kind enum plus that
// surface's fields. Callers wrap it in their own envelope (steps[], intent{}, suggestions[].actions[])
// and supply their own `required`, which differs by surface.
export function buildEasyChartIntentSchemaProperties(surface: EasyChartSurface): Record<string, unknown> {
  const properties: Record<string, unknown> = {
    kind: { type: 'string', enum: easyChartKindsForSurface(surface) as string[] },
  };
  for (const field of EASY_CHART_SURFACE_FIELDS[surface]) {
    properties[field] = EASY_CHART_INTENT_FIELD_SCHEMAS[field];
  }
  return properties;
}

// Does this parsed model object carry everything its kind needs to be executed?
//
// This is the gate that used to be missing. Each zambda hand-checked a few kinds and then fell
// through to `as EasyChartAgentIntent` (agent) or cast the whole array (review) — so an action with,
// say, no `display` reached the client as a well-typed intent that resolved to nothing. A string
// field counts only when non-blank; an array only when non-empty.
export function easyChartIntentHasRequiredFields(kind: string, raw: Record<string, unknown>): boolean {
  const capability = EASY_CHART_CAPABILITIES[kind as EasyChartIntentKind];
  if (!capability) return false;
  return capability.required.every((field) => {
    const v = raw[field];
    if (typeof v === 'string') return !!v.trim();
    if (Array.isArray(v)) return v.length > 0;
    return v != null;
  });
}
