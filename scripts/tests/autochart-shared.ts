/**
 * What the two Autochart suites share: the CLI conventions of scripts/tests, the encounter a case runs
 * against, the matchers that decide whether a plan action satisfies an expectation, and the check
 * bookkeeping behind the dashboard's `{passed, total}`.
 *
 * The matchers resolve ROS and exam findings through the SAME catalogue matchers the recommendations
 * panel uses (utils/lib/easy-chart/matchers), so "the plan charted 'denies fever'" is judged the way the
 * product would file it, not by string equality with the expectation.
 */

import { readFileSync } from 'fs';
import * as path from 'path';
import { buildExamLeafCatalogue, ExamLeaf } from 'utils/lib/config-helpers/exam-leaves';
import type { PlannedAction } from 'utils/lib/easy-chart/api';
import {
  buildRosCatalogue,
  findExamLeafMatches,
  findRosMatches,
  MatchCandidate,
  RosCatalogueEntry,
} from 'utils/lib/easy-chart/matchers';
import { rosPolarity } from 'utils/lib/easy-chart/provenance';
import { parseVitalDisplay } from 'utils/lib/easy-chart/vitals';
import { DefaultExamComponentsConfig } from 'utils/lib/ottehr-config/examination/default-components.config';
import { AutochartCase, Expectation, TaggedExpectation } from './autochart-case-file';
import { loadAutochartCases, loadCorpusCases } from './autochart-corpus';
import { describeExpectation } from './autochart-describe';
import { selectCorpusIds } from './autochart-select-cases';
import { createTestAppointment, deleteTestResources, setZambdaBaseUrl } from './shared';

// ── CLI ───────────────────────────────────────────────────────────────────────

export interface SuiteArgs {
  env: string;
  envConfig: Record<string, string>;
  jsonOutPath: string | null;
  cases: AutochartCase[];
  verbose: boolean;
  /** How many cases run at once. */
  concurrency: number;
}

/** `--env local --url http://localhost:3010 --json-out out.json --cases id1,id2 --verbose --concurrency 2` */
export function parseSuiteArgs(argv: string[]): SuiteArgs {
  const flag = (name: string): string | null => {
    const at = argv.indexOf(name);
    return at !== -1 ? argv[at + 1] : null;
  };
  const env = flag('--env') ?? 'local';
  const url = flag('--url');
  if (url) setZambdaBaseUrl(url);
  const envFilePath = path.resolve(__dirname, '../../packages/zambdas/.env', `zambda-secrets-${env}.json`);
  const envConfig = JSON.parse(readFileSync(envFilePath, 'utf8'));
  const ids =
    flag('--cases')
      ?.split(',')
      .map((id) => id.trim()) ?? null;
  const corpusAt = argv.indexOf('--corpus');
  const corpusValue = corpusAt !== -1 ? argv[corpusAt + 1] : undefined;
  const corpus = corpusAt !== -1 ? (corpusValue && !corpusValue.startsWith('--') ? corpusValue : 'all') : null;
  const all = corpus ? loadCorpusCases(selectCorpusIds(corpus)) : loadAutochartCases();
  const cases = ids ? all.filter((c) => ids.includes(c.id)) : all;
  if (ids && cases.length !== ids.length) {
    const known = new Set(all.map((c) => c.id));
    throw new Error(`Unknown case id(s): ${ids.filter((id) => !known.has(id)).join(', ')}`);
  }
  return {
    env,
    envConfig,
    jsonOutPath: flag('--json-out'),
    cases,
    verbose: argv.includes('--verbose'),
    concurrency: Number(flag('--concurrency') ?? 2),
  };
}

/** Runs `worker` over `items`, at most `limit` at a time, keeping the input order in the result. */
export async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  worker: (item: T, index: number) => Promise<R>
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let next = 0;
  const lanes = Array.from({ length: Math.max(1, Math.min(limit, items.length)) }, async () => {
    while (next < items.length) {
      const index = next++;
      results[index] = await worker(items[index], index);
    }
  });
  await Promise.all(lanes);
  return results;
}

// ── The encounter a case runs against ─────────────────────────────────────────

export interface CaseEncounter {
  encounterId: string;
  cleanup: () => Promise<void>;
}

/**
 * A real visit for the case's patient, so the plan reads the same encounter context the product does:
 * age and sex from the Patient, the new/established status from the appointment count (an established
 * case gets a second visit), and an empty chart. Torn down afterwards.
 */
export async function createCaseEncounter(
  token: string,
  envConfig: Record<string, string>,
  c: AutochartCase
): Promise<CaseEncounter> {
  const label = `Autochart-${c.id}`.slice(0, 40);
  const patientOptions = {
    firstName: 'Autochart',
    dateOfBirth: c.dateOfBirth,
    sex: c.patient.sex,
    reasonForVisit: c.label.slice(0, 60),
  };
  const first = await createTestAppointment(token, envConfig, label, patientOptions);
  let resourceIds = first.resourceIds;
  let encounterId = first.encounterId;
  if (c.status === 'established') {
    // A second appointment for the same patient: the plan zambda counts the patient's visits.
    const second = await createTestAppointment(token, envConfig, label, {
      ...patientOptions,
      patientId: first.patientId,
    });
    resourceIds = [...second.resourceIds, ...first.resourceIds];
    encounterId = second.encounterId;
  }
  return {
    encounterId,
    cleanup: () => deleteTestResources(token, envConfig, [...new Set(resourceIds)]),
  };
}

// ── Matching a plan against expectations ──────────────────────────────────────

let rosCatalogue: RosCatalogueEntry[] | undefined;
let examLeaves: ExamLeaf[] | undefined;
const ros = (): RosCatalogueEntry[] => (rosCatalogue ??= buildRosCatalogue());
const leaves = (): ExamLeaf[] => (examLeaves ??= buildExamLeafCatalogue(DefaultExamComponentsConfig));

const top = (matches: MatchCandidate[]): MatchCandidate | undefined =>
  [...matches].sort((a, b) => b.score - a.score)[0];

const normalizeCode = (code: string | undefined): string => (code ?? '').replace(/\./g, '').toUpperCase();
const codeStartsWith = (code: string | undefined, prefixes: string | string[]): boolean => {
  const normalized = normalizeCode(code);
  return (Array.isArray(prefixes) ? prefixes : [prefixes]).some((p) => normalized.startsWith(normalizeCode(p)));
};

/** The symptom an add-ros-finding files under, resolved as the panel resolves it. */
export function resolveRosBaseKey(action: PlannedAction): string | undefined {
  const best = top(findRosMatches(action.display ?? '', ros(), { searchTerms: action.searchTerms }));
  return best?.id;
}

/** The exam leaf an add-exam-finding ticks, resolved as the executor resolves it. */
export function resolveExamField(action: PlannedAction): string | undefined {
  const best = top(findExamLeafMatches(action.display ?? '', leaves(), { searchTerms: action.searchTerms }));
  return best?.id;
}

type VitalReading = { value: number; unit?: string } | { systolic: number; diastolic: number } | undefined;

function readVital(action: PlannedAction): VitalReading {
  const field = action.field as Parameters<typeof parseVitalDisplay>[0] | undefined;
  if (field && action.display) {
    const parsed = parseVitalDisplay(field, action.display);
    if (parsed.status === 'ok') return { value: parsed.value, unit: parsed.unit };
    if (parsed.status === 'ok-bp') return { systolic: parsed.systolic, diastolic: parsed.diastolic };
  }
  if (typeof action.systolic === 'number' && typeof action.diastolic === 'number') {
    return { systolic: action.systolic, diastolic: action.diastolic };
  }
  if (typeof action.value === 'number') return { value: action.value, unit: action.unit };
  return undefined;
}

const canonicalUnit = (unit: string | undefined): string | undefined => {
  const u = (unit ?? '').trim().toLowerCase().replace(/[°º]/g, '');
  if (!u) return undefined;
  if (/^(f|fahrenheit|degf)$/.test(u)) return 'F';
  if (/^(c|celsius|degc)$/.test(u)) return 'C';
  if (/^(lb|lbs|pound|pounds)$/.test(u)) return 'lb';
  if (/^(kg|kgs|kilogram|kilograms)$/.test(u)) return 'kg';
  if (/^(in|inch|inches)$/.test(u)) return 'in';
  if (/^(cm|centimeter|centimeters)$/.test(u)) return 'cm';
  return u;
};

/** Converts a reading into the expectation's unit when both sides name one; otherwise compares as given. */
function inExpectedUnit(value: number, unit: string | undefined, expectedUnit: string | undefined): number {
  const from = canonicalUnit(unit);
  const to = canonicalUnit(expectedUnit);
  if (!from || !to || from === to) return value;
  if (from === 'F' && to === 'C') return ((value - 32) * 5) / 9;
  if (from === 'C' && to === 'F') return (value * 9) / 5 + 32;
  if (from === 'lb' && to === 'kg') return value * 0.45359237;
  if (from === 'kg' && to === 'lb') return value / 0.45359237;
  if (from === 'in' && to === 'cm') return value * 2.54;
  if (from === 'cm' && to === 'in') return value / 2.54;
  return value;
}

const DEFAULT_TOLERANCE: Record<string, number> = {
  'vital-temperature': 0.3,
  'vital-weight': 0.3,
  'vital-height': 1.5,
};

const text = (action: PlannedAction): string => `${action.text ?? action.message ?? action.newText ?? ''}`;

/** Whether one plan action satisfies one expectation. */
export function actionMatches(action: PlannedAction, e: Expectation): boolean {
  switch (e.kind) {
    case 'anyOf':
      return e.of.some((alternative) => actionMatches(action, alternative));
    case 'diagnosis':
      return (
        action.kind === 'add-diagnosis' &&
        codeStartsWith(action.code, e.codePrefix) &&
        (e.primary === undefined || Boolean(action.isPrimary) === e.primary)
      );
    case 'ros': {
      if (action.kind !== 'add-ros-finding') return false;
      const polarity = rosPolarity(action.display ?? '', action.finding as string | undefined);
      return polarity === e.finding && resolveRosBaseKey(action) === e.baseKey;
    }
    case 'exam': {
      if (action.kind !== 'add-exam-finding') return false;
      if (e.display) return e.display.test(action.display ?? '');
      return resolveExamField(action) === e.field;
    }
    case 'vital': {
      if (action.kind !== 'set-vital' || action.field !== e.field) return false;
      const reading = readVital(action);
      if (!reading || !('value' in reading)) return false;
      const value = inExpectedUnit(reading.value, reading.unit, e.unit);
      return Math.abs(value - e.value) <= (e.tolerance ?? DEFAULT_TOLERANCE[e.field] ?? 0.5);
    }
    case 'bloodPressure': {
      if (action.kind !== 'set-vital' || action.field !== 'vital-blood-pressure') return false;
      const reading = readVital(action);
      return !!reading && 'systolic' in reading && reading.systolic === e.systolic && reading.diastolic === e.diastolic;
    }
    case 'medication':
      return (
        action.kind === 'add-medication' &&
        e.name.test(action.display ?? '') &&
        (!e.strength || e.strength.test(`${action.strength ?? ''} ${action.display ?? ''}`))
      );
    case 'allergy':
      return action.kind === 'add-allergy' && e.name.test(action.display ?? '');
    case 'condition':
      if (action.kind !== 'add-condition') return false;
      if (e.codePrefix && codeStartsWith(action.code, e.codePrefix)) return true;
      return !!e.name && e.name.test(action.display ?? '');
    case 'surgicalHistory':
      return action.kind === 'add-surgical-history' && e.display.test(action.display ?? '');
    case 'hospitalization':
      return action.kind === 'add-hospitalization' && e.display.test(action.display ?? '');
    case 'em':
      return action.kind === 'set-em-code' && e.codes.includes(`${action.code ?? ''}`);
    case 'disposition':
      return (
        action.kind === 'set-disposition' &&
        (e.type === undefined || action.dispositionType === e.type) &&
        (e.followUpInDays === undefined || action.followUpInDays === e.followUpInDays)
      );
    case 'instruction':
      return action.kind === 'add-patient-instruction' && e.text.test(text(action));
    case 'note':
      return action.kind === 'edit-note-text' && action.field === e.field && e.text.test(action.newText ?? '');
    default:
      return false;
  }
}

export { describeExpectation } from './autochart-describe';

// ── Checks ────────────────────────────────────────────────────────────────────

export type CheckTag = 'grounded' | 'voiced' | 'said' | 'extra' | 'unvoiced' | 'forbidden' | 'invariant' | 'context';

/**
 * The tags the dashboard number is made of: every action grounded in the recording by a verified quote
 * (grounded) — the measure that owes nothing to the chart; what the recording carries (voiced, said) charted —
 * recall against the chart; what the plan coded that the chart does not have (extra) — precision against the
 * chart; the provider-edit rule (forbidden); the two plan invariants. `unvoiced` and `context` are shown beside it, never inside it: a scribe cannot chart what the
 * recording does not carry, and most of the unvoiced gold is the exam and ROS normals a template fills in —
 * which these suites deliberately do not measure.
 */
export const SCORED_TAGS: readonly CheckTag[] = ['grounded', 'voiced', 'said', 'extra', 'forbidden', 'invariant'];
const ALL_TAGS: readonly CheckTag[] = [...SCORED_TAGS, 'unvoiced', 'context'];

export interface Check {
  label: string;
  passed: boolean;
  tag: CheckTag;
  /** The expectation's kind (diagnosis, ros, exam…), so unlisted misses can be counted by kind. */
  kind?: string;
  /** What the plan actually had, for the failure line. */
  detail?: string;
}

/** Where a ROS or exam action would land, as the product resolves it — the part of a miss a regex cannot show. */
const resolvedKey = (a: PlannedAction): string | undefined => {
  if (a.kind === 'add-ros-finding') return resolveRosBaseKey(a) ?? 'unresolved';
  if (a.kind === 'add-exam-finding') return resolveExamField(a) ?? 'unresolved';
  return undefined;
};

export const summarizeAction = (a: PlannedAction): string => {
  const parts = [a.kind, a.field, a.code, a.display, a.dispositionType, a.followUpInDays, a.strength]
    .filter((p) => p !== undefined && p !== '')
    .map(String);
  const terms = a.searchTerms?.length ? ` [${a.searchTerms.join('; ')}]` : '';
  const key = resolvedKey(a);
  const body =
    a.kind === 'add-patient-instruction' || a.kind === 'provider-note' || a.kind === 'edit-note-text'
      ? ` "${text(a).slice(0, 90)}"`
      : '';
  return `${parts.join(' ')}${terms}${key ? ` → ${key}` : ''}${body}`;
};

/** The action kinds an expectation is judged against, so a miss can show what the plan charted instead. */
const KINDS_FOR_EXPECTATION: Record<Expectation['kind'], string[]> = {
  anyOf: [],
  diagnosis: ['add-diagnosis'],
  ros: ['add-ros-finding'],
  exam: ['add-exam-finding'],
  vital: ['set-vital'],
  bloodPressure: ['set-vital'],
  medication: ['add-medication'],
  allergy: ['add-allergy'],
  condition: ['add-condition'],
  surgicalHistory: ['add-surgical-history'],
  hospitalization: ['add-hospitalization'],
  em: ['set-em-code'],
  disposition: ['set-disposition'],
  instruction: ['add-patient-instruction'],
  note: ['edit-note-text'],
};

const kindsFor = (e: Expectation): string[] =>
  e.kind === 'anyOf' ? [...new Set(e.of.flatMap(kindsFor))] : KINDS_FOR_EXPECTATION[e.kind];

/** A guard refusal, as the plan reports it. */
export interface Refusal {
  kind: string;
  display?: string;
  reason: string;
}

/**
 * What the plan charted of the same kind as a missed expectation, plus what the guards refused of that kind
 * and, for a medication, the instructions or notes that mention it — the lines that tell a miss from a
 * mismatch, a refusal, or a drug that landed as text instead of a medication.
 */
const sameKindDetail = (e: Expectation, actions: PlannedAction[], refusals: Refusal[]): string => {
  const kinds = new Set(kindsFor(e));
  const parts: string[] = [];
  const same = actions.filter((a) => kinds.has(a.kind)).map((a) => summarizeAction(a).replace(/^\S+ /, ''));
  parts.push(same.length ? `charted instead: ${same.join(' | ')}` : 'nothing of this kind charted');
  const refused = refusals.filter((r) => kinds.has(r.kind)).map((r) => `${r.display ?? ''}: ${r.reason}`);
  if (refused.length) parts.push(`refused: ${refused.join(' | ')}`);
  if (e.kind === 'medication') {
    const mentions = actions
      .filter((a) => (a.kind === 'add-patient-instruction' || a.kind === 'provider-note') && e.name.test(text(a)))
      .map((a) => `${a.kind} "${text(a).slice(0, 80)}"`);
    if (mentions.length) parts.push(`mentioned as text: ${mentions.join(' | ')}`);
  }
  return parts.join('; ');
};

const describeTagged = (t: TaggedExpectation): string =>
  `${describeExpectation(t.expectation)}${t.label ? ` «${t.label}»` : ''}`;

/**
 * One check per chart item (tagged voiced or unvoiced), per forbidden item, plus the two plan invariants —
 * the dashboard's unit — and one per context item, evaluated for the report but never scored.
 */
export function checkPlan(c: AutochartCase, actions: PlannedAction[], refusals: Refusal[] = []): Check[] {
  const checks: Check[] = [];
  for (const t of [...c.expected, ...c.context]) {
    const passed = actions.some((a) => actionMatches(a, t.expectation));
    checks.push({
      label: `${t.tag === 'context' ? 'context' : 'expects'} ${describeTagged(t)}`,
      passed,
      tag: t.tag,
      kind: t.expectation.kind,
      detail: passed ? undefined : sameKindDetail(t.expectation, actions, refusals),
    });
  }
  for (const a of unexpectedActions(c, actions)) {
    checks.push({ label: `not in the chart: ${summarizeAction(a)}`, passed: false, tag: 'extra', kind: a.kind });
  }
  const emCodes = actions.filter((a) => a.kind === 'set-em-code');
  checks.push({
    label: 'exactly one E&M code',
    passed: emCodes.length === 1,
    tag: 'invariant',
    detail: emCodes.map(summarizeAction).join('; ') || 'none',
  });
  const primaries = actions.filter((a) => a.kind === 'add-diagnosis' && a.isPrimary);
  const diagnoses = actions.filter((a) => a.kind === 'add-diagnosis');
  checks.push({
    label: 'exactly one primary diagnosis',
    passed: diagnoses.length === 0 ? primaries.length === 0 : primaries.length === 1,
    tag: 'invariant',
    detail: `${primaries.length} primary of ${diagnoses.length}`,
  });
  // Grounding: every action that could carry a verbatim quote and carries none is one failed check. The server
  // verifies `sourceText` against the recording; without it the product shows the item to the provider as
  // inferred. This is the one measure that does not depend on the chart being right.
  for (const a of actions) {
    if (UNQUOTABLE.has(a.kind)) continue;
    checks.push({
      label: `grounded in the recording: ${summarizeAction(a)}`,
      passed: !!a.sourceText,
      tag: 'grounded',
      kind: a.kind,
      detail: a.sourceText ? undefined : 'no verified quote — inferred',
    });
  }
  return checks;
}

/** Actions that cannot carry a quote: the E&M level is inferred by definition, a template is a title. */
const UNQUOTABLE = new Set(['set-em-code', 'apply-template']);

/** Every item the chart has (voiced or not), was entered beside the visit, or the case allows. */
const accountedFor = (c: AutochartCase): Expectation[] => [
  ...c.expected.map((t) => t.expectation),
  ...c.context.map((t) => t.expectation),
  ...c.allowed,
];

/** The kinds whose every item asserts something about the patient: one the chart does not have is a false positive. */
const CODED_KINDS = new Set([
  'add-diagnosis',
  'set-vital',
  'add-medication',
  'add-allergy',
  'add-condition',
  'add-surgical-history',
  'add-hospitalization',
]);

/**
 * A medication named by its class only — "a muscle relaxer", "oral steroid", "nasal spray" — is what the
 * recording said when the provider did not name the product. It matches no chart prescription (the chart has
 * methocarbamol, prednisone, ipratropium) and is not a false positive either; it is reported, not scored.
 */
const CLASS_NAMED_MEDICATION =
  /^(?:an? |the )?(?:oral |topical |nasal |inhaled |otc |over[- ]the[- ]counter |steroidal |steroid |antibiotic |antifungal |antihistamine |saline )*(?:steroids?|corticosteroids?|muscle relax(?:er|ant)s?|nasal sprays?|decongestants?|antibiotics?|antihistamines?|inhalers?|cough (?:syrup|medicine|suppressant)s?|pain (?:medication|reliever)s?|anti-?inflammator(?:y|ies)|nsaids?|eye ?drops?|ear ?drops?|ointment|cream|lotion|probiotics?|laxatives?|stool softeners?|antacids?)$/i;

export const isClassNamedMedication = (a: PlannedAction): boolean =>
  a.kind === 'add-medication' && CLASS_NAMED_MEDICATION.test((a.display ?? '').trim());

/** Coded actions nothing accounts for: the precision misses, one failed check each. */
export function unexpectedActions(c: AutochartCase, actions: PlannedAction[]): PlannedAction[] {
  const named = accountedFor(c);
  return actions.filter(
    (a) => CODED_KINDS.has(a.kind) && !isClassNamedMedication(a) && !named.some((e) => actionMatches(a, e))
  );
}

/**
 * What is reported but not scored: ROS and exam findings the chart does not have (a scribe may chart a negative
 * the clinician skipped) and medications named by their class only.
 */
export function unscoredExtras(c: AutochartCase, actions: PlannedAction[]): string[] {
  const named = accountedFor(c);
  return actions
    .filter(
      (a) =>
        isClassNamedMedication(a) ||
        ((a.kind === 'add-ros-finding' || a.kind === 'add-exam-finding') && !named.some((e) => actionMatches(a, e)))
    )
    .map(summarizeAction);
}

/** The scored checks only: unvoiced and context are left out. */
export const tally = (checks: Check[]): { passed: number; total: number } => {
  const scored = checks.filter((c) => SCORED_TAGS.includes(c.tag));
  return { passed: scored.filter((c) => c.passed).length, total: scored.length };
};

export const tallyByTag = (checks: Check[]): Record<CheckTag, { passed: number; total: number }> => {
  const out = {} as Record<CheckTag, { passed: number; total: number }>;
  for (const tag of ALL_TAGS) {
    const same = checks.filter((c) => c.tag === tag);
    out[tag] = { passed: same.filter((c) => c.passed).length, total: same.length };
  }
  return out;
};

/** "41/52 (voiced 30/35, said 3/4, forbidden 6/6, invariant 2/2; unvoiced 9/66, context 0/12 not scored)". */
export const describeTally = (checks: Check[]): string => {
  const by = tallyByTag(checks);
  const part = (tag: CheckTag): string => `${tag} ${by[tag].passed}/${by[tag].total}`;
  const present = (tags: readonly CheckTag[]): string =>
    tags
      .filter((tag) => by[tag].total > 0)
      .map(part)
      .join(', ');
  const scored = present(SCORED_TAGS.filter((tag) => tag !== 'grounded'));
  const unscored = present(['unvoiced', 'context']);
  const said = { passed: by.voiced.passed + by.said.passed, total: by.voiced.total + by.said.total };
  const recall = said.total ? `said→charted ${said.passed}/${said.total}: ` : '';
  const grounded = by.grounded.total ? `grounded ${by.grounded.passed}/${by.grounded.total}; ` : '';
  return `${tally(checks).passed}/${tally(checks).total} (${grounded}${recall}${scored}${
    unscored ? `; ${unscored} not scored` : ''
  })`;
};

/** A check folded over the repeated runs of one path: in how many of them it passed. */
export interface FoldedCheck {
  label: string;
  tag: CheckTag;
  kind?: string;
  passes: number;
  runs: number;
  /** The detail of the last run that failed it. */
  detail?: string;
}

/** Folds the checks of several runs into one list by label: a check's runs are the runs it appeared in. */
export function foldChecks(runs: Check[][]): FoldedCheck[] {
  const folded = new Map<string, FoldedCheck>();
  for (const run of runs) {
    for (const check of run) {
      const f = folded.get(check.label) ?? { label: check.label, tag: check.tag, kind: check.kind, passes: 0, runs: 0 };
      f.runs += 1;
      if (check.passed) f.passes += 1;
      else f.detail = check.detail;
      folded.set(check.label, f);
    }
  }
  return [...folded.values()];
}

/**
 * Prints the checks worth a line: every scored check that failed in some run ("✗" in all runs, "~" in
 * some), the unvoiced and context items the plan charted anyway (an inference, or a hallucination), and one
 * line each for the unvoiced and context items it did not — those are the norm, so they are counted by kind
 * rather than listed, except the unvoiced orders (a diagnosis, a drug, a disposition), which are named.
 */
export function printFolded(items: FoldedCheck[], indent = '    '): void {
  const count = (f: FoldedCheck): string => (f.runs > 1 ? ` (${f.passes}/${f.runs})` : '');
  for (const f of items) {
    if (!SCORED_TAGS.includes(f.tag) || f.passes === f.runs) continue;
    const mark = f.passes === 0 ? '✗' : '~';
    console.log(`${indent}${mark} ${f.label}${count(f)}${f.detail ? `  — got: ${f.detail}` : ''}`);
  }
  for (const tag of ['unvoiced', 'context'] as const) {
    const same = items.filter((f) => f.tag === tag);
    for (const f of same) {
      if (f.passes > 0) console.log(`${indent}+ ${f.label}${count(f)}  — charted although ${tag}`);
    }
    const missed = same.filter((f) => f.passes < f.runs);
    if (missed.length === 0) continue;
    const template = (f: FoldedCheck): boolean => tag === 'context' || f.kind === 'ros' || f.kind === 'exam';
    const byKind = new Map<string, number>();
    for (const f of missed.filter(template)) byKind.set(f.kind ?? '?', (byKind.get(f.kind ?? '?') ?? 0) + 1);
    const counted = [...byKind].map(([kind, n]) => `${n} ${kind}`).join(', ');
    const named = missed
      .filter((f) => !template(f))
      .map((f) => f.label.replace(/^expects /, ''))
      .join('; ');
    console.log(
      `${indent}· ${tag} not charted: ${missed.length}${counted ? ` (${counted})` : ''}${named ? `; ${named}` : ''}`
    );
  }
}

export const printChecks = (checks: Check[], indent = '    '): void => printFolded(foldChecks([checks]), indent);
