// Non-React logic behind the easy-chart dispatcher: chart-data fetch, intent→match scoring
// (templates, exam/ROS leaves, procedures, labs, removals), search-result ranking, payload
// building, chart warnings, and the deterministic note-drift detector.
import Oystehr from '@oystehr/sdk';
import {
  AllergyDTO,
  CPTCodeDTO,
  DiagnosisDTO,
  EasyChartAgentIntent,
  type ExamObservationDTO,
  GetChartDataResponse,
  getRosFindingStateFromKey,
  HospitalizationDTO,
  MedicalConditionDTO,
  MedicationDTO,
  ProcedureDTO,
  ProcedureQuickPickData,
  progressNoteChartDataRequestedFields,
  radiologyStudiesConfig,
  RosFindingState,
  SaveChartDataRequest,
} from 'utils';
import { HospitalizationOptions } from '../visits/in-person/components/hospitalization/hospitalizationOptions';
import { SURGICAL_HISTORY_OPTIONS } from '../visits/shared/components/medical-history-tab/SurgicalHistory/surgicalHistoryOptions';
import { useOystehrAPIClient } from '../visits/shared/hooks/useOystehrAPIClient';
import {
  AddExamFindingIntent,
  AddProcedureIntent,
  AddRosFindingIntent,
  AddSearchIntent,
  AiField,
  ApplyTemplateIntent,
  ChartedField,
  ExamRemoveItem,
  RemoveExamFindingIntent,
  RemoveIntent,
  RemoveMatch,
  SearchResult,
  TemplateMatch,
  UpdateProcedureIntent,
} from './chart-types';
import { ExamLeaf, FIELD_TO_SECTION_LABEL, RosLeaf, SECTION_LABEL_TO_CARD } from './exam-ros-catalog';

export async function fetchEasyChartData(
  apiClient: NonNullable<ReturnType<typeof useOystehrAPIClient>>,
  encounterId: string
): Promise<GetChartDataResponse> {
  // The note-style fields (CC/HPI/MOI/ROS/MDM) are only returned with explicit requestedFields,
  // while diagnosis/exam/ros observations only return from a full unscoped call. Fetch both.
  const [noteFields, fullChart] = await Promise.all([
    // vitalsObservations is gated (not returned by an unscoped call), so request it explicitly —
    // the header shows the latest weight (relevant to the mg/kg dosing Easy Chart does).
    apiClient.getChartData({
      encounterId,
      requestedFields: { ...progressNoteChartDataRequestedFields, vitalsObservations: {} },
    }),
    apiClient.getChartData({ encounterId }),
  ]);
  return { ...fullChart, ...noteFields };
}

export function isRemoveIntent(intent: EasyChartAgentIntent): intent is RemoveIntent {
  return (
    intent.kind === 'remove-allergy' ||
    intent.kind === 'remove-condition' ||
    intent.kind === 'remove-medication' ||
    intent.kind === 'remove-surgical-history' ||
    intent.kind === 'remove-hospitalization' ||
    intent.kind === 'remove-diagnosis'
  );
}

export function findRemoveMatches(intent: RemoveIntent, data: GetChartDataResponse | null): RemoveMatch[] {
  if (!data) return [];
  // remove-* intents (e.g. the review's remove-diagnosis) often carry only `display` and no
  // searchTerms — guard the spread so an absent/non-array searchTerms can't throw, and filter to
  // non-empty strings BEFORE lowercasing so an undefined display/term can't throw either.
  const terms = [intent.display, ...(Array.isArray(intent.searchTerms) ? intent.searchTerms : [])]
    .filter((t): t is string => typeof t === 'string' && t.length > 0)
    .map((t) => t.toLowerCase());
  // Meaningful words for the order-free match below — glue words are dropped so "injury of neck"
  // and "neck injury" reduce to the same token set.
  const REMOVE_STOPWORDS = new Set(['of', 'the', 'a', 'an', 'to', 'in', 'on', 'and', 'or', 'with', 'without']);
  const meaningfulTokens = (s: string): string[] => tokenize(s).filter((w) => w.length > 1 && !REMOVE_STOPWORDS.has(w));
  const nameMatches = (haystack: string | undefined | null): boolean => {
    if (!haystack) return false;
    const h = haystack.toLowerCase();
    if (terms.some((t) => h.includes(t) || t.includes(h))) return true;
    // Order-free token match: the provider's word order rarely matches the charted display
    // ("remove the neck injury" vs "Unspecified injury of neck, initial encounter"), so also
    // accept a term whose every meaningful word appears somewhere in the name.
    const hayTokens = new Set(meaningfulTokens(h));
    return terms.some((t) => {
      const qt = meaningfulTokens(t);
      return qt.length > 0 && qt.every((w) => hayTokens.has(w));
    });
  };

  const out: RemoveMatch[] = [];
  if (intent.kind === 'remove-allergy') {
    (data.allergies ?? []).forEach((a) => {
      if (a.resourceId && nameMatches(a.name)) {
        out.push({ resourceId: a.resourceId, displayName: a.name ?? '(unnamed)', field: 'allergies', dto: a });
      }
    });
  } else if (intent.kind === 'remove-condition') {
    (data.conditions ?? []).forEach((c) => {
      if (c.resourceId && (nameMatches(c.display) || (c.code && terms.some((t) => c.code!.toLowerCase() === t)))) {
        out.push({
          resourceId: c.resourceId,
          displayName: c.display ?? c.code ?? '(unnamed)',
          field: 'conditions',
          dto: c,
        });
      }
    });
  } else if (intent.kind === 'remove-medication') {
    (data.medications ?? []).forEach((m) => {
      if (m.resourceId && nameMatches(m.name)) {
        out.push({ resourceId: m.resourceId, displayName: m.name, field: 'medications', dto: m });
      }
    });
  } else if (intent.kind === 'remove-surgical-history') {
    (data.surgicalHistory ?? []).forEach((s) => {
      if (s.resourceId && (nameMatches(s.display) || terms.some((t) => s.code === t))) {
        out.push({
          resourceId: s.resourceId,
          displayName: s.display ?? s.code ?? '(unnamed)',
          field: 'surgicalHistory',
          dto: s,
        });
      }
    });
  } else if (intent.kind === 'remove-hospitalization') {
    (data.episodeOfCare ?? []).forEach((h) => {
      if (h.resourceId && (nameMatches(h.display) || terms.some((t) => h.code === t))) {
        out.push({
          resourceId: h.resourceId,
          displayName: h.display ?? h.code ?? '(unnamed)',
          field: 'episodeOfCare',
          dto: h,
        });
      }
    });
  } else if (intent.kind === 'remove-diagnosis') {
    (data.diagnosis ?? []).forEach((d) => {
      if (d.resourceId && (nameMatches(d.display) || terms.some((t) => d.code.toLowerCase() === t))) {
        out.push({ resourceId: d.resourceId, displayName: `${d.code} — ${d.display}`, field: 'diagnosis', dto: d });
      }
    });
  }
  return out;
}

// A diagnosis SWAP (remove-diagnosis + add-diagnosis in one batch) must never demote the chart's
// primary: a missing/false isPrimary on the add charts it as SECONDARY, so swapping the primary
// left the note with NO primary dx (billing-invalid). Used by BOTH replay paths:
//  - review suggestions (the "diagnosis" card): flash-lite reliably OMITS isPrimary despite the
//    prompt/schema requiring it — carry the removed dx's status onto the first add that lacks a
//    boolean one (further unmarked adds become explicitly secondary — exactly one primary). A
//    model-stated boolean is never overridden here; pickPrimaryPromotion backstops the rest.
//  - the PLANNER's plan execution (a dictated correction: "remove the strep diagnosis, it's
//    mono"): on an incremental re-message the planner SERVER demotes every new add to an explicit
//    isPrimary:false (the never-usurp rule) — correct for pure additions, wrong when the same plan
//    REMOVES the primary. Pass reclaimPrimary to let the first add reclaim primary over an
//    explicit false in exactly that case (removed dx is primary AND no add claims primary).
// Deterministic: resolves the remove against the STRUCTURED chart with the same matcher the
// dispatcher uses, so it must run BEFORE any of the actions execute. No remove, no adds, or no
// resolvable match → input returned untouched. Returns a new array; never mutates input.
export function carrySwapPrimary<T extends EasyChartAgentIntent>(
  actions: T[],
  data: GetChartDataResponse | null,
  opts?: { reclaimPrimary?: boolean }
): T[] {
  const removeDx = actions.find((a) => a.kind === 'remove-diagnosis');
  const addIdxs = actions.map((a, i) => (a.kind === 'add-diagnosis' ? i : -1)).filter((i) => i >= 0);
  if (!removeDx || addIdxs.length === 0) return actions;
  const isPrimaryOf = (a: EasyChartAgentIntent): unknown => (a as { isPrimary?: unknown }).isPrimary;
  const missingIdxs = addIdxs.filter((i) => typeof isPrimaryOf(actions[i]) !== 'boolean');
  const hasExplicitPrimary = addIdxs.some((i) => isPrimaryOf(actions[i]) === true);
  const mayReclaim = !!opts?.reclaimPrimary && !hasExplicitPrimary;
  if (missingIdxs.length === 0 && !mayReclaim) return actions;
  const matches = findRemoveMatches(removeDx as RemoveIntent, data);
  if (matches.length === 0) return actions;
  // Same pick as handleRemovePick on the non-interactive path: the first match is the one removed.
  const removedIsPrimary = !!(matches[0].dto as { isPrimary?: boolean }).isPrimary;
  // The add that ends up primary: the first UNMARKED one normally; under reclaimPrimary, the first
  // add even over an explicit false (the planner-server demotion case). Never mint a second
  // primary when the model already marked one, and never promote anything for a secondary swap.
  const primaryIdx = removedIsPrimary && !hasExplicitPrimary ? missingIdxs[0] ?? (mayReclaim ? addIdxs[0] : -1) : -1;
  if (primaryIdx < 0 && missingIdxs.length === 0) return actions;
  return actions.map((a, i) => {
    if (i === primaryIdx) return { ...a, isPrimary: true } as T;
    if (missingIdxs.includes(i)) return { ...a, isPrimary: false } as T;
    return a;
  });
}

// Post-suggestion safety net for the swap above: when the chart holds diagnoses but NONE is
// primary (the remove demoted the primary and the add didn't restore it), pick the dx to promote —
// prefer one matching a suggestion add-diagnosis (by code, then display substring either way, in
// action order: the dx the swap just charted), else the first with a resourceId. Returns undefined
// when no promotion is needed (no diagnoses, or a primary already exists).
export function pickPrimaryPromotion(
  actions: EasyChartAgentIntent[],
  diagnoses: DiagnosisDTO[] | undefined
): DiagnosisDTO | undefined {
  const dx = (diagnoses ?? []).filter((d) => d.resourceId);
  if (dx.length === 0 || dx.some((d) => d.isPrimary)) return undefined;
  for (const a of actions) {
    if (a.kind !== 'add-diagnosis') continue;
    const code = typeof a.code === 'string' ? a.code.trim().toUpperCase() : '';
    if (code) {
      const byCode = dx.find((d) => (d.code ?? '').trim().toUpperCase() === code);
      if (byCode) return byCode;
    }
    const disp = (a.display ?? '').trim().toLowerCase();
    if (disp) {
      const byDisplay = dx.find((d) => {
        const h = (d.display ?? '').trim().toLowerCase();
        return !!h && (h.includes(disp) || disp.includes(h));
      });
      if (byDisplay) return byDisplay;
    }
  }
  return dx[0];
}

export function filterStaticOptions(options: { display: string; code: string }[], term: string): SearchResult[] {
  const lower = term.toLowerCase();
  return options.filter((o) => o.display.toLowerCase().includes(lower)).map((o) => ({ name: o.display, code: o.code }));
}

// Walk every list + scalar field on a chart-data snapshot and return the union of resourceIds.
// Used to diff before/after apply-template so we can flash everything the template just added.
export function collectResourceIds(data: GetChartDataResponse | null): Set<string> {
  const ids = new Set<string>();
  if (!data) return ids;
  const arr = (xs: { resourceId?: string }[] | undefined): void => {
    (xs ?? []).forEach((x) => x.resourceId && ids.add(x.resourceId));
  };
  arr(data.diagnosis);
  arr(data.conditions);
  arr(data.allergies);
  arr(data.medications);
  arr(data.surgicalHistory);
  arr(data.episodeOfCare);
  arr(data.examObservations);
  arr(data.rosObservations);
  arr(data.vitalsObservations);
  arr(data.instructions);
  arr(data.cptCodes);
  arr(data.procedures);
  for (const scalar of [
    data.chiefComplaint,
    data.historyOfPresentIllness,
    data.mechanismOfInjury,
    data.ros,
    data.medicalDecision,
    data.emCode,
  ]) {
    if (scalar?.resourceId) ids.add(scalar.resourceId);
  }
  return ids;
}

// Match a template against the user's intent. Tokenize on non-word characters and accept
// substring matches in either direction so "lac repair" matches "Laceration, Scalp" via
// "lac" ⊂ "laceration", and "laceration" matches "lac" too. A template matches when ANY
// query token (across display + searchTerms) substring-matches ANY title token. Lenient by
// design — with a small template list it's better to over-suggest and let the provider pick.
export function tokenize(s: string): string[] {
  return s
    .toLowerCase()
    .split(/[^a-z0-9]+/i)
    .filter(Boolean);
}
// Words a provider often says when asking for a template that aren't part of any title.
// Filtering these prevents "apply lac repair template" from matching every title containing
// the word "template" (e.g. "Athena's Empty Template").
export const TEMPLATE_QUERY_STOPWORDS = new Set([
  'apply',
  'use',
  'template',
  'templates',
  'for',
  'the',
  'a',
  'an',
  'of',
  'and',
  'please',
  'to',
]);
export function findTemplateMatches(intent: ApplyTemplateIntent, templates: TemplateMatch[]): TemplateMatch[] {
  // Use only the provider's display phrase, not the LLM-supplied searchTerms — the model
  // tends to over-expand (e.g. emitting "ankle laceration" for "lac repair"). Prefix match
  // on title tokens (≥2 chars) so "lac" matches "laceration" but NOT "placement" — substring
  // matching was too loose (placement contains "lac" inside p-lac-ement).
  const queryTokens = tokenize(intent.display)
    .filter((tok) => tok.length >= 2)
    .filter((tok) => !TEMPLATE_QUERY_STOPWORDS.has(tok));
  if (queryTokens.length === 0) return [];
  const queryDisplay = intent.display.trim().toLowerCase();
  // Score each template title:
  //   - 1000 if title (case-insensitive) equals the provider's display verbatim — perfect match.
  //   - +20 per query token that has an EXACT match (whole-token) in the title.
  //   - +5 per query token that has a PREFIX match in the title (partial).
  //   - +10 if every query token matched (allMatched bonus).
  //   - −10 length penalty per extra title token beyond what the query asked for, so
  //     "AOM Right" outranks "AOM Right (acute otitis media) with watch and wait" when the
  //     provider just asked for "AOM Right".
  const scored = templates
    .map((t) => {
      const titleTokens = tokenize(t.title);
      const titleLower = t.title.trim().toLowerCase();
      let score = 0;
      let allMatched = true;
      for (const qt of queryTokens) {
        const exact = titleTokens.includes(qt);
        const prefix = !exact && titleTokens.some((tt) => tt.startsWith(qt));
        if (exact) score += 20;
        else if (prefix) score += 5;
        else allMatched = false;
      }
      if (allMatched && queryTokens.length > 1) score += 10;
      if (titleLower === queryDisplay) score += 1000;
      // Length penalty: extra tokens in the title beyond the query length are noise.
      const extraTokens = Math.max(0, titleTokens.length - queryTokens.length);
      score -= extraTokens * 2;
      return { t, score };
    })
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score);
  return scored.map((s) => s.t);
}

// Same shape as template matching: forward substring match against quick-pick names,
// stopwords stripped so "add lac repair procedure" doesn't pollute results.
export const PROCEDURE_QUERY_STOPWORDS = new Set([
  'add',
  'do',
  'perform',
  'procedure',
  'procedures',
  'a',
  'an',
  'the',
  'of',
  'for',
  'and',
  'please',
  'to',
]);
// Same prefix-token strategy used for templates/procedures, plus a few exam-specific
// noise words. Each search term (display + LLM searchTerms) is tested independently; a leaf
// matches if any of its label OR section tokens has a prefix-match for at least one of the
// search term's non-stopword tokens. Score = number of matching tokens, used to rank.
export const EXAM_QUERY_STOPWORDS = new Set([
  'add',
  'exam',
  'finding',
  'abnormal',
  'normal',
  'the',
  'a',
  'an',
  'on',
  'of',
  'has',
  'patient',
  'check',
  'to',
  'and',
  'at',
  'in',
  'is',
  'are',
  'was',
  'were',
  'with',
  'without',
  'by',
  'or',
  'best',
  'across',
  'well',
  'area',
  'noted',
]);
// ROS matching uses the exam stopwords plus generic symptom MODIFIERS that, on their own, cause
// false matches (e.g. "loss of sensation" matching "Weight loss/gain" on the shared word "loss").
// Stripping these from BOTH the query and the catalog labels forces matches onto the key symptom
// noun, so a symptom with no catalog item (e.g. "loss of sensation") correctly finds nothing.
export const ROS_QUERY_STOPWORDS = new Set([
  ...EXAM_QUERY_STOPWORDS,
  'denies',
  'reports',
  'loss',
  'gain',
  'poor',
  'changes',
  'change',
  'difficulty',
  'problems',
  'problem',
  'recent',
  'new',
  'any',
  'no',
  'history',
  'symptoms',
  'symptom',
  'in',
  'or',
]);
// Body-region equivalence classes — every token in a list collapses to the same region key.
// Used by findExamLeafMatches to constrain candidates to the body region the provider named.
// "throat" should match the "Oral Cavity" section's "Erythematous pharynx" leaf because
// throat/pharynx/oral cavity are the same clinical region; an exact-token gate misses that.
export const EXAM_BODY_REGION_CLASSES: string[][] = [
  ['throat', 'pharynx', 'oropharynx', 'oral', 'mouth', 'tonsils', 'tonsillar', 'palate', 'uvula', 'dentition'],
  ['lungs', 'lung', 'pulmonary', 'chest', 'wheezing', 'rales', 'rhonchi'],
  ['heart', 'cardiac', 'cv', 'cardiovascular'],
  [
    'abdomen',
    'abdominal',
    'belly',
    'gi',
    'rectum',
    'genitourinary',
    'gu',
    'cva',
    'suprapubic',
    'pelvic',
    'pelvis',
    'groin',
    'inguinal',
    'flank',
    'epigastric',
    'periumbilical',
    'quadrant',
    'quadrants',
    'mcburney',
    'mcburneys',
  ],
  ['ears', 'ear', 'tm', 'tympanic', 'auditory', 'auricle', 'tragus', 'canal', 'canals', 'pinna'],
  ['nose', 'nasal', 'sinus', 'sinuses', 'rhinoscopy', 'septum', 'turbinate', 'epistaxis', 'nares', 'nostril'],
  [
    'eyes',
    'eye',
    'conjunctiva',
    'sclera',
    'pupil',
    'pupils',
    'ocular',
    'eyelid',
    'eyelids',
    'lid',
    'lids',
    'cornea',
    'corneal',
  ],
  ['skin', 'dermatologic', 'dermatology', 'rash'],
  ['neck', 'lymph', 'cervical'],
  ['head', 'scalp', 'forehead', 'temple', 'occiput', 'frontal', 'facial', 'face', 'fontanelle'],
  [
    'extremities',
    'extremity',
    'limbs',
    'arm',
    'arms',
    'shoulder',
    'elbow',
    'wrist',
    'hand',
    'hands',
    'finger',
    'fingers',
    'forearm',
    'humerus',
  ],
  [
    'extremities',
    'extremity',
    'limbs',
    'leg',
    'legs',
    'knee',
    'ankle',
    'hip',
    'foot',
    'feet',
    'toe',
    'toes',
    'metatarsal',
    'metatarsals',
    'midfoot',
    'heel',
    'calcaneus',
    'plantar',
    'shin',
    'shins',
    'tibia',
    'tibial',
    'fibula',
    'calf',
    'calves',
    'popliteal',
    'homan',
    'homans',
    'thigh',
    'thighs',
    'femur',
  ],
  ['back', 'spine', 'spinal', 'lumbar', 'lumbosacral', 'sacral', 'paraspinal', 'vertebral'],
  ['neurologic', 'neuro', 'neurological'],
  ['musculoskeletal', 'msk'],
  ['general', 'appearance'],
];
// A token may belong to MULTIPLE classes ("extremities" covers both upper- and lower-limb
// classes), so the map holds class-id sets and the gate checks for any intersection.
export const EXAM_BODY_REGION_OF: Map<string, Set<number>> = new Map();
EXAM_BODY_REGION_CLASSES.forEach((cls, i) =>
  cls.forEach((t) => {
    const set = EXAM_BODY_REGION_OF.get(t) ?? new Set<number>();
    set.add(i);
    EXAM_BODY_REGION_OF.set(t, set);
  })
);

// Structure-type contradiction: a query about a LIGAMENT must not chart a BONE finding — an
// ankle sprain's "tenderness over the anterior talofibular ligament" is precisely NOT "point
// tenderness over bone" (the dictations usually deny bony tenderness in the same breath).
const STRUCTURE_TOKENS: Record<string, string> = {
  bone: 'bone',
  bony: 'bone',
  ligament: 'ligament',
  ligamentous: 'ligament',
  tendon: 'tendon',
  tendinous: 'tendon',
  muscle: 'muscle',
  muscular: 'muscle',
};
function structureClassesOf(tokens: string[]): Set<string> {
  const out = new Set<string>();
  for (const t of tokens) {
    const cls = STRUCTURE_TOKENS[t];
    if (cls) out.add(cls);
  }
  return out;
}

// Map a free-text finding to the exam SECTION whose free-text comment area should hold it when
// no checkbox leaf matches ("Positive Homan's sign" → Extremities). Representative tokens resolve
// through the region classes so synonyms (shin/tibia/popliteal…) inherit the mapping.
const SECTION_REPRESENTATIVES: Array<[string, string]> = [
  ['throat', 'Oral Cavity'],
  ['lungs', 'Lungs, Chest Wall'],
  ['heart', 'Heart'],
  ['abdomen', 'Abdomen'],
  ['ears', 'Ears'],
  ['nose', 'Nose'],
  ['eyes', 'Eyes'],
  ['skin', 'Skin, Hair, Nails'],
  ['neck', 'Neck'],
  ['lymph', 'Lymph Nodes'],
  ['head', 'Head'],
  ['arm', 'Extremities'],
  ['leg', 'Extremities'],
  ['back', 'Back'],
  ['neurologic', 'Neurologic'],
  ['general', 'General Appearance'],
];
const REGION_CLASS_TO_SECTION = new Map<number, string>();
for (const [token, section] of SECTION_REPRESENTATIVES) {
  for (const cls of EXAM_BODY_REGION_OF.get(token) ?? []) {
    if (!REGION_CLASS_TO_SECTION.has(cls)) REGION_CLASS_TO_SECTION.set(cls, section);
  }
}
export function inferExamSectionLabel(text: string): string | undefined {
  for (const t of tokenize(text)) {
    for (const cls of EXAM_BODY_REGION_OF.get(t) ?? []) {
      const section = REGION_CLASS_TO_SECTION.get(cls);
      if (section) return section;
    }
  }
  return undefined;
}

// Anatomy → exam-card vocabulary for the wrong-section guard: tokens that UNAMBIGUOUSLY name
// the anatomy of exactly one exam card. High precision over coverage — an ambiguous term
// ("vestibule" is nasal or vaginal, "discharge" is any orifice) maps to nothing. Values must be
// card labels from examConfig (locked by a test against SECTION_TO_COMMENT_FIELD).
export const EXAM_ANATOMY_SECTION_OF: Record<string, string> = {
  vaginal: 'GU (Female)',
  vagina: 'GU (Female)',
  vulvar: 'GU (Female)',
  vulva: 'GU (Female)',
  labial: 'GU (Female)',
  labia: 'GU (Female)',
  introitus: 'GU (Female)',
  adnexal: 'GU (Female)',
  penile: 'GU (Male)',
  penis: 'GU (Male)',
  scrotal: 'GU (Male)',
  scrotum: 'GU (Male)',
  testicular: 'GU (Male)',
  testicle: 'GU (Male)',
  testicles: 'GU (Male)',
  testis: 'GU (Male)',
  testes: 'GU (Male)',
  foreskin: 'GU (Male)',
  cremasteric: 'GU (Male)',
  rectal: 'Rectal',
  rectum: 'Rectal',
  anal: 'Rectal',
  anus: 'Rectal',
  perianal: 'Rectal',
  perirectal: 'Rectal',
  hemorrhoid: 'Rectal',
  hemorrhoids: 'Rectal',
  tympanic: 'Ears',
  otoscopy: 'Ears',
  otoscopic: 'Ears',
  conjunctiva: 'Eyes',
  conjunctival: 'Eyes',
  sclera: 'Eyes',
  scleral: 'Eyes',
  pupil: 'Eyes',
  pupils: 'Eyes',
  cornea: 'Eyes',
  corneal: 'Eyes',
  pharynx: 'Oral Cavity',
  pharyngeal: 'Oral Cavity',
  oropharynx: 'Oral Cavity',
  tonsil: 'Oral Cavity',
  tonsils: 'Oral Cavity',
  tonsillar: 'Oral Cavity',
  uvula: 'Oral Cavity',
  turbinate: 'Nose',
  turbinates: 'Nose',
  nares: 'Nose',
  nostril: 'Nose',
  nostrils: 'Nose',
};

// The exam card the finding text's anatomy belongs to, when that is unambiguous. Tokens outside
// EXAM_ANATOMY_SECTION_OF never vote; hits across MORE than one card → no verdict (conservative).
export function unambiguousAnatomySection(text: string): string | undefined {
  const sections = new Set<string>();
  for (const t of tokenize(text)) {
    const section = EXAM_ANATOMY_SECTION_OF[t];
    if (section) sections.add(section);
  }
  return sections.size === 1 ? sections.values().next().value : undefined;
}

// Wrong-section guard for add-exam-finding: when the finding TEXT names anatomy that belongs
// unambiguously to one exam card ("vaginal" → GU (Female)), candidates from OTHER cards are
// discarded — that's how "erythematous vaginal vestibule, white discharge present" once landed
// under the wrong card on shared descriptor words. No vocabulary hit, multi-card hits, or an
// all-in-card match list leave the ranking untouched. `redirectedFrom` carries the dropped top
// candidate's card ONLY when the guard changed (or emptied) the top pick, so the dispatcher can
// surface the correction.
export function guardExamSectionMatches(
  intent: AddExamFindingIntent,
  scored: { leaf: ExamLeaf; score: number }[]
): { scored: { leaf: ExamLeaf; score: number }[]; anatomySection?: string; redirectedFrom?: string } {
  const anatomySection = unambiguousAnatomySection(intent.display);
  if (!anatomySection) return { scored };
  const cardOf = (leaf: ExamLeaf): string => SECTION_LABEL_TO_CARD[leaf.section] ?? leaf.section;
  const kept = scored.filter((s) => cardOf(s.leaf) === anatomySection);
  if (kept.length === scored.length) return { scored, anatomySection };
  const topChanged = scored.length > 0 && kept[0]?.leaf !== scored[0].leaf;
  return {
    scored: kept,
    anatomySection,
    ...(topChanged ? { redirectedFrom: cardOf(scored[0].leaf) } : {}),
  };
}

// The two extremity classes hold anatomically DISJOINT sub-parts (hip ≠ shin ≠ ankle), unlike
// e.g. the ear class whose tokens are all one organ (ear/TM/canal). For extremity queries the
// class-level gate is too coarse — "shin erythema" must not chart a "Hip — Skin — Erythema"
// leaf — so specific extremity part tokens must overlap (equal/prefix/known synonym).
const EXTREMITY_CLASS_IDS = new Set(
  EXAM_BODY_REGION_CLASSES.map((cls, i) => (cls.includes('extremities') ? i : -1)).filter((i) => i >= 0)
);
const EXTREMITY_GENERIC_TOKENS = new Set(['extremities', 'extremity', 'limbs']);
const EXTREMITY_PART_SYNONYMS: Record<string, string[]> = {
  shin: ['tibia', 'tibial'],
  tibia: ['shin'],
  tibial: ['shin'],
  heel: ['calcaneus'],
  calcaneus: ['heel'],
};
function specificExtremityTokens(tokens: string[]): string[] {
  const parts = tokens.filter((t) => {
    if (EXTREMITY_GENERIC_TOKENS.has(t)) return false;
    const classes = EXAM_BODY_REGION_OF.get(t);
    return !!classes && [...classes].some((c) => EXTREMITY_CLASS_IDS.has(c));
  });
  // "Left LOWER extremity edema" names no concrete part, but "lower" + an extremity word IS a
  // class signal — without it, a lower-leg finding can land on a Shoulder leaf (both pass the
  // coarse gate via the ambiguous "extremities" token). Map upper/lower to a representative part.
  if (parts.length === 0 && tokens.some((t) => EXTREMITY_GENERIC_TOKENS.has(t) || t === 'extremity')) {
    if (tokens.includes('lower')) parts.push('leg');
    else if (tokens.includes('upper')) parts.push('arm');
  }
  return parts;
}
function extremityPartsOverlap(a: string[], b: string[]): boolean {
  return a.some((x) =>
    b.some((y) => x === y || x.startsWith(y) || y.startsWith(x) || (EXTREMITY_PART_SYNONYMS[x] ?? []).includes(y))
  );
}

// Clinical descriptor synonyms. Provider says one word, catalog uses another — without a
// synonym map, "throat injected" finds nothing because the catalog says "Erythematous pharynx".
// Each row collapses to one canonical key; tokens map to it. Used by findExamLeafMatches to
// expand query tokens before scoring.
export const EXAM_DESCRIPTOR_SYNONYMS: string[][] = [
  ['injected', 'erythematous', 'erythema', 'red', 'reddened', 'inflamed'],
  ['tender', 'tenderness', 'painful'],
  ['swollen', 'edematous', 'edema', 'swelling'],
  ['bulging', 'bulge'],
  ['exudate', 'pus', 'purulent'],
  ['rales', 'crackles'],
  ['discharge', 'drainage'],
  ['lesion', 'ulcer', 'ulcers', 'vesicle', 'vesicles'],
  ['rash', 'eruption', 'dermatitis'],
  ['bruising', 'bruise', 'bruised', 'ecchymosis', 'ecchymotic', 'contusion'],
  ['fluid', 'effusion'],
  ['debris'],
];
export const EXAM_DESCRIPTOR_CLASS_OF: Map<string, number> = new Map();
// Descriptor-only tokens that name a SENSATION or surface quality but no anatomy — "pain",
// "tenderness", "swelling", "erythema". A finding match anchored ONLY on these is how "denies
// groin pain" charted "Denies Eye pain" and a shin cellulitis matched a rhinoscopy leaf: the
// scorers below discount them so a generic token can never carry a match by itself.
// Light stemmer for finding-token comparison: "wheezes"/"wheezing" must match the "Wheezing"
// leaf, "pulses" must match "pulse". Strips one common suffix; min stem length 4 avoids
// over-stripping short words.
export function stemToken(t: string): string {
  const stripped = t.replace(/(?:ing|ed|es|s)$/, '');
  return stripped.length >= 4 ? stripped : t;
}
export function stemEq(a: string, b: string): boolean {
  return a === b || stemToken(a) === stemToken(b);
}

// Markers that a dictated finding reports NORMALCY ("pulses 2 plus", "neck supple", "sensation
// intact") — such queries must never auto-chart the abnormal counterpart of the same finding
// ("Diminished pulses").
const NORMALCY_TOKENS = new Set([
  'normal',
  'intact',
  'unremarkable',
  'brisk',
  'strong',
  'supple',
  'patent',
  'clear',
  'symmetric',
  'regular',
]);
const NORMALCY_PATTERNS =
  /\b[0-9]\s*(?:\+|plus)\b|\b5 out of 5\b|\b5\s*\/\s*5\b|\b20\/20\b|\bwell[- ]appearing\b|\bwell[- ]hydrated\b|\bcalm\b|\bcomfortable\b|\bplayful\b|\binteractive\b|\bconsolable\b/i;

export const GENERIC_FINDING_TOKENS = new Set([
  'pain',
  'pains',
  'painful',
  'ache',
  'aches',
  'aching',
  'tender',
  'tenderness',
  'sore',
  'soreness',
  'discomfort',
  'swelling',
  'swollen',
  'edema',
  'edematous',
  'erythema',
  'erythematous',
  'red',
  'redness',
  'warm',
  'warmth',
  'induration',
  'superficial',
  'mild',
  'moderate',
  'severe',
  'acute',
  'chronic',
  'localized',
  'diffuse',
  'bilateral',
  'anterior',
  'posterior',
  'medial',
  'lateral',
  'proximal',
  'distal',
  'superior',
  'inferior',
  'left',
  'right',
  'upper',
  'lower',
  'mid',
  'bilaterally',
  'scattered',
  'positive',
  'appearing',
  'second',
  'seconds',
  'minute',
  'minutes',
  'hour',
  'hours',
  'bleeding',
  'bleed',
  'point',
  'sign',
  'signs',
  'grossly',
  'gross',
  'soft',
  'flat',
  'firm',
  'linear',
]);

EXAM_DESCRIPTOR_SYNONYMS.forEach((cls, i) => cls.forEach((t) => EXAM_DESCRIPTOR_CLASS_OF.set(t, i)));

export const EXAM_NEGATION_TOKENS = new Set(['no', 'non', 'without', 'denies', 'absent', 'negative']);

// Tokens that, when in the query, signal the provider is asking about an abnormal/lost/reduced
// version of a finding. Catalog labels typically describe the POSITIVE/INTACT form ("pearly with
// good light reflex", "reactive to light"). When the query has a negator like "loss" near a
// descriptor token, we should NOT pick a positive-form leaf containing that descriptor.
// Distinct from EXAM_NEGATION_TOKENS (which is about labels being structurally negated, like
// "non-injected"); these are query-level negators that flip the polarity of the WHOLE finding.
export const EXAM_QUERY_NEGATORS = new Set([
  'loss',
  'lost',
  'absent',
  'absence',
  'no',
  'non',
  'without',
  'denies',
  'reduced',
  'decreased',
  'diminished',
  'impaired',
  'poor',
  'weak',
  'abnormal',
  'abnormality',
  'abnormalities',
]);

export function findExamLeafMatchesScored(
  intent: AddExamFindingIntent,
  leaves: ExamLeaf[]
): { leaf: ExamLeaf; score: number }[] {
  // Use only the provider's display phrase — LLM-expanded searchTerms produced too many ties.
  // MIXED displays ("healing crust, no fluctuance, no purulent drainage") state a finding plus
  // absent ones: tokens inside a negation window describe what ISN'T there, and matching them
  // as content asserts the opposite ("Discharge present"). Drop them — but only when positive
  // content remains; a PURE negative ("no CVA tenderness") keeps its tokens for the polarity
  // matching below, which pairs it with negation-encoded leaves.
  const rawDisplayTokens = tokenize(intent.display);
  const negatedPositions = new Set<number>();
  rawDisplayTokens.forEach((t, i) => {
    if (EXAM_NEGATION_TOKENS.has(t)) {
      negatedPositions.add(i + 1);
      negatedPositions.add(i + 2);
    }
  });
  const contentTokens = rawDisplayTokens.filter((tok) => tok.length >= 2 && !EXAM_QUERY_STOPWORDS.has(tok));
  const positiveTokens = rawDisplayTokens
    .filter((_, i) => !negatedPositions.has(i))
    .filter((tok) => tok.length >= 2 && !EXAM_QUERY_STOPWORDS.has(tok) && !EXAM_NEGATION_TOKENS.has(tok));
  const isMixed = positiveTokens.length > 0 && positiveTokens.length < contentTokens.length;
  const queryTokens = isMixed ? positiveTokens : contentTokens;
  // What the display explicitly negated ("no INJECTION") — an abnormal leaf asserting one of these
  // is the OPPOSITE of the dictation and must never match, even via its anatomy words.
  const negatedTokens = new Set(
    rawDisplayTokens
      .filter((_, i) => negatedPositions.has(i))
      .filter((tok) => tok.length >= 2 && !EXAM_QUERY_STOPWORDS.has(tok) && !EXAM_NEGATION_TOKENS.has(tok))
  );
  if (queryTokens.length === 0) return [];

  // Body-region constraint: if the provider named a region, require the leaf's section (or its
  // label) to overlap with the SAME equivalence class. "throat" → matches leaves under "Oral
  // Cavity" with labels like "Erythematous pharynx" because throat/pharynx/oral are clinically
  // synonymous. Without this gate, "Throat injected" can match "Eyes — non-injected" because
  // "injected" is a substring of "non-injected" once tokenized.
  const queryRegionClasses = new Set<number>();
  for (const t of queryTokens) {
    for (const cls of EXAM_BODY_REGION_OF.get(t) ?? []) queryRegionClasses.add(cls);
  }

  // The query is a positive assertion unless it itself contains negation tokens (e.g. provider
  // typed "no rash"). If query is positive, leaves whose label is itself a negation of one of
  // our query tokens (e.g. "non-injected" matches "injected" but they mean opposite things)
  // must be filtered out.
  const queryIsPositive = !queryTokens.some((t) => EXAM_NEGATION_TOKENS.has(t));
  // Symmetric query-side polarity: if the query contains a negator like "loss" / "decreased"
  // / "no", the provider is reporting an abnormal/missing form of a finding. Penalize
  // positive-form leaves that share the descriptor (e.g. "loss of light reflex" should NOT
  // pick "Right TM pearly with GOOD light reflex").
  const queryIsNegative = queryTokens.some((t) => EXAM_QUERY_NEGATORS.has(t));
  // Normalcy detection: "pulses 2 plus", "sensation intact", "neck supple" REPORT normal findings.
  // Such queries must not auto-chart the abnormal counterpart ("Diminished pulses") — abnormal
  // leaves are vetoed unless the query itself carries an abnormal descriptor.
  const queryIsNormalcy =
    !queryIsNegative && (queryTokens.some((t) => NORMALCY_TOKENS.has(t)) || NORMALCY_PATTERNS.test(intent.display));

  // Ordinal/anatomical-position guard: a query naming a specific digit/metatarsal ("4th metatarsal",
  // "2nd toe") must NOT match a leaf naming a DIFFERENT one ("5th metatarsal base", "3rd toe") — same
  // body part, different bone. Without this, "4th metatarsal tenderness" matched the charted "5th
  // metatarsal base" purely on shared words and was wrongly skipped as "already charted".
  const ordinalsIn = (s: string): Set<string> => {
    const out = new Set<string>();
    const words: Record<string, string> = { first: '1', second: '2', third: '3', fourth: '4', fifth: '5' };
    const lower = s.toLowerCase();
    for (const m of lower.matchAll(/\b([1-5])(?:st|nd|rd|th)\b/g)) out.add(m[1]);
    for (const [w, n] of Object.entries(words)) if (new RegExp(`\\b${w}\\b`).test(lower)) out.add(n);
    return out;
  };
  const queryOrdinals = ordinalsIn(intent.display);

  // For each label, build the indices of negation tokens so we can check whether a matched
  // token sits immediately after one (e.g. "no" + "rash" or "non" + "injected").
  const tokenizeWithNegationIndex = (s: string): { tokens: string[]; isNegated: boolean[] } => {
    const tokens = tokenize(s);
    const isNegated = tokens.map((_, i) => {
      // "non-injected" tokenizes to ["non", "injected"] — the "injected" at i is negated by
      // tokens[i-1] === "non". Same for "no rash" and "without exudate".
      const prev = i > 0 ? tokens[i - 1] : '';
      return EXAM_NEGATION_TOKENS.has(prev);
    });
    return { tokens, isNegated };
  };

  const scoreLeaf = (leaf: ExamLeaf): number => {
    const labelInfo = tokenizeWithNegationIndex(leaf.label);
    const sectionTokens = tokenize(leaf.section);

    // Polarity veto: the display negated this finding ("clear with no injection") but the leaf
    // ASSERTS it abnormally ("Conjunctival injection") — reject regardless of anatomy overlap.
    if (negatedTokens.size > 0 && leaf.normalAbnormal === 'abnormal') {
      for (let i = 0; i < labelInfo.tokens.length; i++) {
        const lt = labelInfo.tokens[i];
        if (labelInfo.isNegated[i]) continue; // the leaf itself negates it → not an assertion
        for (const nt of negatedTokens) {
          if (
            lt === nt ||
            (lt.length >= 4 && (lt.startsWith(nt) || nt.startsWith(lt))) ||
            (EXAM_DESCRIPTOR_CLASS_OF.get(lt) !== undefined &&
              EXAM_DESCRIPTOR_CLASS_OF.get(lt) === EXAM_DESCRIPTOR_CLASS_OF.get(nt))
          ) {
            return 0;
          }
        }
      }
    }
    const labelRegionClasses = new Set<number>();
    for (const t of labelInfo.tokens) {
      for (const cls of EXAM_BODY_REGION_OF.get(t) ?? []) labelRegionClasses.add(cls);
    }

    // A region-LABELED leaf ("External nose — Crepitus — Absent") is only matchable when the
    // query names a region in the same class — a regionless query ("healing crust, no crepitus")
    // must never land on someone else's anatomy just because a descriptor word matches.
    if (queryRegionClasses.size === 0 && labelRegionClasses.size > 0) return 0;

    // Body-region gate: if the provider named a region, require the leaf's section/label to
    // contain a token in the SAME equivalence class. No overlap → skip.
    if (queryRegionClasses.size > 0) {
      const leafTokens = [...labelInfo.tokens, ...sectionTokens];
      const leafInQueryRegion = leafTokens.some((t) =>
        [...(EXAM_BODY_REGION_OF.get(t) ?? [])].some((cls) => queryRegionClasses.has(cls))
      );
      if (!leafInQueryRegion) return 0;
      // Label-level region contradiction: the leaf's LABEL names a specific region outside every
      // query class ("Shoulder — …" for a shin query). The section-level gate can't catch this —
      // both leaves live under the generic "Extremities" section — so also reject on the label's
      // own region tokens when none of them intersects the query's classes.
      if (labelRegionClasses.size > 0 && ![...labelRegionClasses].some((cls) => queryRegionClasses.has(cls))) {
        return 0;
      }
      // Extremity sub-part contradiction: both sides name a concrete part but not the same one
      // ("shin" query vs "Hip — …" leaf) → clinically different anatomy, never a match.
      const querySpecificParts = specificExtremityTokens(queryTokens);
      if (querySpecificParts.length > 0) {
        const labelSpecificParts = specificExtremityTokens(labelInfo.tokens);
        if (labelSpecificParts.length > 0 && !extremityPartsOverlap(querySpecificParts, labelSpecificParts)) {
          return 0;
        }
      }
    }

    // Descriptor-class contradiction: the query names one finding quality ("lid EDEMA" — the
    // swelling class) and the leaf names a DIFFERENT one ("Lid ERYTHEMA") with none shared —
    // same anatomy, different finding. Only applies when BOTH sides carry classed descriptors.
    const descriptorClasses = (tokens: string[]): Set<number> => {
      const out = new Set<number>();
      for (const t of tokens) {
        const cls = EXAM_DESCRIPTOR_CLASS_OF.get(t);
        if (cls !== undefined) out.add(cls);
      }
      return out;
    };
    const queryDescriptors = descriptorClasses(queryTokens);
    const leafDescriptors = descriptorClasses(labelInfo.tokens);
    // An abnormal leaf may not ASSERT a quality the query didn't state: every descriptor class in
    // the leaf's label must appear in the query. This covers the descriptor-less query ("posterior
    // oropharynx without drip" ↛ "Erythematous pharynx") AND the compound-leaf case ("Left TM mild
    // erythema" — explicitly without bulging — must not chart "TM bulging, erythematous").
    if (leaf.normalAbnormal === 'abnormal' && leafDescriptors.size > 0) {
      if (![...leafDescriptors].every((c) => queryDescriptors.has(c))) {
        return 0;
      }
    }
    if (queryDescriptors.size > 0) {
      if (leafDescriptors.size > 0 && ![...queryDescriptors].some((c) => leafDescriptors.has(c))) {
        return 0;
      }
      // A positive ABNORMAL-descriptor query ("lid edema") must not fall through to a bare
      // normal leaf for the same anatomy ("Lids and lashes normal") — better to skip than to
      // chart the opposite of the finding. Negated queries are exempt (they SEEK the normal).
      if (leafDescriptors.size === 0 && leaf.normalAbnormal === 'normal' && queryIsPositive && !queryIsNegative) {
        return 0;
      }
    }
    // Normalcy veto: a query reporting a NORMAL finding ("pulses 2 plus") never matches an
    // abnormal leaf ("Diminished pulses") unless the query itself carries an abnormal descriptor.
    if (queryIsNormalcy && leaf.normalAbnormal === 'abnormal' && queryDescriptors.size === 0) {
      return 0;
    }
    // Structure-type contradiction (bone vs ligament vs tendon vs muscle).
    const queryStructures = structureClassesOf(queryTokens);
    if (queryStructures.size > 0) {
      const leafStructures = structureClassesOf(labelInfo.tokens);
      if (leafStructures.size > 0 && ![...queryStructures].some((c) => leafStructures.has(c))) {
        return 0;
      }
    }

    // Ordinal gate: the query names a specific digit/metatarsal but this leaf names a different
    // one → clinically distinct, not a match (e.g. "4th metatarsal" must not hit "5th metatarsal").
    if (queryOrdinals.size > 0) {
      const leafOrdinals = ordinalsIn(leaf.label);
      if (leafOrdinals.size > 0 && ![...queryOrdinals].some((o) => leafOrdinals.has(o))) return 0;
    }

    // Synonym match: a query token "matches" a leaf token if they're equal (after light stemming,
    // so "wheezes" matches "Wheezing") OR they're in the same EXAM_DESCRIPTOR_SYNONYMS class (so
    // "injected" matches "erythematous").
    const tokensMatch = (qt: string, lt: string): boolean => {
      if (stemEq(qt, lt)) return true;
      const qCls = EXAM_DESCRIPTOR_CLASS_OF.get(qt);
      if (qCls === undefined) return false;
      return EXAM_DESCRIPTOR_CLASS_OF.get(lt) === qCls;
    };

    // Query-side polarity check: if query is negative ("loss of light reflex"), the right leaf
    // is on the abnormal side OR has the same descriptor token negated in the label
    // ("No CVA tenderness" for "no CVA tenderness"). A normal-form leaf describing the intact
    // version of the feature (e.g. "pearly with GOOD light reflex") is a clinical mismatch.
    if (queryIsNegative && leaf.normalAbnormal === 'normal') {
      // Check whether the leaf already encodes the negation (a "No X" / "Without Y" normal leaf
      // legitimately matches a negative query). If not, treat as polarity mismatch and skip.
      const hasOwnNegation = labelInfo.isNegated.some(Boolean);
      if (!hasOwnNegation) return 0;
    }

    let total = 0;
    let anyTokenMatched = false;
    let anyDistinctiveMatched = false;
    let anyNonRegionDistinctive = false;
    let allMatched = true;
    for (const qt of queryTokens) {
      // Negation tokens inform polarity handling only — as CONTENT they produce nonsense matches
      // ("no" prefix-matching "not"/"Nose"), so they never score.
      if (EXAM_NEGATION_TOKENS.has(qt)) continue;
      // Generic descriptor tokens ("erythema", "tenderness", "swelling") score half and cannot
      // anchor a match alone — see GENERIC_FINDING_TOKENS.
      const qtGeneric = GENERIC_FINDING_TOKENS.has(qt);
      const fullScore = qtGeneric ? 2 : 4;
      let labelBest = 0;
      let labelBestNegated = false;
      for (let i = 0; i < labelInfo.tokens.length; i++) {
        const lt = labelInfo.tokens[i];
        if (tokensMatch(qt, lt)) {
          labelBest = fullScore;
          labelBestNegated = labelInfo.isNegated[i];
          break;
        }
        const prefixScore = qtGeneric ? 1 : 3;
        // Substring match requires BOTH tokens >=5 chars — "disc" must not hit "discharge",
        // while "oropharynx" should hit "pharynx" (containment either way).
        if (qt.length >= 5 && lt.length >= 5 && (lt.includes(qt) || qt.includes(lt)) && labelBest < prefixScore) {
          labelBest = prefixScore;
          labelBestNegated = labelInfo.isNegated[i];
        }
      }
      if (queryIsPositive && labelBest > 0 && labelBestNegated) {
        labelBest = -labelBest;
      }
      let sectionBest = 0;
      for (const st of sectionTokens) {
        if (tokensMatch(qt, st)) {
          sectionBest = 3;
          break;
        }
        if (st.startsWith(qt)) sectionBest = Math.max(sectionBest, 1);
      }
      const tokenScore = labelBest + sectionBest;
      if (tokenScore > 0) {
        anyTokenMatched = true;
        // Only a LABEL hit anchors: a section-title overlap ("chest" ∈ "Lungs, Chest Wall")
        // narrows the region but says nothing about the finding itself.
        if (!qtGeneric && labelBest > 0) {
          anyDistinctiveMatched = true;
          if (!EXAM_BODY_REGION_OF.has(qt)) anyNonRegionDistinctive = true;
        }
      } else {
        allMatched = false;
      }
      total += tokenScore;
    }
    if (allMatched && queryTokens.length > 1) total += 2;
    // Baseline score for in-region leaves with no specific token match — surface them as
    // candidates when the provider's descriptor words don't appear literally in any catalog
    // leaf ("throat injected" → all Oral Cavity findings) instead of saying "no match found".
    if (queryRegionClasses.size > 0 && !anyTokenMatched) total += 1;
    // Anchor requirement: with NO region context in the query AND no distinctive token matched,
    // the match hangs entirely on generic descriptors — that's how "shin erythema" landed on a
    // rhinoscopy leaf. Refuse rather than guess; the finding stays in the note's free text.
    if (queryRegionClasses.size === 0 && !anyDistinctiveMatched) return 0;
    // Descriptor-anchored abnormal match: a query that names a finding QUALITY ("erythematous
    // wheals…") may only take an abnormal leaf that shares that quality or matches a distinctive
    // token — otherwise region/positional overlap alone drags skin findings onto "Wheezing —
    // Location — Left upper"-style modal leaves.
    if (
      queryDescriptors.size > 0 &&
      leaf.normalAbnormal === 'abnormal' &&
      !anyDistinctiveMatched &&
      ![...queryDescriptors].some((c) => leafDescriptors.has(c))
    ) {
      return 0;
    }
    // A descriptor query anchored ONLY by anatomy ("Left TM mild erythema" hitting "TM with
    // fluid" on the 'TM' token) would chart a finding the provider never stated — the leaf must
    // either share a descriptor or match a non-anatomic distinctive token.
    if (
      queryDescriptors.size > 0 &&
      leaf.normalAbnormal === 'abnormal' &&
      leafDescriptors.size === 0 &&
      !anyNonRegionDistinctive
    ) {
      return 0;
    }
    return total;
  };

  const scored = leaves
    .map((leaf) => ({ leaf, score: scoreLeaf(leaf) }))
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score);
  return scored.slice(0, 12);
}

export function findExamLeafMatches(intent: AddExamFindingIntent, leaves: ExamLeaf[]): ExamLeaf[] {
  return findExamLeafMatchesScored(intent, leaves).map((s) => s.leaf);
}

// Choose which scored exam leaf to chart for an add-exam-finding. The planner's add-exam-finding is
// (almost) always an ABNORMAL finding, but an abnormal query ("oropharynx mildly injected") can rank
// a NORMAL leaf ("oropharynx clear … exudate") top on shared anatomy/negation words. So when the
// best match is normal and a comparable (>= half-score) abnormal exists, prefer the abnormal. The
// score gate keeps genuine normal-finding adds intact (a real "add normal canals" has no comparable
// abnormal). Order-independent: works whether the template's normal is still charted or was already
// removed by a preceding remove-exam-finding step.
export function preferredExamLeaf(
  scored: { leaf: ExamLeaf; score: number }[],
  opts?: { queryNegated?: boolean; queryNormal?: boolean }
): ExamLeaf {
  const top = scored[0];
  if (opts?.queryNegated || opts?.queryNormal) {
    // Negated dictation ("conjunctiva clear with NO injection") seeks the NORMAL side — preferring
    // a comparable abnormal here would chart the opposite of what was said.
    if (top.leaf.normalAbnormal === 'abnormal') {
      const normal = scored.find((s) => s.leaf.normalAbnormal === 'normal' && s.score >= top.score * 0.5);
      if (normal) return normal.leaf;
    }
    return top.leaf;
  }
  if (top.leaf.normalAbnormal === 'normal') {
    const abnormal = scored.find((s) => s.leaf.normalAbnormal === 'abnormal' && s.score >= top.score * 0.5);
    if (abnormal) return abnormal.leaf;
  }
  return top.leaf;
}

// Match a ROS finding intent (e.g. "Fever") to ROS catalog items by token overlap on the item
// label (and a weaker signal from the system name). The denies/reports state is on the intent, not
// matched here.
export function findRosLeafMatchesScored(
  intent: AddRosFindingIntent,
  leaves: RosLeaf[]
): { leaf: RosLeaf; score: number }[] {
  const queryStrings = [intent.display, ...(intent.searchTerms ?? [])];
  const queryTokens = new Set(
    queryStrings.flatMap((s) => tokenize(s)).filter((tok) => tok.length >= 3 && !ROS_QUERY_STOPWORDS.has(tok))
  );
  if (queryTokens.size === 0) return [];
  // The DISPLAY carries the dictated symptom; searchTerms are alternate phrasings. Coverage is
  // measured against the display so unmatched alternates don't disqualify a good label match.
  const displayTokens = tokenize(intent.display).filter((tok) => tok.length >= 3 && !ROS_QUERY_STOPWORDS.has(tok));
  return (
    leaves
      .map((leaf) => {
        // Strip the same modifier stopwords from the label so a match must land on the key symptom
        // noun, not a generic word like "loss"/"poor"/"changes".
        const labelTokens = tokenize(leaf.label).filter((t) => !ROS_QUERY_STOPWORDS.has(t));
        const systemTokens = tokenize(leaf.system);
        let score = 0;
        for (const qt of queryTokens) {
          // Generic sensation words ("pain", "tenderness") score half — they must ride along
          // with an anatomic/distinctive token, never carry the match alone.
          const full = GENERIC_FINDING_TOKENS.has(qt) ? 2 : 4;
          if (labelTokens.includes(qt)) score += full;
          else if (labelTokens.some((lt) => lt.length >= 4 && (lt.startsWith(qt) || qt.startsWith(lt))))
            score += full / 2;
          if (systemTokens.includes(qt)) score += 1;
        }
        // Coverage requirement: at least half the DISPLAY's meaningful tokens must land on the
        // label — one shared anatomic word ("leg" in "red streaks on leg" → "Leg swelling")
        // must not carry a match whose actual SYMPTOM went unmatched.
        let matched = 0;
        for (const qt of displayTokens) {
          if (
            labelTokens.includes(qt) ||
            labelTokens.some((lt) => lt.length >= 4 && (lt.startsWith(qt) || qt.startsWith(lt)))
          ) {
            matched++;
          }
        }
        if (displayTokens.length > 0 && matched * 2 <= displayTokens.length) return { leaf, score: 0 };
        return { leaf, score };
      })
      // Require a real symptom-token match (>=4) — a lone system-name overlap (score 1) isn't enough.
      .filter((s) => s.score >= 4)
      .sort((a, b) => b.score - a.score)
      .slice(0, 12)
  );
}

export function findRosLeafMatches(intent: AddRosFindingIntent, leaves: RosLeaf[]): RosLeaf[] {
  return findRosLeafMatchesScored(intent, leaves).map((s) => s.leaf);
}

// Decide whether a ranked candidate list is too close to call. Returns the cluster of near-top
// candidates (>= 2) to offer in a picker, or null when there's an obvious winner (the runner-up
// scores below AMBIGUITY_RATIO of the top) so the caller should just auto-pick. Used ONLY for
// interactive follow-up commands.
export const AMBIGUITY_RATIO = 0.75;
export function ambiguousCluster<T>(scored: { leaf: T; score: number }[]): T[] | null {
  if (scored.length < 2) return null;
  const top = scored[0].score;
  if (top <= 0) return null;
  if (scored[1].score / top < AMBIGUITY_RATIO) return null; // clear best match — auto-pick
  return scored
    .filter((s) => s.score / top >= AMBIGUITY_RATIO)
    .slice(0, 6)
    .map((s) => s.leaf);
}

// Build the list of removable exam items from the chart. Plain checkbox observations get one
// entry; observations with checked modal components get one entry per checked component so
// the picker reflects what the provider actually sees ticked on the chart.
export function buildExamRemoveItems(observations: ExamObservationDTO[] | undefined): ExamRemoveItem[] {
  const out: ExamRemoveItem[] = [];
  for (const o of observations ?? []) {
    if (!o.value || !o.resourceId) continue;
    const section = FIELD_TO_SECTION_LABEL[o.field] ?? 'Other';
    const checkedComponents = (o.components ?? []).filter((c) => c.value);
    if (checkedComponents.length === 0) {
      out.push({
        resourceId: o.resourceId,
        observationField: o.field,
        observationLabel: o.label,
        section,
        displayName: o.label ?? o.field,
      });
    } else {
      for (const c of checkedComponents) {
        const group = c.groupLabel ? `${c.groupLabel}: ` : '';
        out.push({
          resourceId: o.resourceId,
          observationField: o.field,
          observationLabel: o.label,
          section,
          componentCode: c.code,
          displayName: `${o.label ?? o.field} — ${group}${c.label}`,
        });
      }
    }
  }
  return out;
}

export function findExamRemoveMatchesScored(
  intent: RemoveExamFindingIntent,
  items: ExamRemoveItem[]
): { leaf: ExamRemoveItem; score: number }[] {
  const queryTokens = tokenize(intent.display).filter((tok) => tok.length >= 2 && !EXAM_QUERY_STOPWORDS.has(tok));
  if (queryTokens.length === 0) return [];
  return items
    .map((item) => {
      const haystack = tokenize(item.displayName);
      let total = 0;
      let allMatched = true;
      for (const qt of queryTokens) {
        let best = 0;
        for (const ht of haystack) {
          if (ht === qt) {
            best = 4;
            break;
          }
          if (ht.startsWith(qt)) best = Math.max(best, 2);
        }
        if (best === 0) allMatched = false;
        total += best;
      }
      if (allMatched && queryTokens.length > 1) total += 2;
      return { leaf: item, score: total };
    })
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 12);
}

// Match a "remove ROS finding" request against the CHECKED ROS observations on the chart (not the
// catalog). Parses the leading "Denies"/"Reports" verb to prefer the matching polarity, then scores
// each charted symptom by label-token overlap. Returns scored best-first so the caller can ask
// (picker) when the top matches are near-equal and only auto-remove on a clear winner.
export function findRosRemoveMatchesScored(
  display: string,
  searchTerms: string[],
  observations: ExamObservationDTO[] | undefined
): { leaf: ExamObservationDTO; score: number }[] {
  const checked = (observations ?? []).filter((o) => o.value === true && o.resourceId);
  if (checked.length === 0) return [];
  const verb = /^(denies|reports)\b[:\s-]*/i.exec(display.trim());
  const wantState: RosFindingState | null = verb
    ? verb[1].toLowerCase() === 'denies'
      ? RosFindingState.Denies
      : RosFindingState.Reports
    : null;
  const symptom = display.replace(/^(denies|reports)\b[:\s-]*/i, '').trim() || display;
  const queryTokens = Array.from(
    new Set(
      [symptom, ...(searchTerms ?? [])]
        .flatMap((s) => tokenize(s))
        .filter((tok) => tok.length >= 3 && !ROS_QUERY_STOPWORDS.has(tok))
    )
  );
  if (queryTokens.length === 0) return [];
  return checked
    .map((o) => {
      const labelTokens = tokenize(o.label ?? o.field).filter((t) => !ROS_QUERY_STOPWORDS.has(t));
      let score = 0;
      for (const qt of queryTokens) {
        if (labelTokens.includes(qt)) score += 4;
        else if (labelTokens.some((lt) => lt.startsWith(qt))) score += 2;
      }
      // Prefer the polarity the provider named ("Denies …") when both states are charted.
      if (wantState && getRosFindingStateFromKey(o.field) === wantState) score += 3;
      return { leaf: o, score };
    })
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score);
}

// Human label for a charted ROS observation, e.g. "Denies Eye pain" — its polarity (from the
// field suffix) plus the symptom label.
export function rosObsLabel(o: ExamObservationDTO): string {
  const state = getRosFindingStateFromKey(o.field);
  const verb = state === RosFindingState.Denies ? 'Denies' : state === RosFindingState.Reports ? 'Reports' : '';
  return `${verb}${verb ? ' ' : ''}${o.label ?? o.field}`;
}

export function findProcedureMatches(
  intent: AddProcedureIntent,
  quickPicks: ProcedureQuickPickData[]
): ProcedureQuickPickData[] {
  const queryTokens = tokenize(intent.display)
    .filter((tok) => tok.length >= 2)
    .filter((tok) => !PROCEDURE_QUERY_STOPWORDS.has(tok));
  if (queryTokens.length === 0) return [];
  return quickPicks.filter((qp) => {
    const nameTokens = tokenize(qp.name);
    return queryTokens.some((qt) => nameTokens.some((nt) => nt.startsWith(qt)));
  });
}

// Words a provider says when ordering a lab that aren't part of any catalog test name
// ("send a CBC out to the reference lab", "run a urinalysis in-house"). Stripped from the query
// so they don't pollute token matching against the catalog.
export const LAB_QUERY_STOPWORDS = new Set([
  'order',
  'send',
  'run',
  'a',
  'an',
  'the',
  'out',
  'in',
  'house',
  'office',
  'lab',
  'labs',
  'test',
  'tests',
  'do',
  'get',
  'please',
  'to',
  'and',
  'for',
  'reference',
  'panel',
  // "rapid" is a generic POC modifier shared by many in-house tests (Rapid Strep, Rapid RSV, Rapid
  // Influenza…). Dropping it focuses scoring on the SPECIFIC analyte so the ambiguity check clusters
  // by the real test (all flu variants tie) instead of letting "Rapid Influenza" outrank "Flu A".
  'rapid',
]);

// Score a lab intent (display + searchTerms) against a catalog of named items — the in-house
// ActivityDefinitions or the external orderable items. Prefix-token scoring like the template
// matcher: +20 per exact token, +5 per prefix token, a big bonus when the name equals the
// provider's phrase verbatim, and a length penalty so terse "CBC" outranks "CBC with
// differential" when the provider just said "CBC". Returns scored matches best-first (empty when
// nothing plausibly matches), in the { leaf, score } shape ambiguousCluster expects. Generic over
// item type so both lab dispatchers reuse it.
export function findLabCatalogMatchesScored<T>(
  display: string,
  searchTerms: string[],
  items: T[],
  getName: (item: T) => string
): { leaf: T; score: number }[] {
  const queryTokens = Array.from(
    new Set(
      [display, ...(searchTerms ?? [])]
        .flatMap((s) => tokenize(s))
        .filter((tok) => tok.length >= 2)
        .filter((tok) => !LAB_QUERY_STOPWORDS.has(tok))
    )
  );
  if (queryTokens.length === 0) return [];
  const queryDisplay = display.trim().toLowerCase();
  return items
    .map((item) => {
      const name = getName(item);
      const nameTokens = tokenize(name);
      const nameLower = name.trim().toLowerCase();
      let score = 0;
      for (const qt of queryTokens) {
        const exact = nameTokens.includes(qt);
        const prefix = !exact && nameTokens.some((nt) => nt.startsWith(qt));
        if (exact) score += 20;
        else if (prefix) score += 5;
      }
      if (nameLower === queryDisplay) score += 1000;
      const extraTokens = Math.max(0, nameTokens.length - queryTokens.length);
      score -= extraTokens * 2;
      return { leaf: item, score };
    })
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score);
}

// Build a ProcedureDTO from a quick pick the same way the regular Procedures page would when
// the provider picks a quick pick and clicks Save without editing: pre-fill from the quick
// pick's QUICK_PICK_APPLY_KEYS, default procedureDateTime/documentedDateTime to now, join
// the multi-value string[] fields (suppliesUsed, postInstructions) since the saved DTO is a
// single string for those.
export function procedureDtoFromQuickPick(
  qp: ProcedureQuickPickData,
  procedureTypeNameByCode: Map<string, string>
): ProcedureDTO {
  const joinList = (xs: (string | undefined)[] | undefined): string | undefined => {
    const cleaned = (xs ?? []).filter((x): x is string => !!x && x.trim().length > 0);
    return cleaned.length > 0 ? cleaned.join(', ') : undefined;
  };
  const now = new Date().toISOString();
  // Match the regular ProceduresNew flow: save the human-readable name (e.g. "Laceration
  // Repair") for procedureType so the saved DTO matches the dropdown label rather than the
  // kebab-case code. Fall back to the raw code if the value set hasn't loaded or lacks the entry.
  const procedureType = qp.procedureType
    ? procedureTypeNameByCode.get(qp.procedureType) ?? qp.procedureType
    : undefined;
  return {
    procedureType,
    cptCodes: qp.cptCodes,
    procedureDateTime: now,
    documentedDateTime: now,
    medicationUsed: qp.medicationUsed,
    bodySite: qp.bodySite,
    bodySide: qp.bodySide,
    technique: qp.technique,
    suppliesUsed: joinList(qp.suppliesUsed),
    procedureDetails: qp.procedureDetails,
    specimenSent: qp.specimenSent,
    complications: qp.complications,
    patientResponse: qp.patientResponse,
    postInstructions: joinList(qp.postInstructions),
    timeSpent: qp.timeSpent,
    documentedBy: qp.documentedBy,
  };
}

// Canonical ProcedureDTO field a free-text field name maps to. The agent prompt asks the LLM
// to use canonical names, but providers may also paraphrase, so accept common synonyms too.
export const PROCEDURE_FIELD_ALIASES: Record<string, keyof ProcedureDTO> = {
  bodysite: 'bodySite',
  site: 'bodySite',
  location: 'bodySite',
  bodyside: 'bodySide',
  side: 'bodySide',
  laterality: 'bodySide',
  technique: 'technique',
  suppliesused: 'suppliesUsed',
  supplies: 'suppliesUsed',
  instruments: 'suppliesUsed',
  proceduredetails: 'procedureDetails',
  details: 'procedureDetails',
  medicationused: 'medicationUsed',
  medication: 'medicationUsed',
  anesthesia: 'medicationUsed',
  complications: 'complications',
  patientresponse: 'patientResponse',
  response: 'patientResponse',
  postinstructions: 'postInstructions',
  'post-instructions': 'postInstructions',
  postprocedureinstructions: 'postInstructions',
  timespent: 'timeSpent',
  time: 'timeSpent',
  performertype: 'performerType',
  performer: 'performerType',
  documentedby: 'documentedBy',
  specimensent: 'specimenSent',
  specimen: 'specimenSent',
  consentobtained: 'consentObtained',
  consent: 'consentObtained',
};

export function resolveProcedureField(rawField: string): keyof ProcedureDTO | undefined {
  return PROCEDURE_FIELD_ALIASES[rawField.toLowerCase().replace(/[^a-z]/g, '')];
}

// Choose the procedure the update intent targets. If only one exists, that's it. Otherwise
// fuzzy-match by procedureType + first CPT display against the (optional) procedureMatch hint.
export function findProceduresToUpdate(intent: UpdateProcedureIntent, procedures: ProcedureDTO[]): ProcedureDTO[] {
  if (procedures.length === 0) return [];
  if (procedures.length === 1) return procedures;
  if (!intent.procedureMatch) return procedures;
  const qTokens = tokenize(intent.procedureMatch).filter((t) => t.length >= 2);
  if (qTokens.length === 0) return procedures;
  const matched = procedures.filter((p) => {
    const haystack = `${p.procedureType ?? ''} ${(p.cptCodes ?? []).map((c) => c.display ?? '').join(' ')}`;
    const haystackTokens = tokenize(haystack);
    return qTokens.some((qt) => haystackTokens.some((ht) => ht.startsWith(qt)));
  });
  return matched.length > 0 ? matched : procedures;
}

// Apply { field, value } updates to a clone of the procedure. Field names are normalized via
// PROCEDURE_FIELD_ALIASES, "technique" splits CSV into array, boolean fields parse true/false.
// Returns { updated, applied, skipped } so the conversation can summarize what changed.
// Coerce a free-text value to a canonical code from a value-set map. The LLM might emit
// the code ("sterile"), the display ("Sterile"), or some near-match ("sterile technique").
// Returns the canonical code on match, or undefined.
export function coerceToAllowedCode(value: string, allowed: Map<string, string>): string | undefined {
  if (allowed.size === 0) return undefined;
  const v = value.toLowerCase().trim();
  // Exact code match.
  for (const code of allowed.keys()) {
    if (code.toLowerCase() === v) return code;
  }
  // Exact display match.
  for (const [code, display] of allowed) {
    if (display.toLowerCase() === v) return code;
  }
  // Prefix-or-substring on display — "sterile" → "Sterile technique".
  for (const [code, display] of allowed) {
    const d = display.toLowerCase();
    if (d.startsWith(v) || v.startsWith(d) || d.includes(v)) return code;
  }
  return undefined;
}

// Free-text fields that don't have a constrained value-set; pass through whatever the LLM says.
export const FREE_TEXT_PROCEDURE_FIELDS = new Set<keyof ProcedureDTO>([
  'procedureDetails',
  'documentedBy',
  'performerType',
]);

// Values that mean "clear this field" rather than a real value. Deliberately excludes "none" and
// "not applicable" — those are legitimate codes in some procedure value sets (e.g. Complications:
// "None", Side: "Not Applicable"), so clearing is limited to unambiguous words + the empty string.
export const PROCEDURE_CLEAR_VALUES = new Set([
  '',
  'blank',
  'clear',
  'empty',
  'unset',
  'remove',
  'delete',
  'erase',
  'none/blank',
  'no value',
  'nothing',
]);
export function isProcedureClearValue(value: string): boolean {
  return PROCEDURE_CLEAR_VALUES.has(value.toLowerCase().trim());
}

export function applyProcedureUpdates(
  procedure: ProcedureDTO,
  updates: { field: string; value: string }[],
  allowedByField: Map<keyof ProcedureDTO, Map<string, string>>
): { updated: ProcedureDTO; applied: { field: keyof ProcedureDTO; value: unknown }[]; skipped: string[] } {
  const next: ProcedureDTO = { ...procedure };
  const applied: { field: keyof ProcedureDTO; value: unknown }[] = [];
  const skipped: string[] = [];
  const summarizeAllowed = (allowed: Map<string, string>): string => {
    const entries = Array.from(allowed.values()).slice(0, 8);
    const more = allowed.size > entries.length ? `, … (${allowed.size - entries.length} more)` : '';
    return entries.join(', ') + more;
  };
  for (const u of updates) {
    const field = resolveProcedureField(u.field);
    if (!field) {
      skipped.push(u.field);
      continue;
    }
    // Clear request — unset the field. createProcedureServiceRequest builds a PUT (full replace)
    // and drops any extension whose value is null/undefined, so undefined here clears it server-side.
    if (isProcedureClearValue(u.value)) {
      (next as Record<string, unknown>)[field] = undefined;
      applied.push({ field, value: undefined });
      continue;
    }
    if (field === 'specimenSent' || field === 'consentObtained') {
      const v = u.value.toLowerCase().trim();
      const bool =
        v === 'true' || v === 'yes' || v === 'y' ? true : v === 'false' || v === 'no' || v === 'n' ? false : undefined;
      if (bool === undefined) {
        skipped.push(`${u.field} (expected true/false, got "${u.value}")`);
        continue;
      }
      next[field] = bool;
      applied.push({ field, value: bool });
    } else if (field === 'technique') {
      // technique is an array. Split CSV/semicolon, validate each token against the value
      // set, and keep only the valid ones. Empty result means "no update".
      const allowed = allowedByField.get('technique');
      const raw = u.value
        .split(/[,;]+/)
        .map((s) => s.trim())
        .filter(Boolean);
      const validCodes: string[] = [];
      const invalid: string[] = [];
      for (const r of raw) {
        const code = allowed ? coerceToAllowedCode(r, allowed) : r;
        if (code) validCodes.push(code);
        else invalid.push(r);
      }
      if (validCodes.length === 0) {
        skipped.push(`technique="${u.value}"${allowed ? ` (must be one of: ${summarizeAllowed(allowed)})` : ''}`);
        continue;
      }
      next.technique = validCodes;
      applied.push({ field, value: validCodes });
      if (invalid.length > 0) skipped.push(`technique values not recognized: ${invalid.join(', ')}`);
    } else if (FREE_TEXT_PROCEDURE_FIELDS.has(field)) {
      // Free text — pass through.
      (next as Record<string, unknown>)[field] = u.value;
      applied.push({ field, value: u.value });
    } else {
      // Single-value enum fields — validate against the value set if one is loaded.
      const allowed = allowedByField.get(field);
      if (allowed && allowed.size > 0) {
        const code = coerceToAllowedCode(u.value, allowed);
        if (!code) {
          skipped.push(`${u.field}="${u.value}" (must be one of: ${summarizeAllowed(allowed)})`);
          continue;
        }
        (next as Record<string, unknown>)[field] = code;
        applied.push({ field, value: code });
      } else {
        // No value set loaded yet (or none exists for this field) — pass through.
        (next as Record<string, unknown>)[field] = u.value;
        applied.push({ field, value: u.value });
      }
    }
  }
  return { updated: next, applied, skipped };
}

// A single deterministic consistency warning about the charted note. Rule-based (no LLM), so it
// never hallucinates — every warning corresponds to a concrete contradiction/duplicate/omission the
// provider can verify directly. Surfaced in an amber panel above the note.
export interface ChartWarning {
  id: string;
  text: string;
}

// Deterministic lint over the charted note. Intentionally conservative: only flags things that are
// almost always genuine mistakes (exact-duplicate codes, contradictory ROS polarity, primary-dx
// sanity, a diagnosed encounter with no E&M). No fuzzy/laterality guessing — those would produce
// false positives that train the provider to ignore the panel.
export function computeChartWarnings(data: GetChartDataResponse): ChartWarning[] {
  const warnings: ChartWarning[] = [];
  const norm = (s?: string): string => (s ?? '').toLowerCase().replace(/\s+/g, ' ').trim();
  const dx = data.diagnosis ?? [];

  // Duplicate diagnoses — same ICD code, or same display when no code.
  const dxCounts = new Map<string, number>();
  for (const d of dx) {
    const key = (d.code && d.code.trim()) || norm(d.display);
    if (key) dxCounts.set(key, (dxCounts.get(key) ?? 0) + 1);
  }
  for (const [key, n] of dxCounts) {
    if (n > 1) {
      const label = dx.find((d) => ((d.code && d.code.trim()) || norm(d.display)) === key)?.display ?? key;
      warnings.push({ id: `dup-dx-${key}`, text: `Diagnosis “${label}” is charted ${n} times.` });
    }
  }

  // Primary-diagnosis sanity.
  const primaries = dx.filter((d) => d.isPrimary);
  if (dx.length > 0 && primaries.length === 0) {
    warnings.push({ id: 'no-primary-dx', text: 'No primary diagnosis is set.' });
  }
  if (primaries.length > 1) {
    warnings.push({
      id: 'multi-primary-dx',
      text: `${primaries.length} diagnoses are marked primary — only one should be.`,
    });
  }

  // Duplicate CPT codes.
  const cpt = data.cptCodes ?? [];
  const cptCounts = new Map<string, number>();
  for (const c of cpt) {
    const k = (c.code ?? '').trim();
    if (k) cptCounts.set(k, (cptCounts.get(k) ?? 0) + 1);
  }
  for (const [k, n] of cptCounts) {
    if (n > 1) {
      const disp = cpt.find((c) => (c.code ?? '').trim() === k)?.display;
      warnings.push({ id: `dup-cpt-${k}`, text: `CPT ${k}${disp ? ` (${disp})` : ''} is charted ${n} times.` });
    }
  }

  // Contradictory ROS — the same symptom recorded as BOTH reported and denied.
  const rosStates = new Map<string, { states: Set<string>; label: string }>();
  for (const o of data.rosObservations ?? []) {
    if (!o.field || o.value === false) continue;
    const m = o.field.match(/-(reports|denies)$/);
    if (!m) continue;
    const base = o.field.replace(/-(reports|denies)$/, '');
    const entry = rosStates.get(base) ?? { states: new Set<string>(), label: o.label ?? base };
    entry.states.add(m[1]);
    rosStates.set(base, entry);
  }
  for (const [base, e] of rosStates) {
    if (e.states.size > 1) {
      warnings.push({ id: `ros-contra-${base}`, text: `ROS lists “${e.label}” as both reported and denied.` });
    }
  }

  // Completeness nudge: a diagnosed encounter with no E&M level.
  if (dx.length > 0 && !data.emCode) {
    warnings.push({ id: 'no-em', text: 'Diagnoses are charted but no E&M level is set.' });
  }

  return warnings;
}

// Normalize a string for loose comparison: lowercase, strip whitespace and unit punctuation that
// commonly varies between sources (e.g. "400 mg/5 mL" vs "400mg/5ml").
export function normForMatch(s: string): string {
  return s.toLowerCase().replace(/\s+/g, '').replace(/\./g, '');
}

// Canonical, order- and separator-independent key for a medication strength. A COMBINATION product
// is written differently by the planner and the eRx catalog: the planner dictates the strength in
// the spoken order with a unit per ingredient ("325 mg / 5 mg" for acetaminophen/hydrocodone), while
// the catalog writes "<a>-<b> MG" in its own ingredient order with ONE shared trailing unit
// ("5-325 MG"). Pure string equality (normForMatch) therefore never matches the correct product, so
// the dose-safety gate falsely sees zero strength matches and forces a picker. Extract each numeric
// magnitude + unit, back-fill a shared trailing unit onto a leading unitless number, and sort — so
// "325 mg / 5 mg" and "5-325 MG" both collapse to "325mg|5mg". Single-ingredient strengths are
// unaffected ("5 mg" → "5mg"), so the gate still refuses to match 5 mg against 7.5 mg.
export function strengthKey(s: string): string {
  // Normalize before tokenizing:
  //  - spelled-out units → abbreviations ("15 milligrams" must equal "15 MG")
  //  - percent → its mg-per-g/ml equivalent ("0.5 %" ≡ "5 MG/GM" for topicals/ophthalmics;
  //    denominator units without their own number vanish in tokenization, so both sides reduce
  //    to the same "<n>mg" token)
  const normalized = s
    .toLowerCase()
    .replace(/\bmicrograms?\b/g, 'mcg')
    .replace(/\bmilligrams?\b/g, 'mg')
    .replace(/\bgrams?\b/g, 'g')
    .replace(/\bmillilit(?:er|re)s?\b/g, 'ml')
    .replace(/\bpercent\b/g, '%')
    .replace(/(\d+(?:\.\d+)?)\s*%/g, (_m, n) => `${parseFloat(n) * 10} mg`);
  const tokens: Array<{ num: number; unit: string }> = [];
  for (const m of normalized.matchAll(/(\d+(?:\.\d+)?)\s*(mcg|mg|g|ml|units?)?/g)) {
    tokens.push({ num: parseFloat(m[1]), unit: m[2] ?? '' });
  }
  if (tokens.length === 0) return normForMatch(s);
  let carried = '';
  for (let i = tokens.length - 1; i >= 0; i--) {
    if (tokens[i].unit) carried = tokens[i].unit;
    else tokens[i].unit = carried;
  }
  return tokens
    .map((t) => `${t.num}${t.unit}`)
    .sort()
    .join('|');
}

// Dose-vs-concentration compatibility: a dictated DOSE ("15 mg" of Orapred) is compatible with a
// catalog CONCENTRATION that contains it ("15 MG/5ML") — the pharmacy dispenses the dose from the
// concentration. Compatible ⇔ every token of the dictated key appears in the catalog key.
// (Exact-equality callers keep using strengthKey === strengthKey; the med picker gate uses this.)
export function strengthCompatible(dictated: string, catalog: string): boolean {
  const dk = strengthKey(dictated);
  const ck = strengthKey(catalog);
  if (dk === ck) return true;
  const dTokens = dk.split('|');
  const cTokens = new Set(ck.split('|'));
  return dTokens.every((t) => cTokens.has(t));
}

// Resolve a dictated imaging study ("3-view right ankle X-ray") to a catalog RadiologyStudy by
// anatomy-keyword overlap — view count and laterality vary, so match on the body-part words.
export type RadiologyStudy = (typeof radiologyStudiesConfig)[number];
export function matchRadiologyStudy(display: string, searchTerms: string[]): RadiologyStudy | undefined {
  const hay = `${display} ${searchTerms.join(' ')}`.toLowerCase();
  // Modality guard: the study catalog is X-ray only. A dictated ULTRASOUND/CT/MRI order must not
  // resolve to an X-ray of the same body part ("venous duplex ultrasound" once charted CPT 73590
  // "X-ray of lower leg") — no match means the provider orders it through the regular flow, and
  // the planner surfaces a provider-note instead of a wrong study.
  if (
    /\b(?:ultrasound|duplex|doppler|sonogram|sonography|echocardiogram|echocardiography|cat scan|mri|magnetic resonance|nuclear)\b|\bus\b|\bct\b|\bv\/q\b/i.test(
      hay
    )
  ) {
    return undefined;
  }
  const STOP = new Set(['xray', 'ray', 'view', 'views', 'minimum', 'the', 'and', 'for']);
  let best: { study: RadiologyStudy; score: number } | undefined;
  for (const study of radiologyStudiesConfig) {
    if (!study.display) continue;
    const words = study.display
      .toLowerCase()
      .replace(/[^a-z ]/g, ' ')
      .split(/\s+/)
      .filter((w) => w.length > 2 && !STOP.has(w));
    const score = words.filter((w) => hay.includes(w)).length;
    if (score > 0 && (!best || score > best.score)) best = { study, score };
  }
  return best?.study;
}

// Indication/site/population qualifier words that OTC product LINES carry in their NAMES
// ("CLOTRIMAZOLE ATHLETES FOOT CREAM", "MICONAZOLE 3 VAGINAL", "CHILDREN'S IBUPROFEN"). Right
// molecule + wrong qualifier is a wrong product: a dictated clotrimazole cream for VAGINAL
// candidiasis once auto-charted "Clotrimazole Athletes Foot Topical Cream". Each entry maps the
// name token to the evidence stems that justify it (substring-matched against the query +
// narrative context; the token itself is always its own first stem). This is a vocabulary of
// qualifier WORDS, not a product blocklist — a qualified product stays fully rankable whenever
// the narrative supports its qualifier. Deliberately EXCLUDES bare route words the catalog
// attaches descriptively to most products ("Oral", "Topical"): those appear on the CORRECT
// product too, so flagging them would demote it below a route-less capsule/tablet.
export const MED_QUALIFIER_EVIDENCE: Record<string, string[]> = {
  athlete: ['athlete', 'pedis'],
  athletes: ['athlete', 'pedis'],
  af: ['af', 'athlete', 'pedis'], // OTC catalogs abbreviate athlete's-foot ("Lotrimin AF", "Clotrimazole AF")
  foot: ['foot', 'feet', 'pedis', 'toe', 'plantar'],
  jock: ['jock', 'cruris', 'groin'],
  itch: ['itch', 'prurit'],
  ringworm: ['ringworm', 'corporis', 'tinea'],
  vaginal: ['vagin', 'vulv', 'yeast'],
  diaper: ['diaper'],
  otic: ['otic', 'ear', 'otitis'],
  ear: ['ear', 'otic', 'otitis'],
  ophthalmic: ['ophthalm', 'eye', 'ocular', 'conjunctiv'],
  eye: ['eye', 'ophthalm', 'ocular', 'conjunctiv', 'stye'],
  nasal: ['nasal', 'nose', 'nares', 'rhin', 'sinus'],
  rectal: ['rectal', 'hemorrhoid', 'anal', 'anus'],
  hemorrhoidal: ['hemorrhoid', 'rectal', 'anal'],
  scalp: ['scalp', 'dandruff', 'capitis'],
  children: ['child', 'pediatric'],
  infant: ['infant', 'baby', 'newborn'],
  infants: ['infant', 'baby', 'newborn'],
  baby: ['baby', 'infant', 'newborn'],
};

// The qualifier words in a candidate product name that the available evidence (searched drug term
// + narrative context) does NOT support. Tokens outside MED_QUALIFIER_EVIDENCE never count —
// brand/salt/form words are the fuzzy ranker's job, not this guard's.
export function unsupportedMedQualifiers(name: string, evidence: string): string[] {
  const hay = evidence.toLowerCase();
  // A short stem like 'af' would substring-match inside unrelated words ("AFfected", "AFter") —
  // credit stems that short only when they appear as a standalone evidence token.
  const hayTokens = new Set(hay.split(/[^a-z0-9]+/));
  const out: string[] = [];
  for (const tok of name.toLowerCase().split(/[^a-z0-9]+/)) {
    const stems = MED_QUALIFIER_EVIDENCE[tok];
    if (stems && !stems.some((s) => (s.length <= 2 ? hayTokens.has(s) : hay.includes(s)))) out.push(tok);
  }
  return out;
}

// Rank eRx medication results when the planner extracted a strength and/or doseForm from the
// narrative. eRx's name search returns results in its own order which interleaves combination
// products and unrelated strengths; this stable sort pushes the requested strength/form to the
// top without dropping anything. Returns a new array; original order is the tie-breaker.
//
// Qualifier tier (mirrors the ICD history/status gate: a qualifier the provider never dictated
// must not carry a match): a candidate whose NAME has an indication/site/population qualifier
// UNSUPPORTED by the query + narrative evidence never outranks a candidate whose qualifiers are
// all supported (or that has none). Within a tier the existing strength/form scoring decides.
// When EVERY candidate is unsupported the tier is uniform and ranking degrades to exactly the
// old behavior — the guard reorders, it never makes a previously-successful match fail.
// `sourceText` is the planner step's provenance phrase (present at plan dispatch; absent for
// single-shot agent intents, which then guard on display/searchTerms alone).
export function rankMedicationResults(
  results: SearchResult[],
  intent: Extract<EasyChartAgentIntent, { kind: 'add-medication' }> & { sourceText?: string }
): SearchResult[] {
  const wantStrength = intent.strength ? normForMatch(intent.strength) : '';
  const wantStrengthKey = intent.strength ? strengthKey(intent.strength) : '';
  // The model sometimes emits the dosage form under `unit` ("tablet") instead of `doseForm`;
  // treat them interchangeably so combination kits / wrong forms still get out-ranked.
  const formRaw = intent.doseForm ?? intent.unit;
  const wantForm = formRaw ? formRaw.toLowerCase().trim() : '';
  // Single-ingredient request: provider typed "amoxicillin" (no hyphen, no &, no "/"). eRx
  // returns combination products (Amoxicillin-Pot Clavulanate, Amox & Vonoprazan) that
  // SHOULDN'T outrank the plain ingredient — penalize those when the request looks single-ing.
  const queryName = intent.searchTerms[0] ?? intent.display;
  const isSingleIngredientQuery = !/[-&/]/.test(queryName);
  // All evidence available at match time: what was searched (so a qualifier the provider actually
  // dictated — "athletes foot cream" — never penalizes) plus the narrative phrase behind the step.
  const qualifierEvidence = [
    intent.display,
    ...(Array.isArray(intent.searchTerms) ? intent.searchTerms : []),
    intent.strength ?? '',
    intent.doseForm ?? '',
    intent.unit ?? '',
    intent.sourceText ?? '',
  ].join(' ');
  const flagged = results.map((r) => unsupportedMedQualifiers(r.name ?? '', qualifierEvidence).length > 0);
  // The tier only changes an order when supported and unsupported candidates are MIXED.
  const qualifierTierMatters = flagged.some(Boolean) && !flagged.every(Boolean);
  if (!wantStrength && !wantForm && !isSingleIngredientQuery && !qualifierTierMatters) return results;
  const scored = results.map((r, idx) => {
    const nameNorm = normForMatch(r.name);
    const strengthNorm = r.strength ? normForMatch(r.strength) : '';
    const haystack = `${nameNorm} ${strengthNorm}`;
    let score = 0;
    if (wantStrength) {
      // Combination-aware exact match first (order/separator-independent), then substring fallback.
      if (r.strength && wantStrengthKey && strengthKey(r.strength) === wantStrengthKey) score += 10;
      else if (strengthNorm && strengthNorm === wantStrength) score += 10;
      else if (haystack.includes(wantStrength)) score += 6;
    }
    if (wantForm) {
      // doseForm is typically a single word — compare case-insensitively as a whole token.
      if (r.name.toLowerCase().includes(wantForm)) score += 3;
      if (r.strength && r.strength.toLowerCase().includes(wantForm)) score += 3;
    }
    if (isSingleIngredientQuery && /[-&]/.test(r.name)) score -= 5;
    return { r, score, idx, unsupported: flagged[idx] ? 1 : 0 };
  });
  // Tier before score: an unsupported-qualifier product must never beat a supported/neutral one,
  // no matter how well its strength/form matches.
  scored.sort((a, b) => a.unsupported - b.unsupported || b.score - a.score || a.idx - b.idx);
  return scored.map((s) => s.r);
}

// Salt/ester/hydrate words that appear in drug product names but are NOT the allergen itself.
// A query like "sulfa" substring-matches the salt word "sulfate", so eRx surfaces unrelated drugs
// (e.g. "Amikacin Sulfate Liposome" — an aminoglycoside, not a sulfonamide). We must never CREDIT a
// match that lands only inside one of these words.
export const ALLERGEN_SALT_WORDS = new Set([
  'sulfate',
  'sulfite',
  'phosphate',
  'succinate',
  'acetate',
  'citrate',
  'tartrate',
  'bitartrate',
  'nitrate',
  'besylate',
  'mesylate',
  'tosylate',
  'fumarate',
  'maleate',
  'malate',
  'gluconate',
  'carbonate',
  'bicarbonate',
  'hydrochloride',
  'hydrobromide',
  'bromide',
  'chloride',
  'sodium',
  'potassium',
  'calcium',
  'hydrate',
  'dihydrate',
  'monohydrate',
  'liposome',
]);

// Rank eRx allergen results so a class/ingredient match wins over an incidental salt-word collision.
// eRx's allergen search is a plain substring match with no clinical ranking, and the client
// auto-picks the top hit — so "sulfa" landing on "...Sulfate" charts a wrong (and unsafe) allergy.
// Score each result by how its NAME tokens match the query terms, never crediting a salt word, and
// prefer concise class allergens ("Sulfonamide Antibiotics") over long branded products. Returns a
// new array; original eRx order is the tie-breaker, and nothing is dropped.
export function rankAllergenResults(
  results: SearchResult[],
  intent: Extract<EasyChartAgentIntent, { kind: 'add-allergy' }>
): SearchResult[] {
  const queries = [intent.display, ...(intent.searchTerms ?? [])].map((q) => q.toLowerCase().trim()).filter(Boolean);
  if (queries.length === 0) return results;
  const scored = results.map((r, idx) => {
    const tokens = (r.name ?? '')
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter(Boolean);
    let score = 0;
    for (const q of queries) {
      for (const tok of tokens) {
        if (ALLERGEN_SALT_WORDS.has(tok)) continue; // a salt word never counts as the allergen
        if (tok === q) score += 12;
        else if (tok.startsWith(q)) score += 8; // "sulfa" → "sulfamethoxazole" / "sulfonamide"
        else if (tok.includes(q)) score += 3;
      }
    }
    // Tie-break toward concise class/ingredient names over long multi-word product names.
    score -= Math.min(tokens.length, 6) * 0.5;
    return { r, score, idx };
  });
  scored.sort((a, b) => b.score - a.score || a.idx - b.idx);
  return scored.map((s) => s.r);
}

export async function runIntentSearch(
  intent: AddSearchIntent,
  oystehr: Oystehr | undefined,
  oystehrZambda: Oystehr | undefined
): Promise<SearchResult[]> {
  // For ICD-10 add intents: if the narrative supplied an explicit code, look it up first by code.
  // The searchIcd10Codes scorer treats exact-code matches as the top result. If that yields an
  // exact code match, return JUST that result — downstream dispatch then auto-picks (results=1)
  // instead of showing a picker the provider has to click through.
  const intentCode =
    (intent.kind === 'add-diagnosis' || intent.kind === 'add-condition') && 'code' in intent
      ? (intent as { code?: string }).code
      : undefined;
  if (intentCode && oystehrZambda) {
    const codeResp = await oystehrZambda.terminology.searchIcd10({
      query: intentCode,
      searchType: 'all',
      includeSynonyms: true,
      specialty: ['urgent-care'],
      limit: 100,
    });
    const exact = (codeResp.codes || []).find((c) => c.code.toLowerCase() === intentCode.toLowerCase());
    if (exact) {
      return [{ name: exact.display, code: exact.code }];
    }
    // Code not found exactly — fall through to display-based search.
  }
  // The eRx (searchMedications / searchAllergens) and ICD searches reject a query shorter than 3
  // characters ("'name' must be at least 3 characters long"), which would throw and fail the whole
  // step. Drop sub-3-char terms; fall back to the display, and if even that's too short, return no
  // matches gracefully (the dispatcher then shows a clean no-match instead of "Something went wrong").
  const rawTerms = intent.searchTerms.length > 0 ? intent.searchTerms : [intent.display];
  const terms = rawTerms.map((t) => t?.trim()).filter((t): t is string => !!t && t.length >= 3);
  if (terms.length === 0) {
    const disp = intent.display?.trim() ?? '';
    if (disp.length >= 3) terms.push(disp);
    else return [];
  }
  const all: SearchResult[] = [];
  const seen = new Set<string>();
  const perTerm = Math.max(5, Math.floor(15 / terms.length));

  for (const term of terms) {
    let results: SearchResult[] = [];
    if ((intent.kind === 'add-condition' || intent.kind === 'add-diagnosis') && oystehrZambda) {
      const response = await oystehrZambda.terminology.searchIcd10({
        query: term,
        searchType: 'all',
        includeSynonyms: true,
        specialty: ['urgent-care'],
        limit: 100,
      });
      results = (response.codes || []).map((c) => ({ name: c.display, code: c.code }));
    } else if (intent.kind === 'add-medication' && oystehr) {
      results = (await oystehr.erx.searchMedications({ name: term })) as SearchResult[];
    } else if (intent.kind === 'add-allergy' && oystehr) {
      results = (await oystehr.erx.searchAllergens({ name: term })) as SearchResult[];
    } else if (intent.kind === 'add-surgical-history') {
      results = filterStaticOptions(SURGICAL_HISTORY_OPTIONS, term);
    } else if (intent.kind === 'add-hospitalization') {
      results = filterStaticOptions(HospitalizationOptions, term);
    }
    let added = 0;
    for (const r of results) {
      if (added >= perTerm) break;
      const key = (r.code ?? r.name).toLowerCase();
      if (!seen.has(key)) {
        seen.add(key);
        all.push(r);
        added++;
      }
    }
  }
  if (intent.kind === 'add-medication') return rankMedicationResults(all, intent);
  if (intent.kind === 'add-allergy') return rankAllergenResults(all, intent);
  return all;
}

// The human-readable label for a charted item, per its field (used for the correction popover's
// seed query and the needs-review provenance).
export function chartedItemDisplay(field: AiField, item: { name?: string; display?: string; code?: string }): string {
  if (field === 'allergies' || field === 'medications') return item.name ?? '';
  return item.display ?? item.code ?? '';
}

export function buildIntentPayload(
  encounterId: string,
  intent: AddSearchIntent,
  result: SearchResult,
  // Medications: the AI never confirms the dose, so default to "patient couldn't confirm dosage"
  // (matches the regular-note AI suggestion default). The correction popover can override it.
  dosageUnconfirmed = true
): SaveChartDataRequest | null {
  if (intent.kind === 'add-diagnosis' && result.code) {
    return { encounterId, diagnosis: [{ code: result.code, display: result.name, isPrimary: intent.isPrimary }] };
  }
  if (intent.kind === 'add-condition' && result.code) {
    return {
      encounterId,
      conditions: [{ code: result.code, display: result.name, current: true } satisfies MedicalConditionDTO],
    };
  }
  if (intent.kind === 'add-allergy') {
    return {
      encounterId,
      allergies: [
        {
          name: result.name,
          id: result.id != null ? String(result.id) : undefined,
          current: true,
        } satisfies AllergyDTO,
      ],
    };
  }
  if (intent.kind === 'add-medication') {
    const strength = result.strength;
    const nameHasStrength = strength && result.name.toLowerCase().includes(strength.toLowerCase());
    const name = nameHasStrength || !strength ? result.name : `${result.name} (${strength})`;
    return {
      encounterId,
      medications: [
        {
          name,
          id: result.id != null ? String(result.id) : undefined,
          type: 'scheduled',
          status: 'active',
          intakeInfo: { patientCouldNotConfirmDosage: dosageUnconfirmed || undefined },
        } satisfies MedicationDTO,
      ],
    };
  }
  if (intent.kind === 'add-surgical-history' && result.code) {
    return { encounterId, surgicalHistory: [{ code: result.code, display: result.name } satisfies CPTCodeDTO] };
  }
  if (intent.kind === 'add-hospitalization' && result.code) {
    return { encounterId, episodeOfCare: [{ code: result.code, display: result.name } satisfies HospitalizationDTO] };
  }
  return null;
}

// Clinically meaningful dose/duration tokens in a string, normalized for comparison and mapped back
// to the original substring for display (e.g. "40 mg" → key "40mg"). Used to spot dose/duration the
// provider dictated that didn't make it into an AI-written free-text field.
export function doseTokens(s: string): Map<string, string> {
  const out = new Map<string, string>();
  const re = /(\d+(?:\.\d+)?)\s*(mg\/kg|mcg|mg|g|ml|%|days?|weeks?|hours?)\b/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(s)) !== null) {
    const norm = `${m[1]}${m[2].toLowerCase().replace(/s$/, '')}`;
    if (!out.has(norm)) out.set(norm, m[0].trim().replace(/\s+/g, ' '));
  }
  return out;
}

// Decide whether an AI-written free-text field (HPI / MDM / patient instruction) likely drifted from
// the dictation, and why. Phase 1 uses high-precision deterministic signals only:
//   1. A medication whose ORDERED strength differs from what was dictated — the field text was
//      generated from the dictation, so it still carries the old dose (the user's reported case).
//   2. A dose/duration the provider dictated that is simply absent from the field text.
// Returns the reason to show, or null when nothing looks off.
export function noteFieldDriftReason(
  text: string,
  sourceText: string | undefined,
  doseMismatches: { drug: string; dictated: string; order: string }[]
): string | null {
  const t = text.toLowerCase();
  for (const dm of doseMismatches) {
    const drug = dm.drug.toLowerCase();
    if (drug.length >= 3 && t.includes(drug)) {
      return `Ordered ${dm.drug} ${dm.order}, but you dictated ${dm.dictated} — confirm the dose here.`;
    }
  }
  if (sourceText) {
    const inText = doseTokens(text);
    for (const [norm, orig] of doseTokens(sourceText)) {
      if (!inText.has(norm)) {
        return `A dose/duration you dictated (“${orig}”) isn't reflected here — check it against your dictation.`;
      }
    }
  }
  return null;
}

// Search-based add intents that auto-chart with the needs-review highlight + click-to-correct,
// and the field each maps to. (CPT/E&M, exam findings and procedures use different mechanisms.)
export const KIND_TO_FIELD: Record<string, ChartedField> = {
  'add-allergy': 'allergies',
  'add-condition': 'conditions',
  'add-medication': 'medications',
  'add-surgical-history': 'surgicalHistory',
  'add-hospitalization': 'episodeOfCare',
  'add-diagnosis': 'diagnosis',
};
export const FIELD_TO_KIND: Record<ChartedField, AddSearchIntent['kind']> = {
  allergies: 'add-allergy',
  conditions: 'add-condition',
  medications: 'add-medication',
  surgicalHistory: 'add-surgical-history',
  episodeOfCare: 'add-hospitalization',
  diagnosis: 'add-diagnosis',
};
export const AUTO_CHART_KINDS = new Set(Object.keys(KIND_TO_FIELD));

// Build a minimal synthetic add-intent so runIntentSearch / buildIntentPayload can be reused by
// the inline correction flows (the popover and the Discuss picker).
export function synthAddIntent(
  field: ChartedField,
  display: string,
  searchTerms: string[],
  isPrimary?: boolean
): AddSearchIntent {
  return {
    kind: FIELD_TO_KIND[field],
    display,
    searchTerms,
    ...(field === 'diagnosis' ? { isPrimary: !!isPrimary } : {}),
  } as unknown as AddSearchIntent;
}
