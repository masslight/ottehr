/**
 * score-harvested.ts — deterministic scorer for harvested-case eval runs (no LLM).
 *
 * Compares a simulated charted state (built by run-harvested-eval.ts from planner steps +
 * applied review suggestions) against the provider-charted structured gold (harvest-shared.ts).
 * Every metric is computed twice: once over the PLANNER-ONLY output and once over the FINAL
 * post-review state, so the review pass's net contribution is visible per section.
 *
 * Scope rule: gold items flagged `context: true` (prior-chart history) and diagnoses flagged
 * `fromLabOrder` are NOT transcript-derivable — they are excluded from recall denominators, and
 * a predicted item that matches one is not a false positive either (it is counted separately as
 * "context items charted" and excluded from the precision denominator).
 *
 * Voiced scoping: tag-voiced.ts stamps an additive per-item `voiced: boolean` (LLM judge:
 * "stated or clearly implied in the dictation") onto gold diagnoses / ROS / exam / CPT /
 * prescribed-med items. When present, `voiced: false` items leave the recall denominator
 * (reported as unvoicedGold) and a prediction matching one is treated like context (counted as
 * unvoicedMatched, excluded from the precision denominator). Items WITHOUT the flag keep the
 * legacy behavior, so scoring works on untagged case files.
 *
 * Med voicing fidelity: prescribed meds additionally carry `nameVoiced` (tag-voiced.ts) — the
 * drug's NAME was spoken, not just a class/commitment ("an antibiotic"). Recall scopes to
 * nameVoiced meds; voiced meds with nameVoiced ABSENT (legacy-tagged) keep the old behavior and
 * are counted as legacyVoiced. Intent-voiced meds (voiced && nameVoiced === false) get their own
 * commitment-coverage metric: covered when the final state charts a matching med OR any
 * provider-note/instruction shares a substantive token with the med's name/voicedEvidence.
 *
 * Disposition voicing: gold.disposition additionally carries `dispositionVoiced` (tag-voiced.ts)
 * — a listener could learn the disposition plan from the transcript alone. Providers set a
 * disposition on ~every visit but voice it in only a small minority of transcripts, so the raw
 * charted-disposition counter mostly measures guessing. The voiced-scoped metric (denominator =
 * cases whose gold disposition is voiced) is reported ALONGSIDE the raw counter; gold
 * dispositions without the tag land in a no-data bucket and scoring stays byte-identical for
 * untagged corpora.
 *
 * Usable three ways:
 *   - imported by run-harvested-eval.ts (scoreCase / aggregateScores / formatSummary)
 *   - standalone re-score of an existing results dir:
 *       npx tsx scripts/easy-chart-eval/score-harvested.ts [resultsDir] [casesDir]
 *   - synthetic-fixture self-test (no case data touched):
 *       npx tsx scripts/easy-chart-eval/score-harvested.ts --self-test
 */
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { pathToFileURL } from 'url';
import { EasyChartTokenUsage, rosField, RosFindingState } from 'utils';
import { DiagnosisItem, ExamItem, GoldData } from './harvest-shared';

// ---------------------------------------------------------------------------
// Simulated charted-state types — produced by run-harvested-eval.ts, persisted in
// caseNNN.result.json, consumed here. Every item carries provenance (`source`) and
// soft-delete flags (`removed`/`removedBy`) so both scopes can be reconstructed.
// ---------------------------------------------------------------------------
export type SimSource = 'planner' | 'review';

export interface SimItem {
  display: string;
  code?: string;
  source: SimSource;
  removed?: boolean;
  removedBy?: SimSource;
}
export interface SimDiagnosis extends SimItem {
  isPrimary?: boolean;
  // Set when the review-phase primary-dx safety net (pickPrimaryPromotion) flipped this dx to
  // primary — a review-provenance mutation even on a planner-sourced dx, so the plannerOnly
  // scope must ignore the promoted flag.
  promotedPrimaryBy?: SimSource;
}
export interface SimMedication extends SimItem {
  strength?: string;
}
export interface SimExamComponent {
  code: string;
  label: string;
  abnormal?: boolean;
  source: SimSource;
  removed?: boolean;
  removedBy?: SimSource;
}
export interface SimExamObs {
  field: string;
  label: string;
  components?: SimExamComponent[];
  source: SimSource;
  removed?: boolean;
  removedBy?: SimSource;
}
export interface SimRosObs {
  baseKey: string;
  field: string;
  label: string;
  finding: 'reports' | 'denies';
  source: SimSource;
  removed?: boolean;
  removedBy?: SimSource;
}
export interface SimEmEvent {
  type: 'set' | 'remove';
  code?: string;
  display?: string;
  source: SimSource;
}
export interface SimNoteText {
  text: string;
  source: SimSource;
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
  examComments: { section: string; text: string; source: SimSource }[];
  rosObservations: SimRosObs[];
  conditions: SimItem[];
  allergies: SimItem[];
  surgicalHistory: SimItem[];
  hospitalizations: SimItem[];
  // Keyed by the model-visible note field names (edit-note-text's field enum).
  noteText: Partial<
    Record<'chiefComplaint' | 'historyOfPresentIllness' | 'mechanismOfInjury' | 'ros' | 'medicalDecision', SimNoteText>
  >;
  // Review edit-note-text on a non-empty field is queued for confirmation, never auto-applied
  // (mirrors the client's pendingNoteEdits) — recorded here, NOT folded into noteText.
  pendingNoteEdits: { field: string; newText: string; source: SimSource }[];
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
    pendingNoteEdits: [],
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

export interface CaseUsage {
  planner?: EasyChartTokenUsage;
  review?: EasyChartTokenUsage;
}

// Disposition-check observability passed through verbatim from the review response (mirrors
// EasyChartReviewOutput.dispositionTrigger in packages/utils). On a CaseScore: `null` = the
// review response carried no trigger info (older zambda); field absent = the run predates the
// field entirely — the aggregate's no-data bucket covers both.
export interface DispositionTriggerInfo {
  fired: boolean;
  matchedPattern?: string;
  modelProposed: boolean;
}

// ---------------------------------------------------------------------------
// Score shapes
// ---------------------------------------------------------------------------
export interface SectionScore {
  goldInScope: number;
  predicted: number;
  matched: number;
  contextGold?: number;
  contextCharted?: number;
  // voiced-tagging (tag-voiced.ts): gold items judged NOT transcript-derivable, and predictions
  // that matched one (excluded from the precision denominator, like context).
  unvoicedGold?: number;
  unvoicedMatched?: number;
  precision: number | null;
  recall: number | null;
}
export interface ScopeScores {
  diagnoses: SectionScore & { predictedNoCode: number };
  primaryDx: { goldCode?: string; predictedCode?: string; match: boolean | null };
  // levelMatch compares the E&M *level* (last digit — 9920x/9921x share levels) so a new-vs-
  // established family error doesn't hide correct complexity selection.
  em: { gold?: string; predicted?: string; match: boolean | null; levelMatch: boolean | null };
  cpt: SectionScore;
  ros: SectionScore & { polarityAgree: number };
  exam: SectionScore & { abnormalAgree: number };
  // legacyVoiced: voiced meds tagged before nameVoiced existed (still in the recall denominator).
  // intentVoiced/intentCovered: commitment coverage over intent-voiced meds (see header).
  medsPrescribed: SectionScore & { legacyVoiced: number; intentVoiced: number; intentCovered: number };
  medsInHouse: SectionScore;
  immunizations: SectionScore;
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
export interface CaseScore {
  caseId: string;
  scopes: { plannerOnly: ScopeScores; final: ScopeScores };
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
    pendingNoteEdits: number;
    providerNotes: number;
    predictedConditions: number;
    predictedAllergies: number;
    goldInstructions: number;
    predictedInstructions: number;
    goldDisposition: boolean;
    predictedDisposition: boolean;
    // tag-voiced.ts `dispositionVoiced` on gold.disposition, additive like `voiced`: ABSENT when
    // the corpus is untagged (keeps untagged score files byte-identical).
    goldDispositionVoiced?: boolean;
    // remove-* steps whose target wasn't on the simulated chart (planner hallucinated a removal).
    removeTargetMissing: number;
  };
  usage?: CaseUsage;
  dispositionTrigger?: DispositionTriggerInfo | null;
}

// ---------------------------------------------------------------------------
// Normalization / matching helpers
// ---------------------------------------------------------------------------
// Mirrors normalizeCode in harvest-prod-cases.ts (that file self-executes, so it can't be
// imported) and the CodeItem.codeNormalized contract in harvest-shared.ts.
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

type Scope = 'plannerOnly' | 'final';
function inScope<T extends { source: SimSource; removed?: boolean; removedBy?: SimSource }>(
  items: T[],
  scope: Scope
): T[] {
  return scope === 'plannerOnly'
    ? items.filter((i) => i.source === 'planner' && !(i.removed && i.removedBy === 'planner'))
    : items.filter((i) => !i.removed);
}
// Exam obs are in scope when the observation OR any of its components belongs to the scope
// (a review modal-option can land on a planner-created parent observation).
function examInScope(obs: SimExamObs[], scope: Scope): SimExamObs[] {
  if (scope === 'final') return obs.filter((o) => !o.removed);
  return obs.filter(
    (o) =>
      !(o.removed && o.removedBy === 'planner') &&
      (o.source === 'planner' || (o.components ?? []).some((c) => c.source === 'planner' && !c.removed))
  );
}
function emForScope(events: SimEmEvent[], scope: Scope): { code?: string; display?: string } | undefined {
  let cur: { code?: string; display?: string } | undefined;
  for (const e of events) {
    if (scope === 'plannerOnly' && e.source !== 'planner') continue;
    cur = e.type === 'set' ? { code: e.code, display: e.display } : undefined;
  }
  return cur;
}

// `voiced` / `voicedEvidence` are additive fields stamped by tag-voiced.ts; the harvest-shared
// types (owned elsewhere) don't declare them, so read the flag loosely. Only an explicit
// `voiced: false` changes behavior — absent/true keeps the item in scope.
export function isUnvoiced(item: unknown): boolean {
  return (item as { voiced?: boolean }).voiced === false;
}

// Prescribed-med voicing fidelity (tag-voiced.ts `nameVoiced`, additive like `voiced`):
// intent-voiced = the commitment/class was spoken but not the drug's name — structurally
// impossible for a scribe to chart as a med, so it leaves the recall denominator and is scored
// via commitment coverage instead. voiced:true with nameVoiced ABSENT = legacy-tagged (keeps the
// old in-denominator behavior, surfaced as legacyVoiced).
type VoicedMed = { voiced?: boolean; nameVoiced?: boolean; voicedEvidence?: string; name?: string };
export function isIntentVoiced(item: unknown): boolean {
  const m = item as VoicedMed;
  return m.voiced === true && m.nameVoiced === false;
}
export function isLegacyVoiced(item: unknown): boolean {
  const m = item as VoicedMed;
  return m.voiced === true && typeof m.nameVoiced !== 'boolean';
}

// Commitment-coverage token matching — deliberately generous but deterministic: drop function
// words, prescribing verbs, and dose-form/schedule qualifiers; KEEP class words (antibiotic,
// nasal, spray, cough...) since those are the pointer the provider actually voiced.
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

// ---------------------------------------------------------------------------
// Per-scope section scoring
// ---------------------------------------------------------------------------
function scoreScope(gold: GoldData, state: SimFinalState, scope: Scope): ScopeScores {
  // --- diagnoses (match key: codeNormalized) ---
  const goldDx = gold.assessment.diagnoses;
  const goldDxScorable = goldDx.filter((d) => !d.fromLabOrder);
  const goldDxInScope = goldDxScorable.filter((d) => !isUnvoiced(d));
  const goldDxUnvoiced = goldDxScorable.filter(isUnvoiced);
  const goldDxContext = goldDx.filter((d) => d.fromLabOrder);
  const predDx = inScope(state.diagnoses, scope);
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

  // --- primary dx (reported separately from set membership; voiced flag not applied — the
  // charted primary is the comparison target regardless of derivability) ---
  const goldPrimary = goldDxScorable.find((d) => d.primary);
  // A review-promoted primary (promotedPrimaryBy) can sit on a planner-sourced dx — exclude it
  // from the plannerOnly scope so the review safety net never inflates planner-only metrics.
  const predPrimary = predDx.find((d) => d.isPrimary && !(scope === 'plannerOnly' && d.promotedPrimaryBy === 'review'));
  const primaryDx = {
    ...(goldPrimary ? { goldCode: goldPrimary.codeNormalized } : {}),
    ...(predPrimary?.code ? { predictedCode: normCode(predPrimary.code) } : {}),
    match: goldPrimary && predPrimary?.code ? normCode(predPrimary.code) === goldPrimary.codeNormalized : null,
  };

  // --- E&M (exact code, plus level = last digit so 9920x/9921x family errors don't hide
  // correct visit-complexity selection) ---
  const goldEm = gold.billing.emCode?.code;
  const predEm = emForScope(state.emEvents, scope)?.code;
  const em = {
    ...(goldEm ? { gold: goldEm } : {}),
    ...(predEm ? { predicted: predEm } : {}),
    match: goldEm && predEm ? goldEm === predEm : null,
    levelMatch: goldEm && predEm ? goldEm.slice(-1) === predEm.slice(-1) : null,
  };

  // --- CPT (codeNormalized set) ---
  const goldCpt = new Set(gold.billing.cptCodes.filter((c) => !isUnvoiced(c)).map((c) => c.codeNormalized));
  const goldCptUnvoiced = new Set(gold.billing.cptCodes.filter(isUnvoiced).map((c) => c.codeNormalized));
  const predCpt = new Set(
    inScope(state.cptCodes, scope)
      .map((c) => normCode(c.code))
      .filter(Boolean)
  );
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

  // --- ROS (presence by base field key; polarity agreement reported separately) ---
  const goldRos = new Map<string, 'denies' | 'reports' | undefined>();
  const goldRosUnvoiced = new Set<string>();
  for (const o of gold.reviewOfSystems.observations) {
    if (o.present !== true) continue;
    const { base, polarity } = rosBaseAndPolarity(o.field);
    if (isUnvoiced(o)) goldRosUnvoiced.add(base);
    else goldRos.set(base, polarity);
  }
  const predRos = new Map<string, 'denies' | 'reports'>();
  for (const o of inScope(state.rosObservations, scope)) predRos.set(o.baseKey, o.finding);
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

  // --- exam (presence by field; abnormal agreement — derived from checked components on BOTH
  // sides, since the gold's abnormal flag only comes from component-level data) ---
  const goldExam = new Map<string, ExamItem>();
  const goldExamUnvoiced = new Set<string>();
  for (const o of gold.exam) {
    if (o.present !== true) continue;
    if (isUnvoiced(o)) goldExamUnvoiced.add(o.field);
    else goldExam.set(o.field, o);
  }
  const predExam = examInScope(state.examObservations, scope);
  let examMatched = 0;
  let abnormalAgree = 0;
  let examUnvoicedMatched = 0;
  for (const o of predExam) {
    const g = goldExam.get(o.field);
    if (!g) {
      if (goldExamUnvoiced.has(o.field)) examUnvoicedMatched++;
      continue;
    }
    examMatched++;
    const goldAbnormal = (g.components ?? []).some((c) => c.value === true && c.abnormal === true);
    const predAbnormal = (o.components ?? []).some((c) => !c.removed && c.abnormal === true);
    if (goldAbnormal === predAbnormal) abnormalAgree++;
  }
  const exam = {
    ...mkSection(
      goldExam.size,
      predExam.length,
      examMatched,
      undefined,
      undefined,
      goldExamUnvoiced.size,
      examUnvoicedMatched
    ),
    abnormalAgree,
  };

  // --- medications (name-only, shared predicted pool; greedy: prescribed → in-house →
  // immunizations → context reconciled, each predicted item consumed at most once) ---
  const pool = inScope(state.medications, scope).map((m) => ({ display: m.display, used: false }));
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
  // Scorable = voiced-with-name-spoken (nameVoiced true), legacy-voiced (tagged before
  // nameVoiced existed — old behavior, counted as legacyVoiced), and untagged.
  const prescribedScorable = gold.medications.prescribed.filter((m) => !isUnvoiced(m) && !isIntentVoiced(m));
  const prescribedIntent = gold.medications.prescribed.filter(isIntentVoiced);
  const prescribedUnvoiced = gold.medications.prescribed.filter(isUnvoiced);
  const prescribedMatched = consume(prescribedScorable.map((m) => m.name));
  const inHouseMatched = consume(gold.medications.inHouseAdministered.map((m) => m.name));
  const immunizationsMatched = consume(gold.medications.immunizations.map((m) => m.name));
  // Intent-voiced and unvoiced prescribed consume AFTER the scorable sections (so they never
  // steal a match) but BEFORE context, and leave the precision denominator like context does.
  // Commitment coverage: an intent-voiced med is covered when a charted med matches it OR any
  // provider-note/instruction shares a substantive token with its name/voicedEvidence. The
  // note/instruction lists carry no source attribution, so both scopes read the same lists —
  // only the med pool differs per scope.
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

  return { diagnoses, primaryDx, em, cpt, ros, exam, medsPrescribed, medsInHouse, immunizations, medsCombined };
}

// ---------------------------------------------------------------------------
// scoreCase
// ---------------------------------------------------------------------------
// Free-text field pairing honoring the CC/HPI storage cross-wiring (see the GoldData comment in
// harvest-shared.ts): the model writes the REAL HPI via the 'historyOfPresentIllness' note field,
// the note's "Additional information" via 'chiefComplaint', and MDM via 'medicalDecision'.
// Exported so judge-freetext.ts (LLM content judge) and this presence scorer can never disagree
// about which gold field pairs with which sim noteText field.
export const FREETEXT_PAIRING = {
  historyOfPresentIllness: { goldField: 'historyOfPresentIllness', noteField: 'historyOfPresentIllness' },
  additionalInformation: { goldField: 'additionalInformation', noteField: 'chiefComplaint' },
  medicalDecisionMaking: { goldField: 'medicalDecisionMaking', noteField: 'medicalDecision' },
} as const;

export function scoreCase(
  caseId: string,
  gold: GoldData,
  state: SimFinalState,
  usage?: CaseUsage,
  dispositionTrigger?: DispositionTriggerInfo | null
): CaseScore {
  const ft = (goldText: string | undefined, pred: SimNoteText | undefined): FreeTextScore => ({
    goldPresent: !!goldText?.trim(),
    goldLength: goldText?.trim().length ?? 0,
    predictedPresent: !!pred?.text?.trim(),
    predictedLength: pred?.text?.trim().length ?? 0,
  });
  // Field pairing comes from FREETEXT_PAIRING above (CC/HPI cross-wiring — do not "fix" it).
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

  const scopes = { plannerOnly: scoreScope(gold, state, 'plannerOnly'), final: scoreScope(gold, state, 'final') };

  // Context items charted (prior-chart material the system charted anyway — reported, never FP).
  const finalDx = inScope(state.diagnoses, 'final');
  const labOrderCodes = new Set(gold.assessment.diagnoses.filter((d) => d.fromLabOrder).map((d) => d.codeNormalized));
  const contextCharted = {
    labOrderDiagnoses: finalDx.filter((d) => d.code && labOrderCodes.has(normCode(d.code))).length,
    conditionsMatchingHistory: inScope(state.conditions, 'final').filter((c) =>
      gold.medicalHistory.some((h) => nameMatch(c.display, h.display))
    ).length,
    allergiesMatchingPrior: inScope(state.allergies, 'final').filter((a) =>
      gold.allergies.some((g) => nameMatch(a.display, g.name))
    ).length,
    medsMatchingReconciled: scopes.final.medsCombined.contextCharted,
  };

  return {
    caseId,
    scopes,
    freeText,
    contextCharted,
    counters: {
      templatesApplied: state.templatesApplied.length,
      examComments: state.examComments.length,
      pendingNoteEdits: state.pendingNoteEdits.length,
      providerNotes: state.providerNotes.length,
      predictedConditions: inScope(state.conditions, 'final').length,
      predictedAllergies: inScope(state.allergies, 'final').length,
      goldInstructions: gold.instructions.length,
      predictedInstructions: state.instructions.length,
      goldDisposition: !!(gold.disposition?.type || gold.disposition?.note),
      predictedDisposition: !!state.disposition,
      // `dispositionVoiced` is an additive tag-voiced.ts field, cast like isUnvoiced does.
      ...(typeof (gold.disposition as { dispositionVoiced?: boolean } | undefined)?.dispositionVoiced === 'boolean'
        ? { goldDispositionVoiced: (gold.disposition as { dispositionVoiced?: boolean }).dispositionVoiced }
        : {}),
      removeTargetMissing: state.skipped.filter((sk) => sk.kind.startsWith('remove-')).length,
    },
    ...(usage ? { usage } : {}),
    // undefined = omit entirely (pre-field runs keep byte-identical score files).
    ...(dispositionTrigger !== undefined ? { dispositionTrigger } : {}),
  };
}

// ---------------------------------------------------------------------------
// Aggregation (micro-averaged across cases)
// ---------------------------------------------------------------------------
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
interface AggScope {
  sections: Record<string, AggSection>;
  em: { goldCases: number; predictedCases: number; matched: number; levelMatched: number };
  primaryDx: { goldCases: number; bothPresent: number; matched: number };
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
  // Prescribed-med voicing fidelity breakdown (see ScopeScores.medsPrescribed).
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
export interface AggregateSummary {
  scoredCases: number;
  scopes: { plannerOnly: AggScope; final: AggScope };
  freeText: Record<string, { goldPresent: number; predictedPresent: number; bothPresent: number }>;
  contextCharted: CaseScore['contextCharted'];
  counters: {
    templatesApplied: number;
    examComments: number;
    pendingNoteEdits: number;
    providerNotes: number;
    goldInstructions: number;
    predictedInstructions: number;
    goldDisposition: number;
    predictedDisposition: number;
    removeTargetMissing: number;
  };
  // Voiced-scoped disposition metric over cases WITH a gold disposition: voicedGold = gold
  // disposition tagged dispositionVoiced:true (the denominator), voicedPredicted = those that
  // also charted one (the numerator), unvoicedGold = tagged false, noData = untagged corpus.
  dispositionVoiced: {
    voicedGold: number;
    voicedPredicted: number;
    unvoicedGold: number;
    noData: number;
  };
  // Review disposition-trigger buckets: noData = score has no trigger info (pre-field run OR a
  // review response without the field); firedByPattern counts fired cases per matchedPattern.
  dispositionTrigger: {
    firedProposed: number;
    firedDeclined: number;
    notFired: number;
    noData: number;
    firedByPattern: Record<string, number>;
  };
  usage: { planner: UsageAgg; review: UsageAgg };
}

const SET_SECTIONS = ['diagnoses', 'cpt', 'ros', 'exam', 'medsPrescribed', 'medsInHouse', 'immunizations'] as const;

function aggregateScope(scores: CaseScore[], scope: Scope): AggScope {
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
      const sec = s.scopes[scope][name] as SectionScore;
      gold += sec.goldInScope;
      predicted += sec.predicted;
      matched += sec.matched;
      contextGold += sec.contextGold ?? 0;
      contextCharted += sec.contextCharted ?? 0;
      unvoicedGold += sec.unvoicedGold ?? 0;
      unvoicedMatched += sec.unvoicedMatched ?? 0;
    }
    // The med sections share one predicted pool — their per-section precision is meaningless
    // (medsCombined carries it), so emit null there.
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
  const primaryDx = { goldCases: 0, bothPresent: 0, matched: 0 };
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
  for (const s of scores) {
    const sc = s.scopes[scope];
    if (sc.em.gold) em.goldCases++;
    if (sc.em.predicted) em.predictedCases++;
    if (sc.em.match === true) em.matched++;
    if (sc.em.levelMatch === true) em.levelMatched++;
    if (sc.primaryDx.goldCode) primaryDx.goldCases++;
    if (sc.primaryDx.match !== null) primaryDx.bothPresent++;
    if (sc.primaryDx.match === true) primaryDx.matched++;
    rosPolarity.matched += sc.ros.matched;
    rosPolarity.agree += sc.ros.polarityAgree;
    examAbnormal.matched += sc.exam.matched;
    examAbnormal.agree += sc.exam.abnormalAgree;
    medsCombined.predicted += sc.medsCombined.predicted;
    medsCombined.matched += sc.medsCombined.matched;
    medsCombined.contextCharted += sc.medsCombined.contextCharted;
    medsCombined.unvoicedMatched += sc.medsCombined.unvoicedMatched ?? 0;
    // ?? 0: score files written before med voicing fidelity existed still aggregate.
    medsCombined.intentMatched += sc.medsCombined.intentMatched ?? 0;
    medsVoicing.legacyVoiced += sc.medsPrescribed.legacyVoiced ?? 0;
    medsVoicing.intentVoiced += sc.medsPrescribed.intentVoiced ?? 0;
    medsVoicing.intentCovered += sc.medsPrescribed.intentCovered ?? 0;
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
    pendingNoteEdits: 0,
    providerNotes: 0,
    goldInstructions: 0,
    predictedInstructions: 0,
    goldDisposition: 0,
    predictedDisposition: 0,
    removeTargetMissing: 0,
  };
  const usage = {
    planner: { calls: 0, inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0, thinkingTokens: 0 },
    review: { calls: 0, inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0, thinkingTokens: 0 },
  };
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
    counters.pendingNoteEdits += s.counters.pendingNoteEdits;
    counters.providerNotes += s.counters.providerNotes;
    counters.goldInstructions += s.counters.goldInstructions;
    counters.predictedInstructions += s.counters.predictedInstructions;
    // ?? 0: score files written before this counter existed can still be aggregated.
    counters.removeTargetMissing += s.counters.removeTargetMissing ?? 0;
    if (s.counters.goldDisposition) counters.goldDisposition++;
    if (s.counters.predictedDisposition) counters.predictedDisposition++;
    if (s.counters.goldDisposition) {
      // undefined = untagged corpus (score predates the tag) → no-data bucket, never a denominator.
      const voiced = s.counters.goldDispositionVoiced;
      if (voiced === true) {
        dispositionVoiced.voicedGold++;
        if (s.counters.predictedDisposition) dispositionVoiced.voicedPredicted++;
      } else if (voiced === false) dispositionVoiced.unvoicedGold++;
      else dispositionVoiced.noData++;
    }
    const t = s.dispositionTrigger; // == null: absent (pre-field run) or null (response lacked it)
    if (t == null) dispositionTrigger.noData++;
    else if (!t.fired) dispositionTrigger.notFired++;
    else {
      if (t.modelProposed) dispositionTrigger.firedProposed++;
      else dispositionTrigger.firedDeclined++;
      const p = t.matchedPattern ?? '(unspecified)';
      dispositionTrigger.firedByPattern[p] = (dispositionTrigger.firedByPattern[p] ?? 0) + 1;
    }
    for (const phase of ['planner', 'review'] as const) {
      const u = s.usage?.[phase];
      if (!u) continue;
      usage[phase].calls++;
      usage[phase].inputTokens += u.inputTokens ?? 0;
      usage[phase].outputTokens += u.outputTokens ?? 0;
      usage[phase].cacheReadTokens += u.cacheReadTokens ?? 0;
      usage[phase].cacheWriteTokens += u.cacheWriteTokens ?? 0;
      usage[phase].thinkingTokens += u.thinkingTokens ?? 0;
    }
  }
  return {
    scoredCases: scores.length,
    scopes: { plannerOnly: aggregateScope(scores, 'plannerOnly'), final: aggregateScope(scores, 'final') },
    freeText,
    contextCharted,
    counters,
    dispositionVoiced,
    dispositionTrigger,
    usage,
  };
}

// ---------------------------------------------------------------------------
// Table rendering (numbers only)
// ---------------------------------------------------------------------------
const fmt = (n: number | null): string => (n === null ? '   —' : n.toFixed(3).replace(/^0\./, ' .'));

export function formatSummary(agg: AggregateSummary): string {
  const lines: string[] = [];
  lines.push(`scored cases: ${agg.scoredCases}`);
  lines.push('');
  lines.push('section          scope     gold  pred  match  ctxG  ctxC  unvG  unvM      P      R');
  for (const name of SET_SECTIONS) {
    for (const scope of ['plannerOnly', 'final'] as const) {
      const s = agg.scopes[scope].sections[name];
      lines.push(
        `${name.padEnd(16)} ${(scope === 'plannerOnly' ? 'planner' : 'final').padEnd(8)} ${String(s.gold).padStart(
          5
        )} ${String(s.predicted).padStart(5)} ${String(s.matched).padStart(6)} ${String(s.contextGold).padStart(
          5
        )} ${String(s.contextCharted).padStart(5)} ${String(s.unvoicedGold ?? 0).padStart(5)} ${String(
          s.unvoicedMatched ?? 0
        ).padStart(5)}  ${fmt(s.precision).padStart(5)}  ${fmt(s.recall).padStart(5)}`
      );
    }
  }
  for (const scope of ['plannerOnly', 'final'] as const) {
    const sc = agg.scopes[scope];
    const label = scope === 'plannerOnly' ? 'planner' : 'final';
    lines.push('');
    lines.push(
      `[${label}] E&M: gold ${sc.em.goldCases} cases, predicted ${sc.em.predictedCases}, exact match ${sc.em.matched}` +
        (sc.em.goldCases > 0 ? ` (${((sc.em.matched / sc.em.goldCases) * 100).toFixed(0)}%)` : '') +
        `, level match ${sc.em.levelMatched}` +
        (sc.em.goldCases > 0 ? ` (${((sc.em.levelMatched / sc.em.goldCases) * 100).toFixed(0)}%)` : '')
    );
    lines.push(
      `[${label}] primary dx: gold ${sc.primaryDx.goldCases} cases, both charted ${sc.primaryDx.bothPresent}, match ${sc.primaryDx.matched}`
    );
    lines.push(
      `[${label}] ROS polarity agree ${sc.rosPolarity.agree}/${sc.rosPolarity.matched}; exam abnormal agree ${sc.examAbnormal.agree}/${sc.examAbnormal.matched}`
    );
    lines.push(
      `[${label}] meds combined: pred ${sc.medsCombined.predicted}, matched ${sc.medsCombined.matched}, ctx ${
        sc.medsCombined.contextCharted
      }, P ${fmt(sc.medsCombined.precision).trim()}`
    );
    lines.push(
      `[${label}] meds voicing: legacyVoiced ${sc.medsVoicing.legacyVoiced}; commitment coverage ${sc.medsVoicing.intentCovered}/${sc.medsVoicing.intentVoiced}` +
        (sc.medsVoicing.intentVoiced > 0
          ? ` (${((sc.medsVoicing.intentCovered / sc.medsVoicing.intentVoiced) * 100).toFixed(0)}%)`
          : '')
    );
  }
  lines.push('');
  lines.push(
    `context items charted: labOrderDx ${agg.contextCharted.labOrderDiagnoses}, conditions ${agg.contextCharted.conditionsMatchingHistory}, allergies ${agg.contextCharted.allergiesMatchingPrior}, reconciledMeds ${agg.contextCharted.medsMatchingReconciled}`
  );
  lines.push(
    `counters: templates ${agg.counters.templatesApplied}, examComments ${agg.counters.examComments}, pendingNoteEdits ${agg.counters.pendingNoteEdits}, providerNotes ${agg.counters.providerNotes}, instructions gold/pred ${agg.counters.goldInstructions}/${agg.counters.predictedInstructions}, disposition gold/pred ${agg.counters.goldDisposition}/${agg.counters.predictedDisposition}, removeTargetMissing ${agg.counters.removeTargetMissing}`
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
  for (const phase of ['planner', 'review'] as const) {
    const u = agg.usage[phase];
    lines.push(
      `usage[${phase}]: ${u.calls} calls, in ${u.inputTokens}, out ${u.outputTokens}, cacheR ${u.cacheReadTokens}, cacheW ${u.cacheWriteTokens}, think ${u.thinkingTokens}`
    );
  }
  return lines.join('\n');
}

// One-line per-case digest for stdout (final scope). primaryFixFired appends the ⇄ marker when
// the review dx-swap primary carry/promotion actually engaged on this case.
export function formatCaseLine(
  score: CaseScore,
  planSteps: number,
  reviewSuggestions: number,
  primaryFixFired = false
): string {
  const f = score.scopes.final;
  const em =
    f.em.gold && f.em.predicted
      ? `em ${f.em.predicted}${f.em.match ? '=' : '≠'}${f.em.gold}`
      : `em ${f.em.predicted ?? '—'}/${f.em.gold ?? '—'}`;
  const primBase = f.primaryDx.match === null ? '' : f.primaryDx.match ? ' prim✓' : ' prim✗';
  const prim = primaryFixFired ? `${primBase || ' prim'}⇄` : primBase;
  return (
    `${score.caseId}: plan ${planSteps} steps, review ${reviewSuggestions} sug | ` +
    `dx ${f.diagnoses.matched}/${f.diagnoses.goldInScope} R, ${f.diagnoses.matched}/${Math.max(
      f.diagnoses.predicted - (f.diagnoses.contextCharted ?? 0),
      0
    )} P${prim} | ${em} | ros ${f.ros.matched}/${f.ros.goldInScope} | exam ${f.exam.matched}/${
      f.exam.goldInScope
    } | meds ${f.medsCombined.matched}/${
      f.medsPrescribed.goldInScope + f.medsInHouse.goldInScope + f.immunizations.goldInScope
    }` +
    // Commitment coverage over intent-voiced meds (?? guards score shapes predating the field).
    ((f.medsPrescribed.intentVoiced ?? 0) > 0
      ? ` | commitCov ${f.medsPrescribed.intentCovered}/${f.medsPrescribed.intentVoiced}`
      : '') +
    // Review disposition-trigger suffix: only when it fired (✓ proposed / ✗ declined).
    (score.dispositionTrigger?.fired ? ` | dispo:fired${score.dispositionTrigger.modelProposed ? '✓' : '✗'}` : '')
  );
}

// ---------------------------------------------------------------------------
// Synthetic-fixture self-test (invented data only — no harvested content).
// ---------------------------------------------------------------------------
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
function goldDx(code: string, display: string, primary = false, fromLabOrder = false): DiagnosisItem {
  return { system: 'ICD-10-CM', code, codeNormalized: normCode(code), display, primary, fromLabOrder };
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
      { display: 'Acute URI', code: 'j06.9', isPrimary: true, source: 'planner' }, // lowercase + dot → normalization
      { display: 'Lab screening', code: 'Z1152', source: 'planner' }, // fromLabOrder gold → context, not FP
      { display: 'Cough', code: 'R05.9', source: 'planner' }, // true FP
    ];
    st.emEvents = [{ type: 'set', code: '99214', display: 'E/M 4', source: 'planner' }];
    st.cptCodes = [{ display: 'Rapid strep', code: '87880', source: 'planner' }];
    st.medications = [
      { display: 'amoxicillin 400 mg/5 mL suspension', source: 'planner' }, // containment either direction
      { display: 'Fluticasone Propionate nasal spray', source: 'planner' }, // context med charted anyway
    ];
    st.skipped = [
      { kind: 'remove-diagnosis', display: 'O86.20 — Not on chart', reason: 'no charted diagnosis matched' },
      { kind: 'remove-medication', display: 'Never charted', reason: 'no charted medication matched' },
      { kind: 'add-ros-finding', display: 'Fever', reason: 'already charted' }, // non-remove skip: not counted
    ];
    const s = scoreCase('fixtureA', gold, st);
    const f = s.scopes.final;
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
    check('A removeTargetMissing (remove-* skips only)', s.counters.removeTargetMissing, 2);
    check('A agg removeTargetMissing', aggregateScores([s]).counters.removeTargetMissing, 2);
    // Pre-counter score files (no removeTargetMissing field) still aggregate to 0, not NaN.
    const legacy = JSON.parse(JSON.stringify(s)) as CaseScore;
    delete (legacy.counters as Partial<CaseScore['counters']>).removeTargetMissing;
    check('A agg tolerates legacy score files', aggregateScores([legacy]).counters.removeTargetMissing, 0);
  }

  // Fixture B — review-vs-planner attribution (dx swap by review) + primary-dx handling.
  {
    const gold = emptyGold();
    gold.assessment.diagnoses = [goldDx('H66.006', 'Recurrent bilateral AOM', true), goldDx('J02.9', 'Pharyngitis')];
    const st = emptySimState();
    st.diagnoses = [
      {
        display: 'Bilateral AOM',
        code: 'H66.003',
        isPrimary: true,
        source: 'planner',
        removed: true,
        removedBy: 'review',
      },
      { display: 'Recurrent bilateral AOM', code: 'H66.006', isPrimary: true, source: 'review' },
      { display: 'Pharyngitis', code: 'J02.9', source: 'review' },
    ];
    const s = scoreCase('fixtureB', gold, st);
    check('B planner-only predicted', s.scopes.plannerOnly.diagnoses.predicted, 1);
    check('B planner-only recall', s.scopes.plannerOnly.diagnoses.recall, 0);
    check('B planner-only primary match', s.scopes.plannerOnly.primaryDx.match, false);
    check('B final predicted', s.scopes.final.diagnoses.predicted, 2);
    check('B final recall', s.scopes.final.diagnoses.recall, 1);
    check('B final precision', s.scopes.final.diagnoses.precision, 1);
    check('B final primary match', s.scopes.final.primaryDx.match, true);
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
        source: 'planner',
      },
      {
        baseKey: 'ros-respiratory-cough',
        field: rosField('ros-respiratory-cough', RosFindingState.Denies),
        label: 'Cough',
        finding: 'denies',
        source: 'planner',
      }, // polarity mismatch
      {
        baseKey: 'ros-skin-rash',
        field: rosField('ros-skin-rash', RosFindingState.Denies),
        label: 'Rash',
        finding: 'denies',
        source: 'review',
      }, // review-added FP
    ];
    st.examObservations = [
      {
        field: 'sinus-tenderness',
        label: 'Sinus tenderness',
        source: 'planner',
        components: [{ code: 'sinus-frontal-r', label: 'Right frontal', abnormal: true, source: 'planner' }],
      },
      { field: 'clear-lungs', label: 'Clear lungs', source: 'planner' }, // FP
    ];
    const s = scoreCase('fixtureC', gold, st);
    const f = s.scopes.final;
    check('C ros matched', f.ros.matched, 2);
    check('C ros polarity agree', f.ros.polarityAgree, 1);
    check('C ros precision', f.ros.precision, 2 / 3);
    check('C ros planner-only predicted', s.scopes.plannerOnly.ros.predicted, 2);
    check('C exam gold in scope (present:false excluded)', f.exam.goldInScope, 2);
    check('C exam matched', f.exam.matched, 1);
    check('C exam abnormal agree', f.exam.abnormalAgree, 1);

    const agg = aggregateScores([s]);
    check('C agg ros gold', agg.scopes.final.sections.ros.gold, 2);
    console.log('\n--- aggregate table over fixture C only ---');
    console.log(formatSummary(agg));
  }

  // Fixture D — voiced tagging (tag-voiced.ts flags) + E&M level match across families.
  // Mixes per section: voiced:true, voiced:false (unvoiced), and untagged (legacy behavior).
  {
    const gold = emptyGold();
    const tag = <T>(item: T, voiced: boolean): T => ({ ...item, voiced }) as T;
    gold.assessment.diagnoses = [
      tag(goldDx('J06.9', 'Acute URI', true), true), // voiced, predicted → matched
      tag(goldDx('K21.9', 'GERD'), false), // unvoiced, predicted → unvoicedMatched, not FP
      goldDx('R05.9', 'Cough'), // untagged, NOT predicted → recall miss
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
      { display: 'Acute URI', code: 'J06.9', isPrimary: true, source: 'planner' },
      { display: 'GERD', code: 'K21.9', source: 'planner' }, // matches unvoiced gold
      { display: 'Asthma', code: 'J45.909', source: 'planner' }, // true FP
    ];
    st.emEvents = [{ type: 'set', code: '99214', display: 'E/M 4', source: 'planner' }]; // wrong family, right level
    st.cptCodes = [{ display: 'Rapid strep', code: '87880', source: 'planner' }]; // matches unvoiced gold
    st.rosObservations = [
      {
        baseKey: 'ros-constitutional-fever',
        field: rosField('ros-constitutional-fever', RosFindingState.Denies),
        label: 'Fever',
        finding: 'denies',
        source: 'planner',
      },
      {
        baseKey: 'ros-respiratory-cough',
        field: rosField('ros-respiratory-cough', RosFindingState.Denies),
        label: 'Cough',
        finding: 'denies',
        source: 'planner',
      }, // matches unvoiced gold
    ];
    st.examObservations = [
      { field: 'clear-lungs', label: 'Clear lungs', source: 'planner' },
      { field: 'sinus-tenderness', label: 'Sinus tenderness', source: 'planner' }, // matches unvoiced gold
    ];
    st.medications = [
      { display: 'Amoxicillin 400 mg', source: 'planner' },
      { display: 'Cetirizine 10 mg', source: 'planner' }, // matches unvoiced gold
    ];

    const s = scoreCase('fixtureD', gold, st);
    const f = s.scopes.final;
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
    check('D agg em levelMatched', agg.scopes.final.em.levelMatched, 1);
    check('D agg dx unvoicedGold', agg.scopes.final.sections.diagnoses.unvoicedGold, 1);
    check('D agg dx precision', agg.scopes.final.sections.diagnoses.precision, 0.5);
  }

  // Fixture E — prescribed-med voicing fidelity (nameVoiced) + commitment coverage.
  // Mixes: nameVoiced matched/missed, legacy voiced (no nameVoiced), intent-voiced covered by
  // med / covered by note token / covered by note prefix-plural / uncovered, unvoiced.
  {
    const gold = emptyGold();
    type GoldMed = (typeof gold.medications.prescribed)[number];
    const med = (m: { name: string; voiced?: boolean; nameVoiced?: boolean; voicedEvidence?: string }): GoldMed =>
      m as GoldMed;
    gold.medications.prescribed = [
      med({ name: 'Amoxicillin', voiced: true, nameVoiced: true }), // name spoken, charted → matched
      med({ name: 'Cetirizine', voiced: true, nameVoiced: true }), // name spoken, NOT charted → recall miss
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
      { display: 'Amoxicillin 400 mg', source: 'planner' },
      { display: 'Prednisone 10 mg', source: 'planner' },
      { display: 'Cephalexin 500 mg', source: 'planner' },
      { display: 'Fluticasone Propionate nasal spray', source: 'planner' },
      { display: 'Ibuprofen', source: 'planner' }, // true FP
    ];
    st.instructions = ['Take the cough medicine as directed', 'Use allergy eye drops as needed'];
    const s = scoreCase('fixtureE', gold, st);
    const f = s.scopes.final;
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
    check(
      'E planner scope commitCov identical (all planner-sourced)',
      s.scopes.plannerOnly.medsPrescribed.intentCovered,
      3
    );
    check('E case line shows commitCov', formatCaseLine(s, 0, 0).includes('commitCov 3/4'), true);

    const agg = aggregateScores([s]);
    check('E agg medsVoicing', agg.scopes.final.medsVoicing, { legacyVoiced: 1, intentVoiced: 4, intentCovered: 3 });
    check('E agg medsCombined precision', agg.scopes.final.medsCombined.precision, 2 / 3);
    check(
      'E agg summary has commitment coverage line',
      formatSummary(agg).includes('commitment coverage 3/4 (75%)'),
      true
    );
    // Score files written before med voicing fidelity existed still aggregate (fields absent).
    const legacy = JSON.parse(JSON.stringify(s)) as CaseScore;
    for (const scope of ['plannerOnly', 'final'] as const) {
      const mp = legacy.scopes[scope].medsPrescribed as Partial<ScopeScores['medsPrescribed']>;
      delete mp.legacyVoiced;
      delete mp.intentVoiced;
      delete mp.intentCovered;
      delete (legacy.scopes[scope].medsCombined as Partial<ScopeScores['medsCombined']>).intentMatched;
    }
    const aggLegacy = aggregateScores([legacy]);
    check('E agg tolerates legacy score files (voicing zeroed)', aggLegacy.scopes.final.medsVoicing, {
      legacyVoiced: 0,
      intentVoiced: 0,
      intentCovered: 0,
    });
    check(
      'E agg legacy precision falls back (no intent exclusion)',
      aggLegacy.scopes.final.medsCombined.precision,
      0.5
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
    const legacy = scoreCase('fixtureF5', gold, st); // pre-field run: no key at all
    check('F stashed on score', proposed.dispositionTrigger, {
      fired: true,
      matchedPattern: 'discharge-home',
      modelProposed: true,
    });
    check('F null persisted as null', nullTrigger.dispositionTrigger, null);
    check('F legacy score omits the key', 'dispositionTrigger' in legacy, false);
    check('F case line proposed suffix', formatCaseLine(proposed, 0, 0).endsWith(' | dispo:fired✓'), true);
    check('F case line declined suffix', formatCaseLine(declined, 0, 0).endsWith(' | dispo:fired✗'), true);
    check('F case line silent when not fired', formatCaseLine(notFired, 0, 0).includes('dispo:'), false);
    check('F case line silent on legacy score', formatCaseLine(legacy, 0, 0).includes('dispo:'), false);
    const agg = aggregateScores([proposed, declined, notFired, nullTrigger, legacy]);
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
      formatSummary(aggregateScores([notFired, legacy])).includes('fired by pattern'),
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
    charted.disposition = { type: 'pcp', text: 'Follow up in 3 days' };
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

  console.log(failures === 0 ? '\nSELF-TEST PASS' : `\nSELF-TEST FAIL (${failures} failing checks)`);
  if (failures > 0) process.exit(1);
}

// ---------------------------------------------------------------------------
// Standalone re-score of an existing results dir
// ---------------------------------------------------------------------------
interface ResultFile {
  caseId: string;
  error?: string;
  planSteps?: unknown[];
  reviewSuggestions?: unknown[];
  primaryFix?: { carried: number; promoted: number };
  finalState?: SimFinalState;
  usage?: CaseUsage;
  dispositionTrigger?: DispositionTriggerInfo | null;
}

function rescore(resultsDir: string, casesDir: string): void {
  const files = readdirSync(resultsDir)
    .filter((f) => /^case\d+\.result\.json$/.test(f))
    .sort();
  console.log(`${files.length} result files in ${resultsDir}`);
  const scores: CaseScore[] = [];
  let failed = 0;
  for (const f of files) {
    const result = JSON.parse(readFileSync(join(resultsDir, f), 'utf8')) as ResultFile;
    if (result.error || !result.finalState) {
      failed++;
      console.log(`${result.caseId}: skipped (recorded error)`);
      continue;
    }
    const casePath = join(casesDir, `${result.caseId}.json`);
    if (!existsSync(casePath)) {
      failed++;
      console.log(`${result.caseId}: skipped (no case file in ${casesDir})`);
      continue;
    }
    const gold = (JSON.parse(readFileSync(casePath, 'utf8')) as { gold: GoldData }).gold;
    const score = scoreCase(result.caseId, gold, result.finalState, result.usage, result.dispositionTrigger);
    writeFileSync(join(resultsDir, `${result.caseId}.score.json`), JSON.stringify(score, null, 2));
    scores.push(score);
    console.log(
      formatCaseLine(
        score,
        result.planSteps?.length ?? 0,
        result.reviewSuggestions?.length ?? 0,
        (result.primaryFix?.carried ?? 0) + (result.primaryFix?.promoted ?? 0) > 0
      )
    );
  }
  const summary = aggregateScores(scores);
  writeFileSync(join(resultsDir, 'summary.json'), JSON.stringify(summary, null, 2));
  console.log('');
  console.log(formatSummary(summary));
  console.log(`\nre-scored ${scores.length} cases, ${failed} skipped`);
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) {
  if (process.argv[2] === '--self-test') {
    runSelfTest();
  } else {
    rescore(
      process.argv[2] ?? 'scripts/easy-chart-eval/harvested-results',
      process.argv[3] ?? 'scripts/easy-chart-eval/harvested-cases'
    );
  }
}
