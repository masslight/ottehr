/**
 * Deterministic scorer for harvested-case runs: compares the simulated chart state with the clinician's
 * structured gold.
 *
 * Gold that is not derivable from the transcript (`context: true` prior-chart items, lab-order diagnoses,
 * and items tagged `voiced: false` by tag-voiced.ts) leaves the recall denominator, and a prediction matching
 * it leaves the precision denominator instead of counting as a false positive. Untagged items stay in scope.
 *
 * Imported by run-harvested.ts, whose --rescore re-scores a run. Standalone, on synthetic fixtures only:
 *   npx tsx tools/easy-chart-eval/score-harvested.ts --self-test
 */
import { pathToFileURL } from 'url';
import { rosField } from 'utils/lib/ottehr-config/review-of-systems';

/** The scorer's own usage shape, deliberately not the app's ModelUsage; the runner adapts between them. */
export interface EvalTokenUsage {
  provider: 'gemini' | 'claude';
  model?: string;
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens?: number;
  cacheWriteTokens?: number;
  thinkingTokens?: number;
  /** Model calls these totals cover (a staged visit makes several); absent means one. */
  calls?: number;
  /** Why a call escalated, kept as free-form so the runner can map whatever the endpoint reports. */
  escalation?: {
    escalated?: boolean;
    attempts?: number;
    primaryAttempts?: number;
    primaryFailed?: boolean;
    reason?: string;
  };
}

import { PLANNABLE_VITAL_FIELDS, PlannableVitalField } from 'utils/lib/easy-chart/actions';
import { parseVitalDisplay } from 'utils/lib/easy-chart/vitals';
import { RosFindingState } from 'utils/lib/ottehr-config/review-of-systems/in-person.config';
import { DiagnosisItem, ExamItem, GoldData } from './gold-types';

// Simulated chart state: what the executor applied, in the shape the scorer compares against gold.
export interface SimItem {
  display: string;
  code?: string;
}
export interface SimDiagnosis extends SimItem {
  isPrimary?: boolean;
}
export interface SimMedication extends SimItem {
  strength?: string;
}
export interface SimExamComponent {
  code: string;
  label: string;
  abnormal?: boolean;
}
export interface SimExamObs {
  field: string;
  label: string;
  components?: SimExamComponent[];
}
export interface SimRosObs {
  baseKey: string;
  field: string;
  label: string;
  finding: 'reports' | 'denies';
}
export interface SimEmEvent {
  code?: string;
  display?: string;
}
export interface SimNoteText {
  text: string;
}
export interface SimFinalState {
  templatesApplied: string[];
  diagnoses: SimDiagnosis[];
  emEvents: SimEmEvent[];
  cptCodes: SimItem[];
  medications: SimMedication[];
  examObservations: SimExamObs[];
  // Findings that had no confident checkbox and were appended to a section's free-text area
  // (mirrors the client's writeExamComment fallback).
  examComments: { section: string; text: string }[];
  rosObservations: SimRosObs[];
  conditions: SimItem[];
  allergies: SimItem[];
  surgicalHistory: SimItem[];
  hospitalizations: SimItem[];
  // Keyed by the model-visible note field names (edit-note-text's field enum).
  noteText: Partial<
    Record<'chiefComplaint' | 'historyOfPresentIllness' | 'mechanismOfInjury' | 'ros' | 'medicalDecision', SimNoteText>
  >;
  instructions: string[];
  disposition?: { type?: string; text?: string };
  labsOrdered: { kind: 'in-house' | 'external'; display: string }[];
  radiology: string[];
  procedures: string[];
  nursingOrders: string[];
  vitals: { field: string; display: string }[];
  providerNotes: string[];
  // Steps the simulator recognized but skipped (dup / no match), with a short reason — file-only.
  skipped: { kind: string; display?: string; reason: string }[];
  // Step kinds the simulator does not model at all.
  otherSteps: { kind: string }[];
}

export function emptySimState(): SimFinalState {
  return {
    templatesApplied: [],
    diagnoses: [],
    emEvents: [],
    cptCodes: [],
    medications: [],
    examObservations: [],
    examComments: [],
    rosObservations: [],
    conditions: [],
    allergies: [],
    surgicalHistory: [],
    hospitalizations: [],
    noteText: {},
    instructions: [],
    labsOrdered: [],
    radiology: [],
    procedures: [],
    nursingOrders: [],
    vitals: [],
    providerNotes: [],
    skipped: [],
    otherSteps: [],
  };
}

// The plan response's disposition trigger, passed through. On a CaseScore, `null` means the response had no
// trigger info and an absent field means none was passed; both land in the aggregate's no-data bucket.
export interface DispositionTriggerInfo {
  fired: boolean;
  matchedPattern?: string;
  modelProposed: boolean;
}

// Score shapes
export interface SectionScore {
  goldInScope: number;
  predicted: number;
  matched: number;
  contextGold?: number;
  contextCharted?: number;
  // Gold tagged `voiced: false`, and predictions matching one (excluded from precision, like context).
  unvoicedGold?: number;
  unvoicedMatched?: number;
  precision: number | null;
  recall: number | null;
}
export interface ChartScores {
  diagnoses: SectionScore & { predictedNoCode: number };
  primaryDx: { goldCode?: string; goldVoiced?: boolean; predictedCode?: string; match: boolean | null };
  // levelMatch compares the E&M *level* (last digit — 9920x/9921x share levels) so a new-vs-
  // established family error doesn't hide correct complexity selection.
  em: { gold?: string; predicted?: string; match: boolean | null; levelMatch: boolean | null };
  cpt: SectionScore;
  ros: SectionScore & { polarityAgree: number };
  exam: SectionScore & { abnormalAgree: number };
  // legacyVoiced: voiced meds without a `nameVoiced` tag (still in the recall denominator).
  // intentVoiced/intentCovered: commitment coverage over intent-voiced meds (see isIntentVoiced).
  medsPrescribed: SectionScore & { legacyVoiced: number; intentVoiced: number; intentCovered: number };
  medsInHouse: SectionScore;
  immunizations: SectionScore;
  // Context sections: gold is intake and prior-history data with no voicing tags, so recall includes items
  // the provider never dictated. Precision is the figure to read.
  vitals: SectionScore;
  allergies: SectionScore;
  conditions: SectionScore;
  surgicalHistory: SectionScore;
  hospitalizations: SectionScore;
  // The three med sections share one predicted pool (planner meds are name-only), so precision
  // is only meaningful combined.
  medsCombined: {
    predicted: number;
    matched: number;
    contextCharted: number;
    unvoicedMatched: number;
    // predicted meds that matched an intent-voiced gold med — excluded from the precision
    // denominator like unvoiced (the med was right even though its name was never spoken).
    intentMatched: number;
    precision: number | null;
  };
}
export interface FreeTextScore {
  goldPresent: boolean;
  goldLength: number;
  predictedPresent: boolean;
  predictedLength: number;
}
export interface CaseScore extends ChartScores {
  caseId: string;
  freeText: Record<string, FreeTextScore>;
  contextCharted: {
    labOrderDiagnoses: number;
    conditionsMatchingHistory: number;
    allergiesMatchingPrior: number;
    medsMatchingReconciled: number;
  };
  counters: {
    templatesApplied: number;
    examComments: number;
    providerNotes: number;
    predictedConditions: number;
    predictedAllergies: number;
    goldInstructions: number;
    predictedInstructions: number;
    goldDisposition: boolean;
    predictedDisposition: boolean;
    // gold.disposition.dispositionVoiced; omitted when untagged so untagged score files are unchanged.
    goldDispositionVoiced?: boolean;
  };
  usage?: EvalTokenUsage;
  dispositionTrigger?: DispositionTriggerInfo | null;
}

// Normalization and matching helpers

// Must match CodeItem.codeNormalized as written by the harvester.
export function normCode(code: string | undefined): string {
  return (code ?? '').toUpperCase().replace(/\s+/g, '').replace(/\./g, '');
}
export function normName(s: string | undefined): string {
  return (s ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}
// Name-only med/history matching: case-insensitive containment either direction, per the gold's
// limitation (eRx and prior-chart items carry no codes).
export function nameMatch(a: string | undefined, b: string | undefined): boolean {
  const na = normName(a);
  const nb = normName(b);
  if (na.length < 3 || nb.length < 3) return false;
  return na.includes(nb) || nb.includes(na);
}

const DENIES_SUFFIX = rosField('', RosFindingState.Denies);
const REPORTS_SUFFIX = rosField('', RosFindingState.Reports);
export function rosBaseAndPolarity(field: string): { base: string; polarity?: 'denies' | 'reports' } {
  if (field.endsWith(DENIES_SUFFIX)) return { base: field.slice(0, -DENIES_SUFFIX.length), polarity: 'denies' };
  if (field.endsWith(REPORTS_SUFFIX)) return { base: field.slice(0, -REPORTS_SUFFIX.length), polarity: 'reports' };
  return { base: field };
}

// `voiced` is stamped onto gold items by tag-voiced.ts and not declared on the gold types. Only an explicit
// `voiced: false` takes an item out of scope.
export function isUnvoiced(item: unknown): boolean {
  return (item as { voiced?: boolean }).voiced === false;
}

// Intent-voiced: the commitment or drug class was spoken but not the name ("an antibiotic"). A scribe cannot
// chart that as a med, so it leaves recall and is scored by commitment coverage instead.
// Legacy-voiced: `voiced: true` without a `nameVoiced` tag; stays in the recall denominator.
type VoicedMed = { voiced?: boolean; nameVoiced?: boolean; voicedEvidence?: string; name?: string };
export function isIntentVoiced(item: unknown): boolean {
  const m = item as VoicedMed;
  return m.voiced === true && m.nameVoiced === false;
}
export function isLegacyVoiced(item: unknown): boolean {
  const m = item as VoicedMed;
  return m.voiced === true && typeof m.nameVoiced !== 'boolean';
}

// Commitment-coverage tokens drop function words, prescribing verbs and dose-form/schedule words, but keep
// class words (antibiotic, nasal, spray, cough), since those are what the provider actually voiced.
const COMMIT_STOPWORDS = new Set([
  // function/filler words (transcript evidence is conversational)
  ...(
    'the and for you your with that this like kind some something nature going want will well just either way ' +
    'them they are was can could should would about also then than what when where have has had not but out off ' +
    'over counter'
  ).split(' '),
  // prescribing verbs / generic drug words
  ...(
    'give get let start put take use send call prescribe prescribed prescription medication medicine med meds ' +
    'treat treating treatment'
  ).split(' '),
  // dose-form / schedule / units
  ...(
    'oral tablet tablets capsule capsules solution suspension daily twice once needed days hours weeks per each ' +
    'every mcg act dose doses'
  ).split(' '),
]);
export function substantiveTokens(s: string | undefined): string[] {
  return normName(s)
    .split(' ')
    .filter((t) => t.length >= 3 && !/^\d+$/.test(t) && !COMMIT_STOPWORDS.has(t));
}
// Exact match, or prefix when the shorter token is >=4 chars — so singular/plural variants
// ("allergy" / "allergies") still count without a stemmer.
function tokensOverlap(a: string[], b: string[]): boolean {
  return a.some((ta) =>
    b.some((tb) => {
      if (ta === tb) return true;
      const [short, long] = ta.length <= tb.length ? [ta, tb] : [tb, ta];
      return short.length >= 4 && long.startsWith(short);
    })
  );
}

function mkSection(
  goldInScope: number,
  predicted: number,
  matched: number,
  contextGold?: number,
  contextCharted?: number,
  unvoicedGold?: number,
  unvoicedMatched?: number
): SectionScore {
  const precDenom = predicted - (contextCharted ?? 0) - (unvoicedMatched ?? 0);
  return {
    goldInScope,
    predicted,
    matched,
    ...(contextGold != null ? { contextGold } : {}),
    ...(contextCharted != null ? { contextCharted } : {}),
    ...(unvoicedGold != null ? { unvoicedGold } : {}),
    ...(unvoicedMatched != null ? { unvoicedMatched } : {}),
    precision: precDenom > 0 ? matched / precDenom : null,
    recall: goldInScope > 0 ? matched / goldInScope : null,
  };
}

// Section scoring
function scoreChart(gold: GoldData, state: SimFinalState): ChartScores {
  // Diagnoses match on codeNormalized.
  const goldDx = gold.assessment.diagnoses;
  const goldDxScorable = goldDx.filter((d) => !d.fromLabOrder);
  const goldDxInScope = goldDxScorable.filter((d) => !isUnvoiced(d));
  const goldDxUnvoiced = goldDxScorable.filter(isUnvoiced);
  const goldDxContext = goldDx.filter((d) => d.fromLabOrder);
  const predDx = state.diagnoses;
  const goldCodes = new Set(goldDxInScope.map((d) => d.codeNormalized));
  const unvoicedDxCodes = new Set(goldDxUnvoiced.map((d) => d.codeNormalized));
  const contextCodes = new Set(goldDxContext.map((d) => d.codeNormalized));
  let dxContextCharted = 0;
  let dxUnvoicedMatched = 0;
  const matchedGoldCodes = new Set<string>();
  let predictedNoCode = 0;
  for (const p of predDx) {
    const c = normCode(p.code);
    if (!c) {
      predictedNoCode++;
      continue;
    }
    if (contextCodes.has(c)) dxContextCharted++;
    else if (goldCodes.has(c)) matchedGoldCodes.add(c);
    else if (unvoicedDxCodes.has(c)) dxUnvoicedMatched++;
  }
  const diagnoses = {
    ...mkSection(
      goldDxInScope.length,
      predDx.length,
      matchedGoldCodes.size,
      goldDxContext.length,
      dxContextCharted,
      goldDxUnvoiced.length,
      dxUnvoicedMatched
    ),
    predictedNoCode,
  };

  // Primary dx: the raw comparison ignores voicing. The gold primary's `voiced` tag, when present, is recorded
  // for the voiced-scoped aggregate.
  const goldPrimary = goldDxScorable.find((d) => d.primary);
  const goldPrimaryVoiced = (goldPrimary as { voiced?: boolean } | undefined)?.voiced;
  const predPrimary = predDx.find((d) => d.isPrimary);
  const primaryDx = {
    ...(goldPrimary ? { goldCode: goldPrimary.codeNormalized } : {}),
    ...(goldPrimary && typeof goldPrimaryVoiced === 'boolean' ? { goldVoiced: goldPrimaryVoiced } : {}),
    ...(predPrimary?.code ? { predictedCode: normCode(predPrimary.code) } : {}),
    match: goldPrimary && predPrimary?.code ? normCode(predPrimary.code) === goldPrimary.codeNormalized : null,
  };

  // E&M: exact code, plus level (last digit; see ChartScores.em). The chart holds one code, so the last set wins.
  const goldEm = gold.billing.emCode?.code;
  const predEm = state.emEvents[state.emEvents.length - 1]?.code;
  const em = {
    ...(goldEm ? { gold: goldEm } : {}),
    ...(predEm ? { predicted: predEm } : {}),
    match: goldEm && predEm ? goldEm === predEm : null,
    levelMatch: goldEm && predEm ? goldEm.slice(-1) === predEm.slice(-1) : null,
  };

  // CPT: set of normalized codes.
  const goldCpt = new Set(gold.billing.cptCodes.filter((c) => !isUnvoiced(c)).map((c) => c.codeNormalized));
  const goldCptUnvoiced = new Set(gold.billing.cptCodes.filter(isUnvoiced).map((c) => c.codeNormalized));
  const predCpt = new Set(state.cptCodes.map((c) => normCode(c.code)).filter(Boolean));
  let cptMatched = 0;
  let cptUnvoicedMatched = 0;
  for (const c of predCpt) {
    if (goldCpt.has(c)) cptMatched++;
    else if (goldCptUnvoiced.has(c)) cptUnvoicedMatched++;
  }
  const cpt = mkSection(
    goldCpt.size,
    predCpt.size,
    cptMatched,
    undefined,
    undefined,
    goldCptUnvoiced.size,
    cptUnvoicedMatched
  );

  // ROS: presence by base field key; polarity agreement is reported separately.
  const goldRos = new Map<string, 'denies' | 'reports' | undefined>();
  const goldRosUnvoiced = new Set<string>();
  for (const o of gold.reviewOfSystems.observations) {
    if (o.present !== true) continue;
    const { base, polarity } = rosBaseAndPolarity(o.field);
    if (isUnvoiced(o)) goldRosUnvoiced.add(base);
    else goldRos.set(base, polarity);
  }
  const predRos = new Map<string, 'denies' | 'reports'>();
  for (const o of state.rosObservations) predRos.set(o.baseKey, o.finding);
  let rosMatched = 0;
  let polarityAgree = 0;
  let rosUnvoicedMatched = 0;
  for (const [base, finding] of predRos) {
    if (goldRos.has(base)) {
      rosMatched++;
      if (goldRos.get(base) === finding) polarityAgree++;
    } else if (goldRosUnvoiced.has(base)) rosUnvoicedMatched++;
  }
  const ros = {
    ...mkSection(
      goldRos.size,
      predRos.size,
      rosMatched,
      undefined,
      undefined,
      goldRosUnvoiced.size,
      rosUnvoicedMatched
    ),
    polarityAgree,
  };

  // Exam: presence by field, each field counted once on both sides (a checkbox is ticked or not), so a
  // repeated finding cannot push recall past 1. Abnormal agreement is derived from checked components on
  // both sides, since the gold's abnormal flag only comes from component-level data.
  const goldExam = new Map<string, ExamItem>();
  const goldExamUnvoiced = new Set<string>();
  for (const o of gold.exam) {
    if (o.present !== true) continue;
    if (isUnvoiced(o)) goldExamUnvoiced.add(o.field);
    else goldExam.set(o.field, o);
  }
  // Predicted field → whether any observation on it has an abnormal component.
  const predExam = new Map<string, boolean>();
  for (const o of state.examObservations) {
    const abnormal = (o.components ?? []).some((c) => c.abnormal === true);
    predExam.set(o.field, (predExam.get(o.field) ?? false) || abnormal);
  }
  let examMatched = 0;
  let abnormalAgree = 0;
  let examUnvoicedMatched = 0;
  for (const [field, predAbnormal] of predExam) {
    const g = goldExam.get(field);
    if (!g) {
      if (goldExamUnvoiced.has(field)) examUnvoicedMatched++;
      continue;
    }
    examMatched++;
    const goldAbnormal = (g.components ?? []).some((c) => c.value === true && c.abnormal === true);
    if (goldAbnormal === predAbnormal) abnormalAgree++;
  }
  const exam = {
    ...mkSection(
      goldExam.size,
      predExam.size,
      examMatched,
      undefined,
      undefined,
      goldExamUnvoiced.size,
      examUnvoicedMatched
    ),
    abnormalAgree,
  };

  // Medications: name-only against one shared predicted pool, consumed greedily (prescribed → in-house →
  // immunizations → context reconciled), each predicted item at most once.
  const pool = state.medications.map((m) => ({ display: m.display, used: false }));
  const consume = (goldNames: (string | undefined)[]): number => {
    let matched = 0;
    for (const gn of goldNames) {
      const hit = pool.find((p) => !p.used && nameMatch(p.display, gn));
      if (hit) {
        hit.used = true;
        matched++;
      }
    }
    return matched;
  };
  // Scorable: name voiced, legacy-voiced, or untagged.
  const prescribedScorable = gold.medications.prescribed.filter((m) => !isUnvoiced(m) && !isIntentVoiced(m));
  const prescribedIntent = gold.medications.prescribed.filter(isIntentVoiced);
  const prescribedUnvoiced = gold.medications.prescribed.filter(isUnvoiced);
  const prescribedMatched = consume(prescribedScorable.map((m) => m.name));
  const inHouseMatched = consume(gold.medications.inHouseAdministered.map((m) => m.name));
  const immunizationsMatched = consume(gold.medications.immunizations.map((m) => m.name));
  // Intent-voiced and unvoiced meds consume after the scorable sections (never stealing a match) and before
  // context. An intent-voiced med is also covered when a provider note or instruction shares a substantive
  // token with it.
  const noteTokens = [...state.providerNotes, ...state.instructions].map(substantiveTokens);
  let prescribedIntentMatched = 0;
  let prescribedIntentCovered = 0;
  for (const m of prescribedIntent) {
    const hit = pool.find((p) => !p.used && nameMatch(p.display, m.name));
    if (hit) {
      hit.used = true;
      prescribedIntentMatched++;
      prescribedIntentCovered++;
      continue;
    }
    const medTokens = substantiveTokens(`${m.name ?? ''} ${(m as VoicedMed).voicedEvidence ?? ''}`);
    if (noteTokens.some((nt) => tokensOverlap(medTokens, nt))) prescribedIntentCovered++;
  }
  const prescribedUnvoicedMatched = consume(prescribedUnvoiced.map((m) => m.name));
  const medsContextCharted = consume(gold.medications.currentReconciled.map((m) => m.name));
  const totalMedMatched = prescribedMatched + inHouseMatched + immunizationsMatched;
  const medsPrescribed = {
    ...mkSection(
      prescribedScorable.length,
      pool.length,
      prescribedMatched,
      undefined,
      undefined,
      prescribedUnvoiced.length,
      prescribedUnvoicedMatched
    ),
    precision: null, // pool is shared across med sections — see medsCombined
    legacyVoiced: prescribedScorable.filter(isLegacyVoiced).length,
    intentVoiced: prescribedIntent.length,
    intentCovered: prescribedIntentCovered,
  };
  const medsInHouse = {
    ...mkSection(gold.medications.inHouseAdministered.length, pool.length, inHouseMatched),
    precision: null,
  };
  const immunizations = {
    ...mkSection(gold.medications.immunizations.length, pool.length, immunizationsMatched),
    precision: null,
  };
  const medsPrecDenom = pool.length - medsContextCharted - prescribedUnvoicedMatched - prescribedIntentMatched;
  const medsCombined = {
    predicted: pool.length,
    matched: totalMedMatched,
    contextCharted: medsContextCharted,
    unvoicedMatched: prescribedUnvoicedMatched,
    intentMatched: prescribedIntentMatched,
    precision: medsPrecDenom > 0 ? totalMedMatched / medsPrecDenom : null,
  };

  // Context sections: vitals by field and value (gold units: °C, kg, cm), history by code or name.
  const vitals = scoreVitals(gold, state);
  const allergies = scoreNamed(
    gold.allergies.map((a) => ({ display: a.name })),
    state.allergies
  );
  const conditions = scoreNamed(
    gold.medicalHistory.map((h) => ({ display: h.display, codeNormalized: h.codeNormalized })),
    state.conditions
  );
  const surgicalHistory = scoreNamed(gold.surgicalHistory, state.surgicalHistory);
  const hospitalizations = scoreNamed(gold.hospitalizations, state.hospitalizations);

  return {
    diagnoses,
    primaryDx,
    em,
    cpt,
    ros,
    exam,
    medsPrescribed,
    medsInHouse,
    immunizations,
    vitals,
    allergies,
    conditions,
    surgicalHistory,
    hospitalizations,
    medsCombined,
  };
}

/**
 * ICD-10 category of a normalized code ("E849" → "E84"), or undefined if not ICD-shaped. History matches on
 * category because intake often records the unspecified code (E84.9) where the provider dictates E84.0.
 */
export function icdCategory(codeNormalized: string | undefined): string | undefined {
  const m = /^([A-Z]\d{2})/.exec(codeNormalized ?? '');
  return m ? m[1] : undefined;
}

/** History-style sections: greedy match by historyMatches, each gold item consumed once. */
function scoreNamed(goldItems: { display?: string; codeNormalized?: string }[], predicted: SimItem[]): SectionScore {
  const used = new Set<number>();
  let matched = 0;
  for (const p of predicted) {
    const idx = goldItems.findIndex((g, i) => !used.has(i) && historyMatches(p, g));
    if (idx >= 0) {
      used.add(idx);
      matched++;
    }
  }
  return mkSection(goldItems.length, predicted.length, matched);
}

/** The history-section match rule, shared with ground-predictions.ts: code, then ICD-10 category, then name. */
export function historyMatches(
  p: { display?: string; code?: string },
  g: { display?: string; codeNormalized?: string }
): boolean {
  const code = normCode(p.code);
  const category = icdCategory(code);
  return (
    (!!code && !!g.codeNormalized && code === g.codeNormalized) ||
    (category !== undefined && category === icdCategory(g.codeNormalized)) ||
    nameMatch(p.display, g.display)
  );
}

/** Gold vitals are charted in °C, kg and cm; the model's display is whatever the provider said. */
const VITAL_TOLERANCE: Record<string, number> = {
  'vital-temperature': 0.3,
  'vital-heartbeat': 1,
  'vital-respiration-rate': 1,
  'vital-oxygen-sat': 1,
  'vital-weight': 0.5,
  'vital-height': 1,
};

function toGoldUnits(field: PlannableVitalField, value: number, unit: string | undefined): number {
  const u = (unit ?? '').toLowerCase();
  if (field === 'vital-temperature') return u.startsWith('f') || (!u && value > 45) ? ((value - 32) * 5) / 9 : value;
  if (field === 'vital-weight') return u === 'lb' ? value * 0.45359237 : value;
  if (field === 'vital-height') return u === 'in' ? value * 2.54 : value;
  return value;
}

/** The vitals match rule, shared with ground-predictions.ts: same field, value within tolerance in chart units. */
export function vitalMatchesGold(field: PlannableVitalField, display: string, g: Record<string, unknown>): boolean {
  if (g.field !== field) return false;
  const parsed = parseVitalDisplay(field, display);
  if (parsed.status === 'ok-bp') {
    return Math.abs(Number(g.systolic) - parsed.systolic) <= 2 && Math.abs(Number(g.diastolic) - parsed.diastolic) <= 2;
  }
  if (parsed.status !== 'ok') return false;
  const goldValue = Number(g.value);
  if (!Number.isFinite(goldValue)) return false;
  return Math.abs(goldValue - toGoldUnits(field, parsed.value, parsed.unit)) <= (VITAL_TOLERANCE[field] ?? 1);
}

/** Gold is limited to the fields the model may set (BMI is derived; LMP and vision are never dictated). */
function scoreVitals(gold: GoldData, state: SimFinalState): SectionScore {
  const plannable = new Set<string>(PLANNABLE_VITAL_FIELDS);
  const goldVitals = gold.vitals.filter((v) => plannable.has(String(v.field)));
  // Exact repeats collapse first: a repeated correct reading is a duplicate-write defect, not a wrong vital,
  // and should not cost precision.
  const unique = uniqueVitals(state.vitals).filter((v) => plannable.has(v.field));
  const used = new Set<number>();
  let matched = 0;
  for (const v of unique) {
    const field = v.field as PlannableVitalField;
    const idx = goldVitals.findIndex((g, i) => !used.has(i) && vitalMatchesGold(field, v.display, g));
    if (idx >= 0) {
      used.add(idx);
      matched++;
    }
  }
  return mkSection(goldVitals.length, unique.length, matched);
}

/** Vitals with exact (field, display) repeats removed, first occurrence kept. Shared with ground-predictions.ts. */
export function uniqueVitals<T extends { field: string; display: string }>(vitals: T[]): T[] {
  const seen = new Set<string>();
  return vitals.filter((v) => {
    const key = `${v.field}|${v.display}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

// Case scoring

// Gold free-text field ↔ sim noteText field, honoring the CC/HPI cross-wiring (see GoldData). Exported so a
// free-text content judge pairs fields the same way as this presence scorer.
export const FREETEXT_PAIRING = {
  historyOfPresentIllness: { goldField: 'historyOfPresentIllness', noteField: 'historyOfPresentIllness' },
  additionalInformation: { goldField: 'additionalInformation', noteField: 'chiefComplaint' },
  medicalDecisionMaking: { goldField: 'medicalDecisionMaking', noteField: 'medicalDecision' },
} as const;

export function scoreCase(
  caseId: string,
  gold: GoldData,
  state: SimFinalState,
  usage?: EvalTokenUsage,
  dispositionTrigger?: DispositionTriggerInfo | null
): CaseScore {
  const ft = (goldText: string | undefined, pred: SimNoteText | undefined): FreeTextScore => ({
    goldPresent: !!goldText?.trim(),
    goldLength: goldText?.trim().length ?? 0,
    predictedPresent: !!pred?.text?.trim(),
    predictedLength: pred?.text?.trim().length ?? 0,
  });
  const P = FREETEXT_PAIRING;
  const freeText: Record<string, FreeTextScore> = {
    historyOfPresentIllness: ft(
      gold[P.historyOfPresentIllness.goldField],
      state.noteText[P.historyOfPresentIllness.noteField]
    ),
    additionalInformation: ft(
      gold[P.additionalInformation.goldField],
      state.noteText[P.additionalInformation.noteField]
    ),
    medicalDecisionMaking: ft(
      gold[P.medicalDecisionMaking.goldField],
      state.noteText[P.medicalDecisionMaking.noteField]
    ),
    rosFreeText: ft(gold.reviewOfSystems.freeText, state.noteText.ros),
    mechanismOfInjury: ft(undefined, state.noteText.mechanismOfInjury),
  };

  const chart = scoreChart(gold, state);

  // Prior-chart items the system charted anyway: reported, never counted as false positives.
  const labOrderCodes = new Set(gold.assessment.diagnoses.filter((d) => d.fromLabOrder).map((d) => d.codeNormalized));
  const contextCharted = {
    labOrderDiagnoses: state.diagnoses.filter((d) => d.code && labOrderCodes.has(normCode(d.code))).length,
    conditionsMatchingHistory: state.conditions.filter((c) =>
      gold.medicalHistory.some((h) => nameMatch(c.display, h.display))
    ).length,
    allergiesMatchingPrior: state.allergies.filter((a) => gold.allergies.some((g) => nameMatch(a.display, g.name)))
      .length,
    medsMatchingReconciled: chart.medsCombined.contextCharted,
  };

  return {
    caseId,
    ...chart,
    freeText,
    contextCharted,
    counters: {
      templatesApplied: state.templatesApplied.length,
      examComments: state.examComments.length,
      providerNotes: state.providerNotes.length,
      predictedConditions: state.conditions.length,
      predictedAllergies: state.allergies.length,
      goldInstructions: gold.instructions.length,
      predictedInstructions: state.instructions.length,
      goldDisposition: !!(gold.disposition?.type || gold.disposition?.note),
      predictedDisposition: !!state.disposition,
      // tag-voiced.ts field, not declared on the gold types; omitted when untagged.
      ...(typeof (gold.disposition as { dispositionVoiced?: boolean } | undefined)?.dispositionVoiced === 'boolean'
        ? { goldDispositionVoiced: (gold.disposition as { dispositionVoiced?: boolean }).dispositionVoiced }
        : {}),
    },
    ...(usage ? { usage } : {}),
    // undefined omits the key; null is kept (see DispositionTriggerInfo).
    ...(dispositionTrigger !== undefined ? { dispositionTrigger } : {}),
  };
}

// Aggregation (micro-averaged across cases)
interface AggSection {
  gold: number;
  predicted: number;
  matched: number;
  contextGold: number;
  contextCharted: number;
  unvoicedGold: number;
  unvoicedMatched: number;
  precision: number | null;
  recall: number | null;
}
interface AggChart {
  sections: Record<string, AggSection>;
  em: { goldCases: number; predictedCases: number; matched: number; levelMatched: number };
  // Over cases with a gold primary: voicedBoth = both charted and gold voiced (the denominator),
  // voicedMatched = those that matched, unvoicedGold = tagged false, noData = untagged.
  primaryDx: {
    goldCases: number;
    bothPresent: number;
    matched: number;
    voicedBoth: number;
    voicedMatched: number;
    unvoicedGold: number;
    noData: number;
  };
  rosPolarity: { matched: number; agree: number };
  examAbnormal: { matched: number; agree: number };
  medsCombined: {
    predicted: number;
    matched: number;
    contextCharted: number;
    unvoicedMatched: number;
    intentMatched: number;
    precision: number | null;
  };
  // Prescribed-med voicing fidelity breakdown (see ChartScores.medsPrescribed).
  medsVoicing: { legacyVoiced: number; intentVoiced: number; intentCovered: number };
}
interface UsageAgg {
  calls: number;
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheWriteTokens: number;
  thinkingTokens: number;
}
// Primary→backup escalation. noData = no escalation field (never a denominator). okProviders tallies
// primary-ok cases only, because on a failed call usage.provider is the backup's.
interface EscalationAgg {
  primaryOk: number;
  primaryFailed: number;
  reasons: Record<string, number>;
  okProviders: Record<string, number>;
  noData: number;
}
export interface AggregateSummary extends AggChart {
  scoredCases: number;
  freeText: Record<string, { goldPresent: number; predictedPresent: number; bothPresent: number }>;
  contextCharted: CaseScore['contextCharted'];
  counters: {
    templatesApplied: number;
    examComments: number;
    providerNotes: number;
    goldInstructions: number;
    predictedInstructions: number;
    goldDisposition: number;
    predictedDisposition: number;
  };
  // Providers chart a disposition on nearly every visit but rarely voice it, so the raw counter mostly
  // measures guessing. Over cases with a gold disposition: voicedGold = tagged voiced (the denominator),
  // voicedPredicted = those also charted, unvoicedGold = tagged false, noData = untagged.
  dispositionVoiced: {
    voicedGold: number;
    voicedPredicted: number;
    unvoicedGold: number;
    noData: number;
  };
  // noData = no trigger info on the score; firedByPattern counts fired cases per matchedPattern.
  dispositionTrigger: {
    firedProposed: number;
    firedDeclined: number;
    notFired: number;
    noData: number;
    firedByPattern: Record<string, number>;
  };
  usage: UsageAgg;
  escalation: EscalationAgg;
}

const SET_SECTIONS = [
  'diagnoses',
  'cpt',
  'ros',
  'exam',
  'medsPrescribed',
  'medsInHouse',
  'immunizations',
  'vitals',
  'allergies',
  'conditions',
  'surgicalHistory',
  'hospitalizations',
] as const;

function aggregateChart(scores: CaseScore[]): AggChart {
  const sections: Record<string, AggSection> = {};
  for (const name of SET_SECTIONS) {
    let gold = 0,
      predicted = 0,
      matched = 0,
      contextGold = 0,
      contextCharted = 0,
      unvoicedGold = 0,
      unvoicedMatched = 0;
    for (const s of scores) {
      const sec: SectionScore = s[name];
      gold += sec.goldInScope;
      predicted += sec.predicted;
      matched += sec.matched;
      contextGold += sec.contextGold ?? 0;
      contextCharted += sec.contextCharted ?? 0;
      unvoicedGold += sec.unvoicedGold ?? 0;
      unvoicedMatched += sec.unvoicedMatched ?? 0;
    }
    // The med sections share one predicted pool, so their precision is null here; medsCombined carries it.
    const sharedPool = name === 'medsPrescribed' || name === 'medsInHouse' || name === 'immunizations';
    const precDenom = predicted - contextCharted - unvoicedMatched;
    sections[name] = {
      gold,
      predicted,
      matched,
      contextGold,
      contextCharted,
      unvoicedGold,
      unvoicedMatched,
      precision: !sharedPool && precDenom > 0 ? matched / precDenom : null,
      recall: gold > 0 ? matched / gold : null,
    };
  }
  const em = { goldCases: 0, predictedCases: 0, matched: 0, levelMatched: 0 };
  const primaryDx = {
    goldCases: 0,
    bothPresent: 0,
    matched: 0,
    voicedBoth: 0,
    voicedMatched: 0,
    unvoicedGold: 0,
    noData: 0,
  };
  const rosPolarity = { matched: 0, agree: 0 };
  const examAbnormal = { matched: 0, agree: 0 };
  const medsCombined = {
    predicted: 0,
    matched: 0,
    contextCharted: 0,
    unvoicedMatched: 0,
    intentMatched: 0,
    precision: null as number | null,
  };
  const medsVoicing = { legacyVoiced: 0, intentVoiced: 0, intentCovered: 0 };
  for (const sc of scores) {
    if (sc.em.gold) em.goldCases++;
    if (sc.em.predicted) em.predictedCases++;
    if (sc.em.match === true) em.matched++;
    if (sc.em.levelMatch === true) em.levelMatched++;
    if (sc.primaryDx.goldCode) primaryDx.goldCases++;
    if (sc.primaryDx.match !== null) primaryDx.bothPresent++;
    if (sc.primaryDx.match === true) primaryDx.matched++;
    if (sc.primaryDx.goldCode) {
      // undefined = untagged corpus → no-data bucket, never a denominator.
      const voiced = sc.primaryDx.goldVoiced;
      if (voiced === true) {
        if (sc.primaryDx.match !== null) {
          primaryDx.voicedBoth++;
          if (sc.primaryDx.match === true) primaryDx.voicedMatched++;
        }
      } else if (voiced === false) primaryDx.unvoicedGold++;
      else primaryDx.noData++;
    }
    rosPolarity.matched += sc.ros.matched;
    rosPolarity.agree += sc.ros.polarityAgree;
    examAbnormal.matched += sc.exam.matched;
    examAbnormal.agree += sc.exam.abnormalAgree;
    medsCombined.predicted += sc.medsCombined.predicted;
    medsCombined.matched += sc.medsCombined.matched;
    medsCombined.contextCharted += sc.medsCombined.contextCharted;
    medsCombined.unvoicedMatched += sc.medsCombined.unvoicedMatched;
    medsCombined.intentMatched += sc.medsCombined.intentMatched;
    medsVoicing.legacyVoiced += sc.medsPrescribed.legacyVoiced;
    medsVoicing.intentVoiced += sc.medsPrescribed.intentVoiced;
    medsVoicing.intentCovered += sc.medsPrescribed.intentCovered;
  }
  const medsDenom =
    medsCombined.predicted - medsCombined.contextCharted - medsCombined.unvoicedMatched - medsCombined.intentMatched;
  medsCombined.precision = medsDenom > 0 ? medsCombined.matched / medsDenom : null;
  return { sections, em, primaryDx, rosPolarity, examAbnormal, medsCombined, medsVoicing };
}

export function aggregateScores(scores: CaseScore[]): AggregateSummary {
  const freeText: AggregateSummary['freeText'] = {};
  for (const s of scores) {
    for (const [k, v] of Object.entries(s.freeText)) {
      const agg = (freeText[k] ??= { goldPresent: 0, predictedPresent: 0, bothPresent: 0 });
      if (v.goldPresent) agg.goldPresent++;
      if (v.predictedPresent) agg.predictedPresent++;
      if (v.goldPresent && v.predictedPresent) agg.bothPresent++;
    }
  }
  const contextCharted = {
    labOrderDiagnoses: 0,
    conditionsMatchingHistory: 0,
    allergiesMatchingPrior: 0,
    medsMatchingReconciled: 0,
  };
  const counters = {
    templatesApplied: 0,
    examComments: 0,
    providerNotes: 0,
    goldInstructions: 0,
    predictedInstructions: 0,
    goldDisposition: 0,
    predictedDisposition: 0,
  };
  const usage: UsageAgg = {
    calls: 0,
    inputTokens: 0,
    outputTokens: 0,
    cacheReadTokens: 0,
    cacheWriteTokens: 0,
    thinkingTokens: 0,
  };
  const escalation: EscalationAgg = { primaryOk: 0, primaryFailed: 0, reasons: {}, okProviders: {}, noData: 0 };
  const dispositionVoiced: AggregateSummary['dispositionVoiced'] = {
    voicedGold: 0,
    voicedPredicted: 0,
    unvoicedGold: 0,
    noData: 0,
  };
  const dispositionTrigger: AggregateSummary['dispositionTrigger'] = {
    firedProposed: 0,
    firedDeclined: 0,
    notFired: 0,
    noData: 0,
    firedByPattern: {},
  };
  for (const s of scores) {
    for (const k of Object.keys(contextCharted) as (keyof typeof contextCharted)[])
      contextCharted[k] += s.contextCharted[k];
    counters.templatesApplied += s.counters.templatesApplied;
    counters.examComments += s.counters.examComments;
    counters.providerNotes += s.counters.providerNotes;
    counters.goldInstructions += s.counters.goldInstructions;
    counters.predictedInstructions += s.counters.predictedInstructions;
    if (s.counters.goldDisposition) counters.goldDisposition++;
    if (s.counters.predictedDisposition) counters.predictedDisposition++;
    if (s.counters.goldDisposition) {
      // undefined = untagged corpus → no-data bucket, never a denominator.
      const voiced = s.counters.goldDispositionVoiced;
      if (voiced === true) {
        dispositionVoiced.voicedGold++;
        if (s.counters.predictedDisposition) dispositionVoiced.voicedPredicted++;
      } else if (voiced === false) dispositionVoiced.unvoicedGold++;
      else dispositionVoiced.noData++;
    }
    const t = s.dispositionTrigger; // == null: not passed, or null (response lacked it)
    if (t == null) dispositionTrigger.noData++;
    else if (!t.fired) dispositionTrigger.notFired++;
    else {
      if (t.modelProposed) dispositionTrigger.firedProposed++;
      else dispositionTrigger.firedDeclined++;
      const p = t.matchedPattern ?? '(unspecified)';
      dispositionTrigger.firedByPattern[p] = (dispositionTrigger.firedByPattern[p] ?? 0) + 1;
    }
    const u = s.usage;
    if (!u) continue;
    // A staged visit makes several calls; absent `calls` means one.
    usage.calls += u.calls ?? 1;
    usage.inputTokens += u.inputTokens ?? 0;
    usage.outputTokens += u.outputTokens ?? 0;
    usage.cacheReadTokens += u.cacheReadTokens ?? 0;
    usage.cacheWriteTokens += u.cacheWriteTokens ?? 0;
    usage.thinkingTokens += u.thinkingTokens ?? 0;
    const esc = u.escalation; // absent → no-data bucket
    if (!esc) escalation.noData++;
    else if (esc.primaryFailed) {
      escalation.primaryFailed++;
      const r = esc.reason ?? '(unspecified)';
      escalation.reasons[r] = (escalation.reasons[r] ?? 0) + 1;
    } else {
      escalation.primaryOk++;
      const p = u.provider ?? '(unknown)';
      escalation.okProviders[p] = (escalation.okProviders[p] ?? 0) + 1;
    }
  }
  return {
    scoredCases: scores.length,
    ...aggregateChart(scores),
    freeText,
    contextCharted,
    counters,
    dispositionVoiced,
    dispositionTrigger,
    usage,
    escalation,
  };
}

// Table rendering (numbers only)
const fmt = (n: number | null): string => (n === null ? '   —' : n.toFixed(3).replace(/^0\./, ' .'));

export function formatSummary(agg: AggregateSummary): string {
  const lines: string[] = [];
  lines.push(`scored cases: ${agg.scoredCases}`);
  lines.push('');
  lines.push('section           gold  pred  match  ctxG  ctxC  unvG  unvM      P      R');
  for (const name of SET_SECTIONS) {
    const s = agg.sections[name];
    lines.push(
      `${name.padEnd(16)} ${String(s.gold).padStart(5)} ${String(s.predicted).padStart(5)} ${String(s.matched).padStart(
        6
      )} ${String(s.contextGold).padStart(5)} ${String(s.contextCharted).padStart(5)} ${String(s.unvoicedGold).padStart(
        5
      )} ${String(s.unvoicedMatched).padStart(5)}  ${fmt(s.precision).padStart(5)}  ${fmt(s.recall).padStart(5)}`
    );
  }
  lines.push('');
  lines.push(
    `E&M: gold ${agg.em.goldCases} cases, predicted ${agg.em.predictedCases}, exact match ${agg.em.matched}` +
      (agg.em.goldCases > 0 ? ` (${((agg.em.matched / agg.em.goldCases) * 100).toFixed(0)}%)` : '') +
      `, level match ${agg.em.levelMatched}` +
      (agg.em.goldCases > 0 ? ` (${((agg.em.levelMatched / agg.em.goldCases) * 100).toFixed(0)}%)` : '')
  );
  const pdx = agg.primaryDx;
  lines.push(
    `primary dx: gold ${pdx.goldCases} cases, both charted ${pdx.bothPresent}, match ${pdx.matched} | ` +
      (pdx.voicedBoth + pdx.unvoicedGold > 0
        ? `voiced-scoped ${pdx.voicedMatched}/${pdx.voicedBoth}`
        : 'voiced-scoped — (no voicing tags)')
  );
  lines.push(
    `ROS polarity agree ${agg.rosPolarity.agree}/${agg.rosPolarity.matched}; exam abnormal agree ${agg.examAbnormal.agree}/${agg.examAbnormal.matched}`
  );
  lines.push(
    `meds combined: pred ${agg.medsCombined.predicted}, matched ${agg.medsCombined.matched}, ctx ${
      agg.medsCombined.contextCharted
    }, P ${fmt(agg.medsCombined.precision).trim()}`
  );
  lines.push(
    `meds voicing: legacyVoiced ${agg.medsVoicing.legacyVoiced}; commitment coverage ${agg.medsVoicing.intentCovered}/${agg.medsVoicing.intentVoiced}` +
      (agg.medsVoicing.intentVoiced > 0
        ? ` (${((agg.medsVoicing.intentCovered / agg.medsVoicing.intentVoiced) * 100).toFixed(0)}%)`
        : '')
  );
  lines.push('');
  lines.push(
    `context items charted: labOrderDx ${agg.contextCharted.labOrderDiagnoses}, conditions ${agg.contextCharted.conditionsMatchingHistory}, allergies ${agg.contextCharted.allergiesMatchingPrior}, reconciledMeds ${agg.contextCharted.medsMatchingReconciled}`
  );
  lines.push(
    `counters: templates ${agg.counters.templatesApplied}, examComments ${agg.counters.examComments}, providerNotes ${agg.counters.providerNotes}, instructions gold/pred ${agg.counters.goldInstructions}/${agg.counters.predictedInstructions}, disposition gold/pred ${agg.counters.goldDisposition}/${agg.counters.predictedDisposition}`
  );
  const dv = agg.dispositionVoiced;
  lines.push(
    `disposition: charted ${agg.counters.predictedDisposition}/${agg.counters.goldDisposition} raw | ` +
      (dv.voicedGold + dv.unvoicedGold > 0
        ? `voiced-scoped ${dv.voicedPredicted}/${dv.voicedGold} (unvoiced gold ${dv.unvoicedGold}` +
          `${dv.noData > 0 ? `, untagged ${dv.noData}` : ''})`
        : `voiced-scoped — (no voicing tags on ${dv.noData} gold dispositions)`)
  );
  const dt = agg.dispositionTrigger;
  lines.push(
    `disposition trigger: fired&proposed ${dt.firedProposed}, fired&declined ${dt.firedDeclined}, not fired ${dt.notFired}, no data ${dt.noData}`
  );
  const dtPatterns = Object.entries(dt.firedByPattern).sort((a, b) => b[1] - a[1]);
  if (dtPatterns.length > 0) {
    lines.push(`  fired by pattern: ${dtPatterns.map(([p, n]) => `${p} ${n}`).join(', ')}`);
  }
  lines.push('free-text presence (gold / predicted / both):');
  for (const [k, v] of Object.entries(agg.freeText)) {
    lines.push(`  ${k.padEnd(24)} ${v.goldPresent} / ${v.predictedPresent} / ${v.bothPresent}`);
  }
  const u = agg.usage;
  lines.push(
    `usage: ${u.calls} calls, in ${u.inputTokens}, out ${u.outputTokens}, cacheR ${u.cacheReadTokens}, cacheW ${u.cacheWriteTokens}, think ${u.thinkingTokens}`
  );
  // Failure rate over cases with escalation data only; "no data" is never a denominator.
  const e = agg.escalation;
  const withData = e.primaryOk + e.primaryFailed;
  if (withData === 0) {
    lines.push('escalation: no data');
  } else {
    const byCount = (rec: Record<string, number>): string =>
      Object.entries(rec)
        .sort((a, b) => b[1] - a[1])
        .map(([k, n]) => `${k} ${n}`)
        .join(', ');
    const pct = ((e.primaryFailed / withData) * 100).toFixed(0);
    const reasons = byCount(e.reasons);
    lines.push(
      `escalation: ${byCount(e.okProviders) || 'primary 0'}, backup ${e.primaryFailed} ` +
        `(${pct}% primary failure${reasons ? ` — reasons: ${reasons}` : ''})` +
        (e.noData > 0 ? `, no data ${e.noData}` : '')
    );
  }
  return lines.join('\n');
}

// One-line per-case digest.
export function formatCaseLine(score: CaseScore, planSteps: number): string {
  const f = score;
  const em =
    f.em.gold && f.em.predicted
      ? `em ${f.em.predicted}${f.em.match ? '=' : '≠'}${f.em.gold}`
      : `em ${f.em.predicted ?? '—'}/${f.em.gold ?? '—'}`;
  const prim = f.primaryDx.match === null ? '' : f.primaryDx.match ? ' prim✓' : ' prim✗';
  return (
    `${score.caseId}: plan ${planSteps} steps | ` +
    `dx ${f.diagnoses.matched}/${f.diagnoses.goldInScope} R, ${f.diagnoses.matched}/${Math.max(
      f.diagnoses.predicted - (f.diagnoses.contextCharted ?? 0),
      0
    )} P${prim} | ${em} | ros ${f.ros.matched}/${f.ros.goldInScope} | exam ${f.exam.matched}/${
      f.exam.goldInScope
    } | meds ${f.medsCombined.matched}/${
      f.medsPrescribed.goldInScope + f.medsInHouse.goldInScope + f.immunizations.goldInScope
    }` +
    // Commitment coverage over intent-voiced meds.
    (f.medsPrescribed.intentVoiced > 0
      ? ` | commitCov ${f.medsPrescribed.intentCovered}/${f.medsPrescribed.intentVoiced}`
      : '') +
    // Disposition-trigger suffix: only when it fired (✓ proposed / ✗ declined).
    (score.dispositionTrigger?.fired ? ` | dispo:fired${score.dispositionTrigger.modelProposed ? '✓' : '✗'}` : '')
  );
}

// Self-test on synthetic fixtures (invented data only, no harvested content)
function emptyGold(): GoldData {
  return {
    reviewOfSystems: { observations: [] },
    exam: [],
    assessment: { diagnoses: [] },
    billing: { cptCodes: [] },
    medications: { prescribed: [], inHouseAdministered: [], immunizations: [], currentReconciled: [] },
    allergies: [],
    medicalHistory: [],
    surgicalHistory: [],
    hospitalizations: [],
    procedures: [],
    labs: { external: undefined, inHouse: undefined },
    radiology: [],
    vitals: [],
    instructions: [],
  };
}
function goldDx(code: string, display: string, primary = false, fromLabOrder = false, voiced?: boolean): DiagnosisItem {
  return {
    system: 'ICD-10-CM',
    code,
    codeNormalized: normCode(code),
    display,
    primary,
    fromLabOrder,
    // additive tag-voiced.ts field — DiagnosisItem doesn't declare it (see isUnvoiced).
    ...(voiced === undefined ? {} : ({ voiced } as object)),
  };
}

function runSelfTest(): void {
  let failures = 0;
  const check = (label: string, actual: unknown, expected: unknown): void => {
    const ok = JSON.stringify(actual) === JSON.stringify(expected);
    if (!ok) failures++;
    console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}  (got ${JSON.stringify(actual)}, want ${JSON.stringify(expected)})`);
  };

  // Fixture A — scope exclusions + code normalization + med name containment.
  {
    const gold = emptyGold();
    gold.assessment.diagnoses = [goldDx('J06.9', 'Acute URI', true), goldDx('Z11.52', 'Screening', false, true)];
    gold.billing = {
      emCode: { system: 'CPT', code: '99213', codeNormalized: '99213', display: 'E/M 3' },
      cptCodes: [{ system: 'CPT', code: '87880', codeNormalized: '87880', display: 'Rapid strep' }],
    };
    gold.medications.prescribed = [{ name: 'Amoxicillin' }];
    gold.medications.currentReconciled = [{ name: 'Fluticasone', context: true }];
    const st = emptySimState();
    st.diagnoses = [
      { display: 'Acute URI', code: 'j06.9', isPrimary: true }, // lowercase + dot → normalization
      { display: 'Lab screening', code: 'Z1152' }, // fromLabOrder gold → context, not FP
      { display: 'Cough', code: 'R05.9' }, // true FP
    ];
    st.emEvents = [{ code: '99214', display: 'E/M 4' }];
    st.cptCodes = [{ display: 'Rapid strep', code: '87880' }];
    st.medications = [
      { display: 'amoxicillin 400 mg/5 mL suspension' }, // containment either direction
      { display: 'Fluticasone Propionate nasal spray' }, // context med charted anyway
    ];
    const s = scoreCase('fixtureA', gold, st);
    const f = s;
    check('A dx recall', f.diagnoses.recall, 1);
    check('A dx precision (ctx excluded from denom)', f.diagnoses.precision, 0.5);
    check('A dx contextCharted', f.diagnoses.contextCharted, 1);
    check('A primary match', f.primaryDx.match, true);
    check('A em miss', f.em.match, false);
    check('A em level miss (99214 vs 99213)', f.em.levelMatch, false);
    check('A cpt matched', f.cpt.matched, 1);
    check('A meds prescribed recall', f.medsPrescribed.recall, 1);
    check('A meds contextCharted', f.medsCombined.contextCharted, 1);
    check('A meds combined precision', f.medsCombined.precision, 1);
    check('A contextCharted.labOrderDiagnoses', s.contextCharted.labOrderDiagnoses, 1);
  }

  // Fixture B — exam: a field charted twice counts once on both sides, so recall stays within 1.
  {
    const gold = emptyGold();
    gold.exam = [
      { field: 'clear-lungs', label: 'Clear lungs', present: true },
      { field: 'normal-appearance-of-neck', label: 'Normal neck', present: true },
      { field: 'sinus-tenderness', label: 'Sinus tenderness', present: true },
    ];
    const st = emptySimState();
    st.examObservations = [
      { field: 'clear-lungs', label: 'Clear lungs' },
      { field: 'clear-lungs', label: 'Lungs clear bilaterally' }, // same field again
      { field: 'normal-appearance-of-neck', label: 'Normal neck' },
      { field: 'rash', label: 'Rash' }, // FP
      { field: 'rash', label: 'Rash on trunk' }, // same FP field again
    ];
    const s = scoreCase('fixtureB', gold, st);
    check('B exam predicted (distinct fields)', s.exam.predicted, 3);
    check('B exam matched (distinct gold fields)', s.exam.matched, 2);
    check('B exam recall', s.exam.recall, 2 / 3);
    check('B exam precision', s.exam.precision, 2 / 3);
    const agg = aggregateScores([s]);
    check('B agg exam recall', agg.sections.exam.recall, 2 / 3);
  }

  // Fixture C — ROS polarity + exam presence/abnormal agreement.
  {
    const gold = emptyGold();
    gold.reviewOfSystems.observations = [
      { field: rosField('ros-constitutional-fever', RosFindingState.Denies), label: 'Fever', present: true },
      { field: rosField('ros-respiratory-cough', RosFindingState.Reports), label: 'Cough', present: true },
    ];
    gold.exam = [
      {
        field: 'sinus-tenderness',
        label: 'Sinus tenderness',
        present: true,
        components: [{ code: 'sinus-frontal-r', label: 'Right frontal', value: true, abnormal: true }],
      },
      { field: 'normal-appearance-of-neck', label: 'Normal neck', present: true },
      { field: 'unchecked-thing', label: 'Unchecked', present: false }, // out of scope
    ];
    const st = emptySimState();
    st.rosObservations = [
      {
        baseKey: 'ros-constitutional-fever',
        field: rosField('ros-constitutional-fever', RosFindingState.Denies),
        label: 'Fever',
        finding: 'denies',
      },
      {
        baseKey: 'ros-respiratory-cough',
        field: rosField('ros-respiratory-cough', RosFindingState.Denies),
        label: 'Cough',
        finding: 'denies',
      }, // polarity mismatch
      {
        baseKey: 'ros-skin-rash',
        field: rosField('ros-skin-rash', RosFindingState.Denies),
        label: 'Rash',
        finding: 'denies',
      }, // FP
    ];
    st.examObservations = [
      {
        field: 'sinus-tenderness',
        label: 'Sinus tenderness',
        components: [{ code: 'sinus-frontal-r', label: 'Right frontal', abnormal: true }],
      },
      { field: 'clear-lungs', label: 'Clear lungs' }, // FP
    ];
    const s = scoreCase('fixtureC', gold, st);
    const f = s;
    check('C ros matched', f.ros.matched, 2);
    check('C ros polarity agree', f.ros.polarityAgree, 1);
    check('C ros precision', f.ros.precision, 2 / 3);
    check('C exam gold in scope (present:false excluded)', f.exam.goldInScope, 2);
    check('C exam matched', f.exam.matched, 1);
    check('C exam abnormal agree', f.exam.abnormalAgree, 1);

    const agg = aggregateScores([s]);
    check('C agg ros gold', agg.sections.ros.gold, 2);
    console.log('\n--- aggregate table over fixture C only ---');
    console.log(formatSummary(agg));
  }

  // Fixture D — voiced tagging (tag-voiced.ts flags) + E&M level match across families.
  // Mixes per section: voiced:true, voiced:false (unvoiced), and untagged.
  {
    const gold = emptyGold();
    const tag = <T>(item: T, voiced: boolean): T => ({ ...item, voiced }) as T;
    gold.assessment.diagnoses = [
      tag(goldDx('J06.9', 'Acute URI', true), true), // voiced, predicted → matched
      tag(goldDx('K21.9', 'GERD'), false), // unvoiced, predicted → unvoicedMatched, not FP
      goldDx('R05.9', 'Cough'), // untagged, not predicted → recall miss
    ];
    gold.billing = {
      emCode: { system: 'CPT', code: '99204', codeNormalized: '99204', display: 'New pt E/M 4' },
      cptCodes: [tag({ system: 'CPT', code: '87880', codeNormalized: '87880', display: 'Rapid strep' }, false)],
    };
    gold.reviewOfSystems.observations = [
      tag({ field: rosField('ros-constitutional-fever', RosFindingState.Denies), label: 'Fever', present: true }, true),
      tag({ field: rosField('ros-respiratory-cough', RosFindingState.Reports), label: 'Cough', present: true }, false),
      { field: rosField('ros-skin-rash', RosFindingState.Denies), label: 'Rash', present: true }, // untagged
    ];
    gold.exam = [
      tag({ field: 'clear-lungs', label: 'Clear lungs', present: true }, true),
      tag({ field: 'sinus-tenderness', label: 'Sinus tenderness', present: true }, false),
    ];
    gold.medications.prescribed = [tag({ name: 'Amoxicillin' }, true), tag({ name: 'Cetirizine' }, false)];

    const st = emptySimState();
    st.diagnoses = [
      { display: 'Acute URI', code: 'J06.9', isPrimary: true },
      { display: 'GERD', code: 'K21.9' }, // matches unvoiced gold
      { display: 'Asthma', code: 'J45.909' }, // true FP
    ];
    st.emEvents = [{ code: '99214', display: 'E/M 4' }]; // wrong family, right level
    st.cptCodes = [{ display: 'Rapid strep', code: '87880' }]; // matches unvoiced gold
    st.rosObservations = [
      {
        baseKey: 'ros-constitutional-fever',
        field: rosField('ros-constitutional-fever', RosFindingState.Denies),
        label: 'Fever',
        finding: 'denies',
      },
      {
        baseKey: 'ros-respiratory-cough',
        field: rosField('ros-respiratory-cough', RosFindingState.Denies),
        label: 'Cough',
        finding: 'denies',
      }, // matches unvoiced gold
    ];
    st.examObservations = [
      { field: 'clear-lungs', label: 'Clear lungs' },
      { field: 'sinus-tenderness', label: 'Sinus tenderness' }, // matches unvoiced gold
    ];
    st.medications = [
      { display: 'Amoxicillin 400 mg' },
      { display: 'Cetirizine 10 mg' }, // matches unvoiced gold
    ];

    const s = scoreCase('fixtureD', gold, st);
    const f = s;
    check('D dx goldInScope (unvoiced excluded, untagged kept)', f.diagnoses.goldInScope, 2);
    check('D dx unvoicedGold', f.diagnoses.unvoicedGold, 1);
    check('D dx unvoicedMatched', f.diagnoses.unvoicedMatched, 1);
    check('D dx recall (1 of voiced+untagged)', f.diagnoses.recall, 0.5);
    check('D dx precision (unvoicedMatched excluded from denom)', f.diagnoses.precision, 0.5);
    check('D em exact miss (family)', f.em.match, false);
    check('D em level match (99204 vs 99214)', f.em.levelMatch, true);
    check('D cpt goldInScope 0 → recall null', f.cpt.recall, null);
    check('D cpt unvoicedMatched', f.cpt.unvoicedMatched, 1);
    check('D cpt precision null (denom emptied by unvoiced)', f.cpt.precision, null);
    check('D ros goldInScope', f.ros.goldInScope, 2);
    check('D ros matched (voiced only)', f.ros.matched, 1);
    check('D ros polarity agree', f.ros.polarityAgree, 1);
    check('D ros unvoicedMatched', f.ros.unvoicedMatched, 1);
    check('D ros precision', f.ros.precision, 1);
    check('D exam recall (voiced-only denominator)', f.exam.recall, 1);
    check('D exam unvoicedMatched', f.exam.unvoicedMatched, 1);
    check('D meds prescribed recall (voiced only)', f.medsPrescribed.recall, 1);
    check('D meds prescribed unvoicedGold', f.medsPrescribed.unvoicedGold, 1);
    check('D medsCombined precision (unvoiced excluded)', f.medsCombined.precision, 1);

    const agg = aggregateScores([s]);
    check('D agg em levelMatched', agg.em.levelMatched, 1);
    check('D agg dx unvoicedGold', agg.sections.diagnoses.unvoicedGold, 1);
    check('D agg dx precision', agg.sections.diagnoses.precision, 0.5);
  }

  // Fixture E — prescribed-med voicing fidelity (nameVoiced) + commitment coverage.
  {
    const gold = emptyGold();
    type GoldMed = (typeof gold.medications.prescribed)[number];
    const med = (m: { name: string; voiced?: boolean; nameVoiced?: boolean; voicedEvidence?: string }): GoldMed =>
      m as GoldMed;
    gold.medications.prescribed = [
      med({ name: 'Amoxicillin', voiced: true, nameVoiced: true }), // name spoken, charted → matched
      med({ name: 'Cetirizine', voiced: true, nameVoiced: true }), // name spoken, not charted → recall miss
      med({ name: 'Prednisone', voiced: true }), // legacy-tagged, charted → matched + legacyVoiced
      // intent — covered by instruction token "cough"
      med({
        name: 'Benzonatate',
        voiced: true,
        nameVoiced: false,
        voicedEvidence: 'give you a medication for the cough',
      }),
      // intent — covered by a charted matching med
      med({ name: 'Cephalexin', voiced: true, nameVoiced: false, voicedEvidence: 'get you on an antibiotic' }),
      // intent — covered via prefix match ("allergies" / "allergy")
      med({
        name: 'Loratadine',
        voiced: true,
        nameVoiced: false,
        voicedEvidence: 'over the counter drop for allergies',
      }),
      // intent — uncovered (evidence is all stopwords, name never in notes)
      med({ name: 'Azithromycin', voiced: true, nameVoiced: false, voicedEvidence: 'treat you either way' }),
      med({ name: 'Fluticasone', voiced: false }), // unvoiced, charted → unvoicedMatched
    ];
    const st = emptySimState();
    st.medications = [
      { display: 'Amoxicillin 400 mg' },
      { display: 'Prednisone 10 mg' },
      { display: 'Cephalexin 500 mg' },
      { display: 'Fluticasone Propionate nasal spray' },
      { display: 'Ibuprofen' }, // true FP
    ];
    st.instructions = ['Take the cough medicine as directed', 'Use allergy eye drops as needed'];
    const s = scoreCase('fixtureE', gold, st);
    const f = s;
    check('E meds goldInScope (nameVoiced + legacy only)', f.medsPrescribed.goldInScope, 3);
    check('E meds matched', f.medsPrescribed.matched, 2);
    check('E meds recall', f.medsPrescribed.recall, 2 / 3);
    check('E meds legacyVoiced', f.medsPrescribed.legacyVoiced, 1);
    check('E meds intentVoiced', f.medsPrescribed.intentVoiced, 4);
    check('E meds intentCovered (med + note + prefix)', f.medsPrescribed.intentCovered, 3);
    check('E meds unvoicedGold', f.medsPrescribed.unvoicedGold, 1);
    check('E meds unvoicedMatched', f.medsPrescribed.unvoicedMatched, 1);
    check('E medsCombined intentMatched', f.medsCombined.intentMatched, 1);
    check('E medsCombined precision (intent+unvoiced excluded)', f.medsCombined.precision, 2 / 3);
    check('E case line shows commitCov', formatCaseLine(s, 0).includes('commitCov 3/4'), true);

    const agg = aggregateScores([s]);
    check('E agg medsVoicing', agg.medsVoicing, { legacyVoiced: 1, intentVoiced: 4, intentCovered: 3 });
    check('E agg medsCombined precision', agg.medsCombined.precision, 2 / 3);
    check(
      'E agg summary has commitment coverage line',
      formatSummary(agg).includes('commitment coverage 3/4 (75%)'),
      true
    );
  }

  // Fixture F — disposition-trigger observability: pass-through, buckets, and case-line suffix
  // (no metric impact anywhere).
  {
    const gold = emptyGold();
    const st = emptySimState();
    const proposed = scoreCase('fixtureF1', gold, st, undefined, {
      fired: true,
      matchedPattern: 'discharge-home',
      modelProposed: true,
    });
    const declined = scoreCase('fixtureF2', gold, st, undefined, { fired: true, modelProposed: false });
    const notFired = scoreCase('fixtureF3', gold, st, undefined, { fired: false, modelProposed: false });
    const nullTrigger = scoreCase('fixtureF4', gold, st, undefined, null); // response lacked the field
    const noTrigger = scoreCase('fixtureF5', gold, st); // no trigger passed: no key at all
    check('F stashed on score', proposed.dispositionTrigger, {
      fired: true,
      matchedPattern: 'discharge-home',
      modelProposed: true,
    });
    check('F null persisted as null', nullTrigger.dispositionTrigger, null);
    check('F no-trigger score omits the key', 'dispositionTrigger' in noTrigger, false);
    check('F case line proposed suffix', formatCaseLine(proposed, 0).endsWith(' | dispo:fired✓'), true);
    check('F case line declined suffix', formatCaseLine(declined, 0).endsWith(' | dispo:fired✗'), true);
    check('F case line silent when not fired', formatCaseLine(notFired, 0).includes('dispo:'), false);
    check('F case line silent without a trigger', formatCaseLine(noTrigger, 0).includes('dispo:'), false);
    const agg = aggregateScores([proposed, declined, notFired, nullTrigger, noTrigger]);
    check('F agg buckets', agg.dispositionTrigger, {
      firedProposed: 1,
      firedDeclined: 1,
      notFired: 1,
      noData: 2,
      firedByPattern: { 'discharge-home': 1, '(unspecified)': 1 },
    });
    const summaryText = formatSummary(agg);
    check(
      'F summary trigger line',
      summaryText.includes('disposition trigger: fired&proposed 1, fired&declined 1, not fired 1, no data 2'),
      true
    );
    check('F summary pattern line', summaryText.includes('fired by pattern: discharge-home 1, (unspecified) 1'), true);
    check(
      'F summary omits pattern line when nothing fired',
      formatSummary(aggregateScores([notFired, noTrigger])).includes('fired by pattern'),
      false
    );
  }

  // Fixture G — voiced-scoped disposition metric (dispositionVoiced tag on gold.disposition):
  // raw counter untouched, tagged/untagged bucketing, and the summary line in both modes.
  {
    const goldWithDispo = (dispositionVoiced?: boolean): GoldData => {
      const g = emptyGold();
      g.disposition = {
        type: 'pcp-no-type',
        note: 'Follow up with your PCP',
        ...(dispositionVoiced === undefined ? {} : ({ dispositionVoiced } as object)),
      };
      return g;
    };
    const charted = emptySimState();
    charted.disposition = { type: 'pcp-no-type', text: 'Follow up in 3 days' };
    const voicedHit = scoreCase('fixtureG1', goldWithDispo(true), charted); // voiced + predicted
    const voicedMiss = scoreCase('fixtureG2', goldWithDispo(true), emptySimState()); // voiced, not predicted
    const unvoiced = scoreCase('fixtureG3', goldWithDispo(false), charted); // unvoiced + predicted
    const untagged = scoreCase('fixtureG4', goldWithDispo(undefined), charted); // gold dispo, no tag
    const noGoldDispo = scoreCase('fixtureG5', emptyGold(), charted); // no gold dispo at all
    check('G tag stashed on counters', voicedHit.counters.goldDispositionVoiced, true);
    check('G untagged score omits the key (byte-identical)', 'goldDispositionVoiced' in untagged.counters, false);
    const agg = aggregateScores([voicedHit, voicedMiss, unvoiced, untagged, noGoldDispo]);
    check('G raw counters unchanged', [agg.counters.goldDisposition, agg.counters.predictedDisposition], [4, 4]);
    check('G agg buckets', agg.dispositionVoiced, { voicedGold: 2, voicedPredicted: 1, unvoicedGold: 1, noData: 1 });
    check(
      'G summary line (tagged corpus)',
      formatSummary(agg).includes('disposition: charted 4/4 raw | voiced-scoped 1/2 (unvoiced gold 1, untagged 1)'),
      true
    );
    const aggUntagged = aggregateScores([untagged]);
    check('G untagged corpus goes to noData', aggUntagged.dispositionVoiced, {
      voicedGold: 0,
      voicedPredicted: 0,
      unvoicedGold: 0,
      noData: 1,
    });
    check(
      'G summary line (untagged corpus)',
      formatSummary(aggUntagged).includes(
        'disposition: charted 1/1 raw | voiced-scoped — (no voicing tags on 1 gold dispositions)'
      ),
      true
    );
  }

  // Fixture H — voiced-scoped primary-dx metric (voiced tag on the gold primary): raw comparison
  // untouched, tagged/untagged bucketing, and the summary line in both modes.
  {
    const goldWithPrimary = (voiced?: boolean): GoldData => {
      const g = emptyGold();
      g.assessment.diagnoses = [goldDx('J06.9', 'Acute URI', true, false, voiced)];
      return g;
    };
    const chartedMatch = emptySimState();
    chartedMatch.diagnoses = [{ display: 'Acute URI', code: 'J06.9', isPrimary: true }];
    const chartedMiss = emptySimState();
    chartedMiss.diagnoses = [{ display: 'GERD', code: 'K21.9', isPrimary: true }];
    const voicedHit = scoreCase('fixtureH1', goldWithPrimary(true), chartedMatch); // voiced + matched
    const voicedMiss = scoreCase('fixtureH2', goldWithPrimary(true), chartedMiss); // voiced + mismatched
    const unvoicedMiss = scoreCase('fixtureH3', goldWithPrimary(false), chartedMiss); // unvoiced + mismatched
    const untagged = scoreCase('fixtureH4', goldWithPrimary(undefined), chartedMatch); // no tag
    check('H tag stashed on score', voicedHit.primaryDx.goldVoiced, true);
    check('H unvoiced raw match stays voicing-blind', unvoicedMiss.primaryDx.match, false);
    check('H untagged score omits the key (byte-identical)', 'goldVoiced' in untagged.primaryDx, false);
    const agg = aggregateScores([voicedHit, voicedMiss, unvoicedMiss, untagged]);
    check('H agg buckets (unvoiced NOT in voicedBoth)', agg.primaryDx, {
      goldCases: 4,
      bothPresent: 4,
      matched: 2,
      voicedBoth: 2,
      voicedMatched: 1,
      unvoicedGold: 1,
      noData: 1,
    });
    check(
      'H summary line (tagged corpus)',
      formatSummary(agg).includes('primary dx: gold 4 cases, both charted 4, match 2 | voiced-scoped 1/2'),
      true
    );
    check(
      'H summary line (untagged corpus)',
      formatSummary(aggregateScores([untagged])).includes(
        'primary dx: gold 1 cases, both charted 1, match 1 | voiced-scoped — (no voicing tags)'
      ),
      true
    );
  }

  // Fixture I — primary→backup escalation: pass-through on the score, buckets including no-data, and the
  // summary line in both modes.
  {
    const gold = emptyGold();
    const st = emptySimState();
    const mkUsage = (provider: 'gemini' | 'claude', escalation?: EvalTokenUsage['escalation']): EvalTokenUsage => ({
      provider,
      inputTokens: 100,
      outputTokens: 50,
      ...(escalation ? { escalation } : {}),
    });
    const ok = scoreCase('fixtureI1', gold, st, mkUsage('gemini', { primaryFailed: false, primaryAttempts: 1 }));
    const failed = scoreCase(
      'fixtureI2',
      gold,
      st,
      mkUsage('claude', { primaryFailed: true, primaryAttempts: 1, reason: 'timeout' })
    );
    // Usage present, no escalation key.
    const noEscalation = scoreCase('fixtureI3', gold, st, mkUsage('gemini'));
    const noUsage = scoreCase('fixtureI4', gold, st); // no usage at all: excluded, not even no-data
    check('I escalation stashed on score usage', ok.usage?.escalation, {
      primaryFailed: false,
      primaryAttempts: 1,
    });
    check('I usage without escalation omits the key', 'escalation' in (noEscalation.usage ?? {}), false);
    const agg = aggregateScores([ok, failed, noEscalation, noUsage]);
    check('I agg buckets', agg.escalation, {
      primaryOk: 1,
      primaryFailed: 1,
      reasons: { timeout: 1 },
      okProviders: { gemini: 1 },
      noData: 1,
    });
    check('I agg usage calls (absent calls count as one)', agg.usage.calls, 3);
    check(
      'I summary escalation line',
      formatSummary(agg).includes(
        'escalation: gemini 1, backup 1 (50% primary failure — reasons: timeout 1), no data 1'
      ),
      true
    );
    const aggNoData = aggregateScores([noEscalation, noUsage]);
    check('I no escalation data goes to noData', aggNoData.escalation, {
      primaryOk: 0,
      primaryFailed: 0,
      reasons: {},
      okProviders: {},
      noData: 1,
    });
    check('I summary no-data mode', formatSummary(aggNoData).includes('escalation: no data'), true);
  }

  console.log(failures === 0 ? '\nSELF-TEST PASS' : `\nSELF-TEST FAIL (${failures} failing checks)`);
  if (failures > 0) process.exit(1);
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) {
  if (process.argv[2] === '--self-test') {
    runSelfTest();
  } else {
    console.error('Usage: npx tsx tools/easy-chart-eval/score-harvested.ts --self-test');
    process.exit(1);
  }
}
