/**
 * The format of an Autochart acceptance case — autochart-cases/<id>.json — and its parser. Everything about a
 * case is in that one file: the recording (`transcript`), the chart the clinician signed (`gold`), the patient,
 * and the hand-written part — what was said and never charted, the gold's errors, what is allowed beyond the
 * chart, the narrative facts, the provider edits. autochart-cases/README.md describes the fields;
 * autochart-corpus.ts reads the files and derives the rest of the expectations from the gold.
 *
 * In the file every pattern is a regular-expression source, matched case-insensitively; parsed, it is a RegExp.
 */

import type { NoteTextField, PlannableDispositionType, PlannableVitalField } from 'utils/lib/easy-chart/actions';

// ── Expectations ──────────────────────────────────────────────────────────────

export type VitalUnit = 'F' | 'C' | 'lb' | 'kg' | 'in' | 'cm';

/** One thing the plan must (or must not) contain. Matched against the plan's actions after the guards. */
export type Expectation =
  /** An add-diagnosis whose code (dots removed) starts with one of the prefixes. */
  | { kind: 'diagnosis'; codePrefix: string | string[]; primary?: boolean }
  /** An add-ros-finding that resolves to this catalogue symptom with this polarity. */
  | { kind: 'ros'; baseKey: string; finding: 'reports' | 'denies' }
  /** An add-exam-finding that resolves to this exam leaf, or whose display matches. */
  | { kind: 'exam'; field?: string; display?: RegExp }
  /** A set-vital for this field, within tolerance after unit conversion. */
  | { kind: 'vital'; field: PlannableVitalField; value: number; unit?: VitalUnit; tolerance?: number }
  | { kind: 'bloodPressure'; systolic: number; diastolic: number }
  | { kind: 'medication'; name: RegExp; strength?: RegExp }
  | { kind: 'allergy'; name: RegExp }
  | { kind: 'condition'; codePrefix?: string; name?: RegExp }
  | { kind: 'surgicalHistory'; display: RegExp }
  | { kind: 'hospitalization'; display: RegExp }
  /** The set-em-code the plan emits must be one of these. */
  | { kind: 'em'; codes: string[] }
  | { kind: 'disposition'; type?: PlannableDispositionType; followUpInDays?: number }
  | { kind: 'instruction'; text: RegExp }
  | { kind: 'note'; field: NoteTextField; text: RegExp }
  /** Satisfied by any one of the alternatives. */
  | { kind: 'anyOf'; of: Expectation[] };

/**
 * Where an expectation comes from: the signed chart and the recording both (voiced), the chart alone
 * (unvoiced), the recording alone (said), or neither — entered outside the visit (context).
 */
export type ExpectationTag = 'voiced' | 'unvoiced' | 'said' | 'context';

export interface TaggedExpectation {
  expectation: Expectation;
  tag: ExpectationTag;
  /** The gold section or "recording": diagnosis, ros, exam, em, prescription, disposition, allergy, history… */
  from: string;
  /** The chart's own wording, for the report. */
  label?: string;
  /** The case file's note on a said item: why it is expected. */
  note?: string;
}

/** A scripted correction of the generated narrative, sent as `providerEdits`; the plan must follow it. */
export interface ProviderEdit {
  label: string;
  /** Applied to the generated draft. When the draft does not contain it, the edit is reported as skipped. */
  find: RegExp;
  replace: string;
  expected: Expectation[];
  forbidden: Expectation[];
}

/** A gold item the recording contradicts; `match` is tested against the item as the dump prints it. */
export interface GoldError {
  match: RegExp;
  reason: string;
}

/** The hand-written part of a case file, parsed. */
export interface AutochartCaseSpec {
  id: string;
  label: string;
  /** The corpus case the file was copied from: tools/easy-chart-eval/harvested-cases/<sourceCase>.json */
  sourceCase: string;
  patient: { ageYears?: number; ageMonths?: number; sex: 'male' | 'female' };
  /** Free text for the reader. */
  notes: string[];
  /** Said on the recording, absent from the signed chart. Scored like the voiced gold. */
  said: { expectation: Expectation; note?: string }[];
  /** Gold items the recording contradicts. Dropped from the expectations, listed in the dump. */
  goldErrors: GoldError[];
  /** Fine to chart although the chart lacks it: keeps a coded action out of the precision count. */
  allowed: Expectation[];
  /** Each must appear in some narrative line, beside the facts derived from the voiced chart. */
  narrativeFacts: RegExp[];
  edits: ProviderEdit[];
}

/** Something a read-back of the recording must mention. */
export interface NarrativeFact {
  pattern: RegExp;
  /** `voiced`: a chart item whose wording the recording carries; `said`: the case file's own fact. */
  tag: 'voiced' | 'said';
  label: string;
}

// ── The signed chart, as much of it as the suites read ────────────────────────

export interface GoldItem {
  field: string;
  label?: string;
  present?: boolean;
  voiced?: boolean;
}

export interface Gold {
  reviewOfSystems: { observations: GoldItem[] };
  exam: GoldItem[];
  assessment: {
    diagnoses: {
      codeNormalized?: string;
      code?: string;
      display?: string;
      primary?: boolean;
      fromLabOrder?: boolean;
      voiced?: boolean;
    }[];
  };
  billing: { emCode?: { code?: string } };
  medications: {
    prescribed: { name?: string; voiced?: boolean; nameVoiced?: boolean }[];
    inHouseAdministered: { name?: string }[];
    immunizations: { name?: string }[];
    currentReconciled: { name?: string }[];
  };
  allergies: { name?: string }[];
  medicalHistory: { codeNormalized?: string; code?: string; display?: string }[];
  surgicalHistory: { code?: string; display?: string }[];
  hospitalizations: { code?: string; display?: string }[];
  vitals: { field: string; value?: unknown; systolic?: number; diastolic?: number }[];
  disposition?: { type?: string; followUpIn?: number; dispositionVoiced?: boolean };
}

// ── The file, parsed ──────────────────────────────────────────────────────────

/** A case file, parsed: the spec plus the recording, the patient status and the signed chart. */
export interface CaseFile extends AutochartCaseSpec {
  transcript: string;
  patientStatus: 'new' | 'established';
  gold: Gold;
}

/** A case as the suites run it: the file plus the status, a date of birth and what the gold derives to. */
export interface AutochartCase extends AutochartCaseSpec {
  transcript: string;
  status: 'new' | 'established';
  dateOfBirth: string;
  /** From the signed chart (voiced or unvoiced) and from the recording (said). Voiced and said are scored. */
  expected: TaggedExpectation[];
  /** From outside the recording. Evaluated, never scored. */
  context: TaggedExpectation[];
  /** Gold items left out because the recording contradicts them. */
  droppedFromGold: { label: string; reason: string }[];
  /** The file's plus the home medications. */
  allowed: Expectation[];
  /** What a read-back must mention: derived from the voiced chart (tag voiced) plus the file's own (tag said). */
  facts: NarrativeFact[];
}

// ── The file, as written ──────────────────────────────────────────────────────

/** `T` as the file spells it: every RegExp is its source. */
type Textual<T> = T extends RegExp
  ? string
  : T extends (infer U)[]
  ? Textual<U>[]
  : T extends object
  ? { [K in keyof T]: Textual<T[K]> }
  : T;

export type ExpectationJson = Textual<Expectation>;

export interface CaseFileJson {
  id: string;
  label: string;
  sourceCase: string;
  /** Null until filled in: autochart-import-case.ts writes it that way. */
  patient?: { ageYears?: number | null; ageMonths?: number | null; sex?: 'male' | 'female' | null };
  patientStatus: 'new' | 'established';
  notes?: string[];
  said?: (ExpectationJson & { note?: string })[];
  goldErrors?: { match: string; reason: string }[];
  allowed?: ExpectationJson[];
  narrativeFacts?: string[];
  edits?: {
    label: string;
    find: string;
    replace: string;
    expected: ExpectationJson[];
    forbidden?: ExpectationJson[];
  }[];
  transcript: string;
  gold: Gold;
}

const rx = (source: string): RegExp => new RegExp(source, 'i');

export function parseExpectation(e: ExpectationJson): Expectation {
  switch (e.kind) {
    case 'exam':
      return { kind: 'exam', ...(e.field ? { field: e.field } : {}), ...(e.display ? { display: rx(e.display) } : {}) };
    case 'medication':
      return { kind: 'medication', name: rx(e.name), ...(e.strength ? { strength: rx(e.strength) } : {}) };
    case 'allergy':
      return { kind: 'allergy', name: rx(e.name) };
    case 'condition':
      return {
        kind: 'condition',
        ...(e.codePrefix ? { codePrefix: e.codePrefix } : {}),
        ...(e.name ? { name: rx(e.name) } : {}),
      };
    case 'surgicalHistory':
      return { kind: 'surgicalHistory', display: rx(e.display) };
    case 'hospitalization':
      return { kind: 'hospitalization', display: rx(e.display) };
    case 'instruction':
      return { kind: 'instruction', text: rx(e.text) };
    case 'note':
      return { kind: 'note', field: e.field, text: rx(e.text) };
    case 'anyOf':
      return { kind: 'anyOf', of: e.of.map(parseExpectation) };
    default:
      // diagnosis, ros, vital, bloodPressure, em, disposition: no patterns, the file's shape is the parsed one.
      return e;
  }
}

export function parseCaseFile(json: CaseFileJson, file: string): CaseFile {
  const { ageYears, ageMonths, sex } = json.patient ?? {};
  if (!(ageYears || ageMonths) || !sex) {
    throw new Error(`${file}: fill in patient — ageYears or ageMonths, and sex (the corpus keeps neither).`);
  }
  return {
    id: json.id,
    label: json.label,
    sourceCase: json.sourceCase,
    patient: { ...(ageYears ? { ageYears } : {}), ...(ageMonths ? { ageMonths } : {}), sex },
    notes: json.notes ?? [],
    said: (json.said ?? []).map(({ note, ...e }) => ({
      expectation: parseExpectation(e as ExpectationJson),
      ...(note ? { note } : {}),
    })),
    goldErrors: (json.goldErrors ?? []).map((g) => ({ match: rx(g.match), reason: g.reason })),
    allowed: (json.allowed ?? []).map(parseExpectation),
    narrativeFacts: (json.narrativeFacts ?? []).map(rx),
    edits: (json.edits ?? []).map((e) => ({
      label: e.label,
      find: rx(e.find),
      replace: e.replace,
      expected: e.expected.map(parseExpectation),
      forbidden: (e.forbidden ?? []).map(parseExpectation),
    })),
    transcript: json.transcript,
    patientStatus: json.patientStatus,
    gold: json.gold,
  };
}
