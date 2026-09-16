import { ProcedureFactsInput } from 'utils';

/**
 * Scenarios for the AI accuracy dashboard's "Billing Codes" suite.
 *
 * What this suite measures: whether the model returns the right code for a documented procedure,
 * and whether it keeps returning it. Every scenario runs several times per night (RUNS_PER_SCENARIO
 * in test-billing-codes.ts) and the dashboard plots the pass rate, so a model that answers
 * correctly only some of the time shows up as a number below 100% rather than as a pass.
 *
 * Which procedure types belong here: only the ones the local rules engine does not cover, because
 * recommend-billing-codes answers from the engine for every covered type and calls the model only
 * for the rest. Uncovered today: X-Ray, Wound Care / Dressing Change, Tick or Insect Removal,
 * Staple or Suture Removal, Oral Rehydration, Nasal Lavage. The names match
 * config/oystehr/procedure-type.json; the covered ones are in
 * packages/utils/lib/procedure-coding/procedure-names.ts.
 *
 * How the expected answer is chosen: each note below is written so that exactly one CPT descriptor
 * fits it, and that code is the expectation. Where a note has no single defensible answer — suture
 * removal, oral rehydration, nasal lavage, where the answer depends on payer policy and on who
 * performed the original service — there is no scenario, because the suite would then be charting
 * our guess instead of the model's accuracy. A biller can add those later.
 */
export interface ScenarioChecks {
  /** At least one of these codes must appear in the suggestions. */
  expectAnyCodes?: string[];
  /** None of these codes may appear — the note does not document the work they describe. */
  expectNoneOfCodes?: string[];
  /**
   * Printed in the run log next to the codes the model returned, so a failure reads as a sentence
   * instead of a row of five-digit numbers. Never compared with anything: the pass or fail comes
   * from the code lists above, and the model's own wording of the code is not checked at all.
   */
  expected: string;
}

export interface TestScenario {
  label: string;
  input: ProcedureFactsInput;
  checks: ScenarioChecks;
}

// Two views are documented, which is what separates 71046 from 71045 (one view) and 71047 (three).
const CHEST_XRAY: ProcedureFactsInput = {
  procedureType: 'X-Ray',
  diagnoses: [{ code: 'R05.9', display: 'Cough, unspecified' }],
  bodySite: 'chest',
  procedureDetails:
    'Two-view chest x-ray (PA and lateral) obtained in the office for persistent cough. Both images reviewed; no acute infiltrate or effusion.',
};

// An incision is documented, which is what 10120 describes; removal with forceps alone is not.
const TICK_REMOVAL: ProcedureFactsInput = {
  procedureType: 'Tick or Insect Removal',
  diagnoses: [{ code: 'W57.XXXA', display: 'Bitten by nonvenomous insect, initial encounter' }],
  bodySite: 'scalp',
  suppliesUsed: ['scalpel', 'forceps'],
  procedureDetails:
    'Embedded tick in the scalp with retained mouthparts. Area cleaned and anesthetized, a small incision made through the skin and the foreign body removed with forceps. Wound irrigated and closed with a single adhesive strip.',
};

// Selective debridement of devitalized tissue, 12 sq cm — the first-20-sq-cm code.
const WOUND_DEBRIDEMENT: ProcedureFactsInput = {
  procedureType: 'Wound Care / Dressing Change',
  diagnoses: [{ code: 'L98.491', display: 'Non-pressure chronic ulcer of skin of other sites' }],
  bodySite: 'lower leg',
  bodySide: 'left',
  procedureDetails:
    'Dressing removed from a 12 sq cm left lower-leg ulcer. Selective debridement of devitalized tissue performed with forceps and scissors down to viable tissue, no anesthesia required. Clean dressing applied.',
};

// The same visit without any debridement: a dressing change alone documents no separate procedure.
const DRESSING_CHANGE_ONLY: ProcedureFactsInput = {
  procedureType: 'Wound Care / Dressing Change',
  diagnoses: [{ code: 'L98.491', display: 'Non-pressure chronic ulcer of skin of other sites' }],
  bodySite: 'lower leg',
  bodySide: 'left',
  procedureDetails:
    'Old dressing removed from the left lower-leg ulcer. Wound irrigated with saline, no devitalized tissue present and no debridement performed. Clean dry dressing applied.',
};

export const TEST_SCENARIOS: TestScenario[] = [
  {
    label: 'Two-view chest x-ray → expect 71046',
    input: CHEST_XRAY,
    checks: {
      expectAnyCodes: ['71046'],
      expected: '71046 — radiologic examination, chest, 2 views',
    },
  },
  {
    label: 'Embedded tick removed through an incision → expect 10120',
    input: TICK_REMOVAL,
    checks: {
      expectAnyCodes: ['10120'],
      expected: '10120 — incision and removal of foreign body, subcutaneous tissues, simple',
    },
  },
  {
    label: 'Selective debridement of a 12 sq cm ulcer → expect 97597',
    input: WOUND_DEBRIDEMENT,
    checks: {
      expectAnyCodes: ['97597'],
      expected: '97597 — selective debridement, open wound, first 20 sq cm or less',
    },
  },
  {
    label: 'Dressing change with no debridement → must not claim a debridement code',
    input: DRESSING_CHANGE_ONLY,
    checks: {
      // The hallucination check: nothing in the note documents debridement of any kind.
      expectNoneOfCodes: ['97597', '97598', '97602', '11042', '11043'],
      expected: 'no debridement code (97597/97598/97602/11042/11043)',
    },
  },
];
