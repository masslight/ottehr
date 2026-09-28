/**
 * The Autochart acceptance cases are real recordings, one file each in autochart-cases/ (format and parser:
 * autochart-case-file.ts). This module reads them and turns each gold — the chart the clinician signed — into
 * expectations, each tagged with where it came from:
 *
 *   voiced    the item is in the signed chart AND the recording says it (the corpus's `voiced` tag, judged
 *             per item) — what a scribe could have charted from the audio;
 *   unvoiced  in the signed chart but never said on the recording (a ROS negative the provider clicked, an exam
 *             normal from the template, a prescription named only in the eRx) — the honest gap between the
 *             recording and the chart;
 *   context   entered before or beside the visit, not from the recording at all (nurse vitals, the allergy and
 *             history lists, home medications) — evaluated and shown, never scored.
 *
 * Home medications become ALLOWED: fine to chart, never required. Everything else the plan codes that the chart
 * does not have counts against it (`extra` in autochart-shared.ts) — a dose given in the clinic included.
 *
 * The same module reads the corpus itself (`--corpus`): a harvested case becomes a case file with the
 * hand-written sections empty and the patient's age and sex read from the chart's HPI.
 */

import { existsSync, readdirSync, readFileSync } from 'fs';
import { DateTime } from 'luxon';
import * as path from 'path';
import type { PlannableDispositionType } from 'utils/lib/easy-chart/actions';
import { PLANNABLE_DISPOSITION_TYPES } from 'utils/lib/easy-chart/actions';
import {
  AutochartCase,
  CaseFile,
  CaseFileJson,
  Expectation,
  ExpectationTag,
  Gold,
  NarrativeFact,
  parseCaseFile,
  TaggedExpectation,
} from './autochart-case-file';
import { describeExpectation } from './autochart-describe';

const CASES_DIR = path.resolve(__dirname, 'autochart-cases');

/** Every case file in autochart-cases/, parsed, in file-name order. */
export function readCaseFiles(): CaseFile[] {
  return readdirSync(CASES_DIR)
    .filter((name) => name.endsWith('.json'))
    .sort()
    .map((name) => {
      const file = path.join(CASES_DIR, name);
      const json = JSON.parse(readFileSync(file, 'utf8')) as CaseFileJson;
      if (`${json.id}.json` !== name) throw new Error(`${file}: its id "${json.id}" must match the file name`);
      return parseCaseFile(json, file);
    });
}

// ── Medication names: the corpus has product names, the planner writes what was said ──

/** Generic → brand names a provider says aloud; the regex accepts either. */
export const BRANDS: Record<string, string[]> = {
  amoxicillin: ['augmentin', 'amoxil', 'clavulan'],
  azithromycin: ['zithromax', 'z-?pak', 'z-?pack'],
  benzonatate: ['tessalon'],
  methocarbamol: ['robaxin'],
  ipratropium: ['atrovent'],
  fluticasone: ['flonase'],
  pseudoephedrine: ['sudafed'],
  hydroxyzine: ['atarax', 'vistaril'],
  triamcinolone: ['kenalog'],
  famotidine: ['pepcid'],
  polyethylene: ['miralax', 'glycolax'],
  ciprofloxacin: ['cipro'],
  naproxen: ['aleve', 'naprosyn'],
  cyclobenzaprine: ['flexeril'],
  albuterol: ['ventolin', 'proair'],
  loperamide: ['imodium'],
  ondansetron: ['zofran'],
  cetirizine: ['zyrtec'],
  montelukast: ['singulair'],
  acetaminophen: ['tylenol'],
  ibuprofen: ['motrin', 'advil'],
  dexamethasone: ['decadron'],
  levothyroxine: ['synthroid'],
  atorvastatin: ['lipitor'],
  rosuvastatin: ['crestor'],
  promethazine: ['phenergan'],
  mupirocin: ['bactroban'],
  prednisone: ['deltasone'],
  lidocaine: ['xylocaine'],
};

const escape = (s: string): string => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** "Amoxicillin-Pot Clavulanate Oral Tablet 875-125 MG" → /amoxicillin|augmentin|amoxil|clavulan/i */
export function medicationRegex(productName: string): RegExp {
  const first = productName
    .trim()
    .split(/[\s-]+/)[0]
    .toLowerCase()
    .replace(/[^a-z]/g, '');
  const brands = BRANDS[first] ?? [];
  return new RegExp([escape(first), ...brands].join('|'), 'i');
}

/** A word to match a display by: the first word of five or more letters that is not a coding filler. */
const FILLER = new Set([
  'acute',
  'chronic',
  'other',
  'unspecified',
  'essential',
  'primary',
  'personal',
  'history',
  'disorder',
  'disease',
  'without',
  'with',
  'initial',
  'encounter',
  'misc',
  'containing',
  'compounds',
]);

export function displayRegex(display: string): RegExp {
  const words = display
    .toLowerCase()
    .replace(/\(.*?\)/g, ' ')
    .split(/[^a-z]+/)
    .filter((w) => w.length >= 5 && !FILLER.has(w));
  const word = words[0] ?? display.trim().split(/\s+/)[0].toLowerCase();
  const extra = word === 'sulfonamide' ? ['sulfa'] : [];
  return new RegExp([escape(word), ...extra].join('|'), 'i');
}

// ── Gold → expectations ───────────────────────────────────────────────────────

const tagged = (expectation: Expectation, tag: ExpectationTag, from: string, label?: string): TaggedExpectation => ({
  expectation,
  tag,
  from,
  ...(label ? { label } : {}),
});

const voicedTag = (voiced: boolean | undefined): ExpectationTag => (voiced ? 'voiced' : 'unvoiced');

const dispositionType = (type: string | undefined): PlannableDispositionType | undefined => {
  if (!type) return undefined;
  if (type.startsWith('pcp')) return 'pcp';
  return (PLANNABLE_DISPOSITION_TYPES as readonly string[]).includes(type)
    ? (type as PlannableDispositionType)
    : undefined;
};

const PLANNABLE_VITALS: Record<string, { unit?: 'C' | 'kg' | 'cm' }> = {
  'vital-temperature': { unit: 'C' },
  'vital-heartbeat': {},
  'vital-respiration-rate': {},
  'vital-oxygen-sat': {},
  'vital-weight': { unit: 'kg' },
  'vital-height': { unit: 'cm' },
};

export interface DerivedExpectations {
  /** The chart items the recording could account for, tagged voiced or unvoiced. Scored. */
  expected: TaggedExpectation[];
  /** Pre-visit and beside-the-visit items. Evaluated, not scored. */
  context: TaggedExpectation[];
  /** Home medications: fine to chart, never required. */
  allowed: Expectation[];
}

export function deriveExpectations(gold: Gold): DerivedExpectations {
  const expected: TaggedExpectation[] = [];
  const context: TaggedExpectation[] = [];
  const allowed: Expectation[] = [];

  for (const dx of gold.assessment.diagnoses ?? []) {
    if (dx.fromLabOrder) continue;
    const code = dx.codeNormalized ?? dx.code;
    if (!code) continue;
    expected.push(
      tagged(
        { kind: 'diagnosis', codePrefix: code, ...(dx.primary ? { primary: true } : {}) },
        voicedTag(dx.voiced),
        'diagnosis',
        dx.display
      )
    );
  }

  for (const o of gold.reviewOfSystems?.observations ?? []) {
    if (!o.present) continue;
    const suffix = /-(reports|denies)$/.exec(o.field);
    if (!suffix) continue;
    const baseKey = o.field.slice(0, -(suffix[1].length + 1));
    expected.push(
      tagged({ kind: 'ros', baseKey, finding: suffix[1] as 'reports' | 'denies' }, voicedTag(o.voiced), 'ros', o.label)
    );
  }

  for (const e of gold.exam ?? []) {
    if (!e.present) continue;
    expected.push(tagged({ kind: 'exam', field: e.field }, voicedTag(e.voiced), 'exam', e.label));
  }

  const em = gold.billing?.emCode?.code;
  // The level is inferred, never said; a scribe is expected to infer it, so it counts as voiced.
  // The level is what the plan decides; the new/established prefix the product derives from the visit count,
  // and the signed charts do not always agree with their own patient status (an established visit billed
  // 99204, a new one 99214). So either prefix at the gold's level satisfies it.
  const level = em?.match(/^992[01](\d)$/)?.[1];
  if (em)
    expected.push(tagged({ kind: 'em', codes: level ? [`9920${level}`, `9921${level}`] : [em] }, 'voiced', 'em', em));

  for (const m of gold.medications?.prescribed ?? []) {
    if (!m.name) continue;
    // A prescription "voiced" as "a muscle relaxer" is a fact of the visit, but its NAME was not said.
    const tag: ExpectationTag = m.voiced && m.nameVoiced !== false ? 'voiced' : 'unvoiced';
    expected.push(tagged({ kind: 'medication', name: medicationRegex(m.name) }, tag, 'prescription', m.name));
  }

  const disposition = gold.disposition;
  const type = dispositionType(disposition?.type);
  if (type) {
    expected.push(
      tagged({ kind: 'disposition', type }, voicedTag(disposition?.dispositionVoiced), 'disposition', disposition?.type)
    );
  }
  if (typeof disposition?.followUpIn === 'number' && disposition.followUpIn > 0) {
    expected.push(
      tagged(
        { kind: 'disposition', followUpInDays: disposition.followUpIn },
        'unvoiced',
        'disposition',
        `follow up in ${disposition.followUpIn} days`
      )
    );
  }

  for (const m of gold.medications?.currentReconciled ?? []) {
    if (m.name) allowed.push({ kind: 'medication', name: medicationRegex(m.name) });
  }

  for (const a of gold.allergies ?? []) {
    if (a.name) context.push(tagged({ kind: 'allergy', name: displayRegex(a.name) }, 'context', 'allergy', a.name));
  }
  for (const h of gold.medicalHistory ?? []) {
    const code = h.codeNormalized ?? h.code;
    if (!code && !h.display) continue;
    context.push(
      tagged(
        {
          kind: 'condition',
          ...(code ? { codePrefix: code } : {}),
          ...(h.display ? { name: displayRegex(h.display) } : {}),
        },
        'context',
        'history',
        h.display ?? code
      )
    );
  }
  for (const s of gold.surgicalHistory ?? []) {
    if (s.display) {
      context.push(
        tagged({ kind: 'surgicalHistory', display: displayRegex(s.display) }, 'context', 'surgery', s.display)
      );
    }
  }
  for (const h of gold.hospitalizations ?? []) {
    if (h.display) {
      context.push(
        tagged({ kind: 'hospitalization', display: displayRegex(h.display) }, 'context', 'hospitalization', h.display)
      );
    }
  }
  for (const v of gold.vitals ?? []) {
    if (v.field === 'vital-blood-pressure' && typeof v.systolic === 'number' && typeof v.diastolic === 'number') {
      context.push(
        tagged(
          { kind: 'bloodPressure', systolic: v.systolic, diastolic: v.diastolic },
          'context',
          'vital',
          'blood pressure'
        )
      );
      continue;
    }
    const plannable = PLANNABLE_VITALS[v.field];
    if (!plannable || typeof v.value !== 'number') continue;
    context.push(
      tagged(
        { kind: 'vital', field: v.field as never, value: v.value, ...(plannable.unit ? { unit: plannable.unit } : {}) },
        'context',
        'vital',
        v.field
      )
    );
  }

  return { expected, context, allowed };
}

// ── Gold → narrative facts ────────────────────────────────────────────────────

const FACT_FILLER = new Set([
  ...FILLER,
  'right',
  'left',
  'upper',
  'lower',
  'bilateral',
  'recurrent',
  'site',
  'specified',
]);

/** The word of a chart label the recording itself uses, hyphen-tolerant ("Postnasal drip" → /post-?nasal/). */
function wordSaid(label: string, transcript: string): RegExp | undefined {
  const words = label
    .toLowerCase()
    .replace(/\(.*?\)/g, ' ')
    .split(/[^a-z]+/)
    .filter((w) => w.length >= 4 && !FACT_FILLER.has(w))
    .sort((a, b) => b.length - a.length);
  for (const w of words) {
    const source = escape(w).replace(/^(post|pre|non|sub|peri|intra|extra)(?=[a-z])/, '$1-?');
    const re = new RegExp(source, 'i');
    if (re.test(transcript)) return re;
  }
  return undefined;
}

const DISPOSITION_WORDS: Record<string, RegExp> = {
  pcp: /primary care|pcp|primary doctor|follow[- ]?up/i,
  specialty: /refer|specialist|follow[- ]?up/i,
  ed: /emergency|\ber\b/i,
};

/**
 * What a read-back must mention, from the chart: every voiced diagnosis, ROS finding, named prescription and
 * disposition whose own wording the recording carries — so a miss is the narrative's, not the chart's coding
 * vocabulary. Items whose wording the recording does not carry ("Acute suppurative otitis media" for "ear
 * infection") make no fact.
 */
export function deriveNarrativeFacts(gold: Gold, transcript: string): NarrativeFact[] {
  const facts: NarrativeFact[] = [];
  const add = (pattern: RegExp | undefined, label: string): void => {
    if (pattern && !facts.some((f) => f.pattern.source === pattern.source))
      facts.push({ pattern, tag: 'voiced', label });
  };
  for (const dx of gold.assessment?.diagnoses ?? []) {
    if (dx.voiced && !dx.fromLabOrder && dx.display) add(wordSaid(dx.display, transcript), `diagnosis ${dx.display}`);
  }
  for (const o of gold.reviewOfSystems?.observations ?? []) {
    if (o.present && o.voiced && o.label) add(wordSaid(o.label, transcript), `ROS ${o.label}`);
  }
  for (const m of gold.medications?.prescribed ?? []) {
    if (!(m.voiced && m.nameVoiced !== false && m.name)) continue;
    const re = medicationRegex(m.name);
    if (re.test(transcript)) add(re, `prescription ${m.name}`);
  }
  const type = dispositionType(gold.disposition?.type);
  const words = type ? DISPOSITION_WORDS[type] : undefined;
  if (words && gold.disposition?.dispositionVoiced && words.test(transcript)) add(words, `disposition ${type}`);
  return facts;
}

// ── The case a suite runs ─────────────────────────────────────────────────────

const dateOfBirth = (patient: CaseFile['patient']): string =>
  DateTime.now()
    .minus({ years: patient.ageYears ?? 0, months: patient.ageMonths ?? 0, days: 40 })
    .toISODate()!;

/** The text a gold error is matched against: the expectation as the report prints it, plus the chart's label. */
const goldErrorKey = (t: TaggedExpectation): string => `${describeExpectation(t.expectation)} «${t.label ?? ''}»`;

export function loadAutochartCase(file: CaseFile): AutochartCase {
  const { transcript, patientStatus, gold, ...spec } = file;
  const derived = deriveExpectations(gold);
  const droppedFromGold: AutochartCase['droppedFromGold'] = [];
  const keep = (t: TaggedExpectation): boolean => {
    const error = spec.goldErrors.find((g) => g.match.test(goldErrorKey(t)));
    if (!error) return true;
    droppedFromGold.push({ label: goldErrorKey(t), reason: error.reason });
    return false;
  };
  const said: TaggedExpectation[] = spec.said.map(({ expectation, note }) => ({
    expectation,
    tag: 'said',
    from: 'recording',
    ...(note ? { note } : {}),
  }));
  return {
    ...spec,
    transcript,
    status: patientStatus,
    dateOfBirth: dateOfBirth(spec.patient),
    expected: [...derived.expected.filter(keep), ...said],
    context: derived.context.filter(keep),
    droppedFromGold,
    allowed: [...derived.allowed, ...spec.allowed],
    facts: [
      ...deriveNarrativeFacts(gold, transcript),
      ...spec.narrativeFacts.map((pattern) => ({ pattern, tag: 'said' as const, label: 'the case file' })),
    ],
  };
}

/** Every case in autochart-cases/, ready to run. */
export const loadAutochartCases = (): AutochartCase[] => readCaseFiles().map(loadAutochartCase);

// ── The corpus itself, for `--corpus` ─────────────────────────────────────────

const CORPUS_DIR = path.resolve(__dirname, '../../tools/easy-chart-eval/harvested-cases');

/** A harvested case as tools/easy-chart-eval writes it, as much of it as the suites and the selector read. */
export interface CorpusCase {
  caseId: string;
  meta?: { patientStatus?: 'new' | 'established' };
  transcript?: string;
  gold: Gold & {
    historyOfPresentIllness?: string;
    radiology?: unknown[];
    labs?: { external?: unknown; inHouse?: unknown };
  };
  quality?: {
    verdict?: string;
    why?: string;
    flags?: string[];
    chars?: number;
    turns?: number;
    goldItems?: number;
    voicedItems?: number;
  };
}

export function listCorpusIds(): string[] {
  if (!existsSync(CORPUS_DIR)) {
    throw new Error(`${CORPUS_DIR} is not here: the corpus lives only on machines that ran the harvester.`);
  }
  return readdirSync(CORPUS_DIR)
    .filter((f) => /^case\d+\.json$/.test(f))
    .map((f) => f.replace(/\.json$/, ''))
    .sort();
}

export const readCorpusCase = (id: string): CorpusCase =>
  JSON.parse(readFileSync(path.join(CORPUS_DIR, `${id}.json`), 'utf8')) as CorpusCase;

/** Age and sex from the chart's HPI ("The patient is a 47-year-old male…"); the corpus keeps neither as data. */
export function parsePatient(hpi: string | undefined): CaseFile['patient'] | undefined {
  const head = (hpi ?? '').slice(0, 400);
  const years = /(\d{1,3})[- ](?:year|yr)s?[- ]old/i.exec(head);
  const months = /(\d{1,2})[- ]months?[- ]old/i.exec(head);
  const weeks = /(\d{1,2})[- ]weeks?[- ]old/i.exec(head);
  const word = /\b(male|female|man|woman|boy|girl|he|she|his|her)\b/i.exec(head)?.[1]?.toLowerCase();
  if (!word) return undefined;
  const sex = ['male', 'man', 'boy', 'he', 'his'].includes(word) ? 'male' : 'female';
  if (years) return { ageYears: Number(years[1]), sex };
  if (months) return { ageMonths: Number(months[1]), sex };
  if (weeks) return { ageMonths: Math.max(1, Math.round(Number(weeks[1]) / 4.33)), sex };
  return undefined;
}

/** A corpus case as a case file with the hand-written sections empty, or why it cannot run unattended. */
export function corpusCaseFile(raw: CorpusCase): { file: CaseFile } | { skipped: string } {
  const patient = parsePatient(raw.gold?.historyOfPresentIllness);
  if (!patient) return { skipped: 'no age and sex in the HPI' };
  if (!raw.transcript) return { skipped: 'no transcript' };
  const primary = (raw.gold.assessment?.diagnoses ?? []).find((d) => d.primary)?.display;
  const age = patient.ageYears !== undefined ? `${patient.ageYears}` : `${patient.ageMonths} mo`;
  const status = raw.meta?.patientStatus ?? 'new';
  return {
    file: {
      id: raw.caseId,
      label: `${primary ?? 'no primary diagnosis'} (${status}, ${age}${patient.sex[0].toUpperCase()})`,
      sourceCase: raw.caseId,
      patient,
      notes: [],
      said: [],
      goldErrors: [],
      allowed: [],
      narrativeFacts: [],
      edits: [],
      transcript: raw.transcript,
      patientStatus: status,
      gold: raw.gold,
    },
  };
}

/** Corpus cases, ready to run; the ones that cannot run unattended are reported and left out. */
export function loadCorpusCases(ids: string[]): AutochartCase[] {
  const cases: AutochartCase[] = [];
  for (const id of ids) {
    const made = corpusCaseFile(readCorpusCase(id));
    if ('skipped' in made) {
      console.warn(`  ${id}: skipped — ${made.skipped}`);
      continue;
    }
    cases.push(loadAutochartCase(made.file));
  }
  return cases;
}
