// The DETERMINISTIC scorer. It earns its keep before the LLM judge does.
//
// It cannot answer "did the planner match what a clinician wrote" — that needs gold notes, and none
// transfer (see docs/easy-chart-eval-cases.md). What it CAN answer, cheaply and on every change, is
// "is this output internally correct and clinically sane": are the codes real-shaped, is there
// exactly one primary diagnosis, did the negated findings stay out, did the units convert, did a
// stated follow-up produce a disposition, did every step report an outcome.
//
// Codes, dedup, primary-diagnosis and unit errors are the failures that matter most, they are all
// checkable without a model, and they cost nothing to re-run. Reserve the LLM judge for free text
// and semantics — and keep it in tools/, never as a deployed endpoint.

import { ChartPlanResponse, PlannedAction } from './api';
import { isCptShaped, isHcpcsShaped, isIcd10Shaped } from './codes';
import { findingPolarity, rosPolarity } from './provenance';
import { PLANNABLE_VITAL_FIELDS } from './actions';

export type EvalRuleId =
  | 'diagnosis-code-missing'
  | 'diagnosis-code-malformed'
  | 'diagnosis-duplicated'
  | 'primary-diagnosis-missing'
  | 'primary-diagnosis-multiple'
  | 'negated-finding-charted'
  | 'ros-polarity-missing'
  | 'vital-unit-unconverted'
  | 'vital-implausible-charted'
  | 'em-code-missing'
  | 'em-code-malformed'
  | 'em-code-wrong-family'
  | 'cpt-code-malformed'
  | 'disposition-missing'
  | 'rejection-without-reason'
  | 'provenance-quote-unverified';

export interface EvalViolation {
  rule: EvalRuleId;
  detail: string;
}

export interface EvalScore {
  violations: EvalViolation[];
  stats: {
    actions: number;
    rejected: number;
    diagnoses: number;
    vitals: number;
  };
}

export interface EvalExpectations {
  /** 'new' | 'established' when the fixture pins it; the E&M family is only checkable when known. */
  patientStatus?: 'new' | 'established';
  /** Phrases the narrative negates. None of them may appear as a charted abnormal finding. */
  negatedFindings?: string[];
  /** True when the narrative states a follow-up or disposition, so one must be charted. */
  expectsDisposition?: boolean;
}

const NEW_PATIENT_EM = new Set(['99202', '99203', '99204', '99205']);
const ESTABLISHED_EM = new Set(['99212', '99213', '99214', '99215']);
const VITAL_UNITS: Partial<Record<string, string[]>> = {
  'vital-height': ['cm', 'in'],
  'vital-weight': ['kg', 'lb'],
  'vital-temperature': ['F', 'C'],
};

export function scorePlan(response: ChartPlanResponse, expectations: EvalExpectations = {}): EvalScore {
  const violations: EvalViolation[] = [];
  const actions = response.actions ?? [];

  checkDiagnoses(actions, violations);
  checkFindings(actions, expectations, violations);
  checkVitals(actions, violations);
  checkBilling(actions, expectations, violations);
  checkDisposition(actions, expectations, violations);
  checkOutcomesAreReported(response, violations);

  return {
    violations,
    stats: {
      actions: actions.length,
      rejected: response.rejected?.length ?? 0,
      diagnoses: actions.filter((a) => a.kind === 'add-diagnosis').length,
      vitals: actions.filter((a) => a.kind === 'set-vital').length,
    },
  };
}

function checkDiagnoses(actions: PlannedAction[], violations: EvalViolation[]): void {
  const diagnoses = actions.filter((a) => a.kind === 'add-diagnosis');
  if (diagnoses.length === 0) return;

  const seen = new Set<string>();
  let primaries = 0;

  for (const dx of diagnoses) {
    if (!dx.code) {
      violations.push({ rule: 'diagnosis-code-missing', detail: `"${dx.display}" was charted with no ICD-10 code` });
    } else if (!isIcd10Shaped(dx.code)) {
      violations.push({ rule: 'diagnosis-code-malformed', detail: `"${dx.code}" is not a valid ICD-10 shape` });
    }
    const key = (dx.code ?? dx.display ?? '').toUpperCase();
    if (seen.has(key)) {
      violations.push({ rule: 'diagnosis-duplicated', detail: `"${dx.display}" was charted twice` });
    }
    seen.add(key);
    if (dx.isPrimary) primaries += 1;
  }

  if (primaries === 0) {
    violations.push({ rule: 'primary-diagnosis-missing', detail: 'no diagnosis is marked primary' });
  } else if (primaries > 1) {
    violations.push({ rule: 'primary-diagnosis-multiple', detail: `${primaries} diagnoses are marked primary` });
  }
}

function checkFindings(actions: PlannedAction[], expectations: EvalExpectations, violations: EvalViolation[]): void {
  for (const action of actions) {
    if (action.kind === 'add-exam-finding') {
      // A negated finding is not an abnormal finding. It must neither create one nor remove the
      // matching normal.
      if (findingPolarity(action.display ?? '') !== 'positive') {
        violations.push({
          rule: 'negated-finding-charted',
          detail: `"${action.display}" is a negative or a normal, but was charted as an exam finding`,
        });
      }
      for (const negated of expectations.negatedFindings ?? []) {
        if ((action.display ?? '').toLowerCase().includes(negated.toLowerCase())) {
          violations.push({
            rule: 'negated-finding-charted',
            detail: `the narrative negates "${negated}", but "${action.display}" was charted`,
          });
        }
      }
    }
    if (action.kind === 'add-ros-finding' && !rosPolarity(action.display ?? '', action.finding)) {
      violations.push({
        rule: 'ros-polarity-missing',
        detail: `"${action.display}" does not state reports/denies`,
      });
    }
  }
}

function checkVitals(actions: PlannedAction[], violations: EvalViolation[]): void {
  for (const action of actions.filter((a) => a.kind === 'set-vital')) {
    const field = action.field;
    if (!field || !(PLANNABLE_VITAL_FIELDS as readonly string[]).includes(field)) continue;
    if (field === 'vital-blood-pressure') {
      if (action.systolic == null || action.diastolic == null) {
        violations.push({ rule: 'vital-unit-unconverted', detail: 'blood pressure has no systolic/diastolic pair' });
      }
      continue;
    }
    if (action.value == null) {
      violations.push({ rule: 'vital-unit-unconverted', detail: `${field} was charted with no numeric value` });
      continue;
    }
    const allowed = VITAL_UNITS[field];
    // A unit the client's narrow write path does not recognise is charted as its DEFAULT — that is
    // how `1.73 m` becomes a 1.73 cm patient.
    if (allowed && !allowed.includes(String(action.unit))) {
      violations.push({
        rule: 'vital-unit-unconverted',
        detail: `${field} was charted in "${action.unit}", which is not one of ${allowed.join('/')}`,
      });
    }
    if (field === 'vital-height' && Number(action.value) < (action.unit === 'cm' ? 51 : 20)) {
      violations.push({
        rule: 'vital-implausible-charted',
        detail: `a height of ${action.value} ${action.unit} was charted instead of being questioned`,
      });
    }
  }
}

function checkBilling(actions: PlannedAction[], expectations: EvalExpectations, violations: EvalViolation[]): void {
  const em = actions.find((a) => a.kind === 'set-em-code');
  if (!em) {
    violations.push({ rule: 'em-code-missing', detail: 'no E&M level was charted' });
  } else if (!isCptShaped(em.code)) {
    violations.push({ rule: 'em-code-malformed', detail: `"${em.code}" is not a CPT shape` });
  } else if (expectations.patientStatus) {
    const family = expectations.patientStatus === 'new' ? NEW_PATIENT_EM : ESTABLISHED_EM;
    if (!family.has(em.code!)) {
      violations.push({
        rule: 'em-code-wrong-family',
        detail: `${em.code} is not in the ${expectations.patientStatus}-patient family`,
      });
    }
  }

  for (const cpt of actions.filter((a) => a.kind === 'add-cpt')) {
    if (!isCptShaped(cpt.code) && !isHcpcsShaped(cpt.code)) {
      violations.push({ rule: 'cpt-code-malformed', detail: `"${cpt.code}" is neither a CPT nor a HCPCS shape` });
    }
  }
}

function checkDisposition(actions: PlannedAction[], expectations: EvalExpectations, violations: EvalViolation[]): void {
  if (!expectations.expectsDisposition) return;
  if (!actions.some((a) => a.kind === 'set-disposition')) {
    violations.push({
      rule: 'disposition-missing',
      detail: 'the narrative states a follow-up or disposition, but none was charted',
    });
  }
}

/**
 * Every step must end in applied / skipped-with-reason / failed. A rejection with a blank reason is
 * a silent no-op wearing a hat: the provider reads it as "there was nothing to chart".
 */
function checkOutcomesAreReported(response: ChartPlanResponse, violations: EvalViolation[]): void {
  for (const rejection of response.rejected ?? []) {
    if (!rejection.reason?.trim()) {
      violations.push({ rule: 'rejection-without-reason', detail: `${rejection.kind} was skipped with no reason` });
    }
  }
}

/**
 * Provenance check, run separately because it needs the narrative. Every non-empty sourceText on a
 * returned action must genuinely occur in the narrative — the server drops unverified quotes, so a
 * violation here means that guard regressed.
 */
export function scoreProvenance(
  actions: PlannedAction[],
  narrative: string,
  quoteOccurs: (quote: string, narrative: string) => boolean
): EvalViolation[] {
  return actions
    .filter((action) => action.sourceText?.trim() && !quoteOccurs(action.sourceText, narrative))
    .map((action) => ({
      rule: 'provenance-quote-unverified' as const,
      detail: `"${action.sourceText}" does not occur in the narrative (${action.kind})`,
    }));
}
