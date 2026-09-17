/** Burn treatment, CPT 2026. Public rule explanations and short source excerpts are beside each decision.
 * ACEP Coding and Nomenclature Committee, 2019 (corroboration, not a licensed CPT 2026 codebook):
 * https://www.acepnow.com/article/coding-wizard-how-to-document-burn-treatment/
 * Full licensed CPT 2026 guideline verification remains outstanding.
 */
import { buildEvaluation, coder, DailyUnitLimits, missing, MueAdjudication } from '../cpt';
import { BURN_TREATMENT_PTP_EDITS } from '../medicare-ptp';
import { FamilyEvaluation, ProcedureFamilyModel } from '../model.types';
import { PROCEDURE_NAMES } from '../procedure-names';
import { CodingField, readNumber, StructuredFacts } from '../structured-fields';

const BURN_CODES = {
  InitialFirstDegree: '16000',
  PartialThicknessUnder5Percent: '16020',
  PartialThickness5To10Percent: '16025',
  PartialThicknessOver10Percent: '16030',
} as const;
type BurnTreatmentCode = (typeof BURN_CODES)[keyof typeof BURN_CODES];

const BURN_DEGREE = {
  First: 'first',
  PartialThickness: 'partial thickness',
  FullThickness: 'full thickness',
} as const;

// Surface-area bands from the ACEP explanation cited above, expressed as percent TBSA.
const MEDIUM_BURN_MIN_PERCENT = 5;
const MEDIUM_BURN_MAX_PERCENT = 10;

// Form precision/validity, separate from the clinical code bands.
const MAX_BODY_SURFACE_PERCENT = 100;
const SURFACE_AREA_STEP_PERCENT = 0.1;

const SURFACE_AREA_SCALE = 1 / SURFACE_AREA_STEP_PERCENT;
const DECIMAL_ROUNDING_TOLERANCE = 1e-8;

const BURN_FIELDS: readonly CodingField[] = [
  {
    key: 'degree',
    label: 'Deepest burn degree treated',
    kind: 'select',
    options: Object.values(BURN_DEGREE),
  },
  {
    key: 'tbsa',
    visible: (facts) => facts.degree === BURN_DEGREE.PartialThickness,
    label: 'Treated partial-thickness body surface (%)',
    kind: 'number',
    min: 0,
    step: SURFACE_AREA_STEP_PERCENT,
  },
];

/** CMS Practitioner MUE, effective 2026-10-01, rows 16000/16020/16025/16030.
 * https://www.cms.gov/files/zip/medicare-ncci-2026-q4-practitioner-services-mue-table.zip
 * Exact source values: 16000 = 1 unit, MAI 2; 16020/16025/16030 = 1 unit, MAI 3.
 * Excess produces a warning, never a capped quantity.
 */
const BURN_DAILY_LIMITS: DailyUnitLimits<BurnTreatmentCode> = {
  [BURN_CODES.InitialFirstDegree]: { maxUnits: 1, adjudicationIndicator: MueAdjudication.DateOfServicePolicy },
  [BURN_CODES.PartialThicknessUnder5Percent]: {
    maxUnits: 1,
    adjudicationIndicator: MueAdjudication.DateOfServiceClinical,
  },
  [BURN_CODES.PartialThickness5To10Percent]: {
    maxUnits: 1,
    adjudicationIndicator: MueAdjudication.DateOfServiceClinical,
  },
  [BURN_CODES.PartialThicknessOver10Percent]: {
    maxUnits: 1,
    adjudicationIndicator: MueAdjudication.DateOfServiceClinical,
  },
};

function suggestBurnTreatment(facts: StructuredFacts): FamilyEvaluation {
  if (!facts.degree) return missing('Deepest burn degree treated');

  // Product coverage: this family implements local first-degree/partial-thickness treatment only.
  // Full-thickness care needs a different coding pathway; the degree alone cannot choose that procedure.
  if (facts.degree === BURN_DEGREE.FullThickness)
    return coder('Treatment of a full-thickness burn is coded outside the local burn treatment codes.');

  // ACEP source above, CPT 16000 paragraph: first-degree local treatment.
  // Product assumption: initial treatment, with no extra initial/follow-up attestation on the form.
  if (facts.degree === BURN_DEGREE.First)
    return buildEvaluation({
      suggestions: [
        {
          code: BURN_CODES.InitialFirstDegree,
          display: 'Initial treatment of first-degree burn',
          justification: 'First-degree treatment; initial visit assumed.',
          units: 1,
          modifiers: [],
        },
      ],
    });

  const tbsa = readNumber(facts, 'tbsa');

  // Input validity, not a CPT billing rule: positive percentage up to 100, entered to one decimal place.
  const hasOneDecimalPlace =
    tbsa !== undefined &&
    Math.abs(tbsa * SURFACE_AREA_SCALE - Math.round(tbsa * SURFACE_AREA_SCALE)) <= DECIMAL_ROUNDING_TOLERANCE;

  if (!tbsa || tbsa > MAX_BODY_SURFACE_PERCENT || !hasOneDecimalPlace)
    return missing('Treated partial-thickness body surface (%)');

  // ACEP source above, final clinical paragraph; these excerpts describe the three CPT size bands.
  let cpt: BurnTreatmentCode;

  if (tbsa < MEDIUM_BURN_MIN_PERCENT) {
    // 16020: "<5 percent TBSA partial thickness burns".
    cpt = BURN_CODES.PartialThicknessUnder5Percent;
  } else if (tbsa <= MEDIUM_BURN_MAX_PERCENT) {
    // 16025: "TBSA 5 to 10 percent partial thickness burns".
    cpt = BURN_CODES.PartialThickness5To10Percent;
  } else {
    // 16030: "TBSA >10 percent partial thickness burns".
    cpt = BURN_CODES.PartialThicknessOver10Percent;
  }

  return buildEvaluation({
    suggestions: [
      {
        code: cpt,
        display: 'Dressing/debridement of partial-thickness burn',
        justification: 'Code based on treated partial-thickness surface area.',
        units: 1,
        modifiers: [],
      },
    ],
  });
}

export const burnTreatmentFamily: ProcedureFamilyModel<BurnTreatmentCode> = {
  id: 'burn-treatment',
  displayName: 'Burn treatment',
  procedureNames: PROCEDURE_NAMES['burn-treatment'],
  fields: BURN_FIELDS,
  codes: Object.values(BURN_CODES),
  codePairEdits: BURN_TREATMENT_PTP_EDITS,
  dailyLimits: BURN_DAILY_LIMITS,
  // ACEP names depth, surface area and treatment. Follow-up is a product documentation reminder.
  // ACEP documentation elements: sites, depth, treated area and treatment. Measurement-method detail is a documentation reminder.
  // https://www.acepnow.com/article/coding-wizard-how-to-document-burn-treatment/
  documentationChecklist: (facts) => [
    'Record burn sites and laterality, depth at each site, local treatment, dressing and any debridement performed.',
    ...(facts.degree === BURN_DEGREE.PartialThickness
      ? [
          'Record treated partial-thickness TBSA by site and total, including the measurement method (rule of nines, Lund–Browder or burn diagram).',
        ]
      : []),
    'Record outcome and follow-up instructions.',
  ],
  suggest: suggestBurnTreatment,
};
