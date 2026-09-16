/** Implements the cited rules using explicit form answers. Target code set: CPT 2026.
 * CMS NCCI 2026 Chapters III §L.8 and VII; CMS 2026 HCPCS P9612 / CPT 51701–51703.
 * Original, Ch.VII: "Insertion of a urinary bladder catheter is a component of the global surgical package."
 * https://www.cms.gov/files/document/07-chapter7-ncci-medicare-policy-manual-2026-final.pdf
 * https://www.cms.gov/files/document/03-chapter3-ncci-medicare-policy-manual-2026-final.pdf
 */
import { buildEvaluation, missing, MueAdjudication, noCode } from '../cpt';
import { URINARY_CATHETERIZATION_PTP_EDITS } from '../medicare-ptp';
import { CodeSuggestion, ProcedureFamilyModel } from '../model.types';
import { PROCEDURE_NAMES } from '../procedure-names';
import { CodingField } from '../structured-fields';

const URINARY_CATHETERIZATION_CODES = {
  StraightCatheter: '51701',
  SimpleIndwellingCatheter: '51702',
  ComplicatedIndwellingCatheter: '51703',
  MedicareUrineSpecimen: 'P9612',
} as const;
type UrinaryCatheterizationCode = (typeof URINARY_CATHETERIZATION_CODES)[keyof typeof URINARY_CATHETERIZATION_CODES];

const fields: readonly CodingField[] = [
  {
    key: 'catheter',
    label: 'Catheter type',
    kind: 'select',
    options: ['straight', 'indwelling'],
  },
  {
    key: 'complicated',
    label: 'Complicated indwelling insertion',
    kind: 'checkbox',
    defaultValue: false,
    visible: (facts) => facts.catheter === 'indwelling',
  },
  {
    key: 'purpose',
    label: 'Purpose',
    kind: 'select',
    options: ['retention/drainage', 'residual urine measurement', 'specimen only', 'other'],
    defaultValue: 'retention/drainage',
  },
  { key: 'partOfOtherProcedure', label: 'Part of another procedure', kind: 'checkbox', defaultValue: false },
];

export const urinaryCatheterizationFamily: ProcedureFamilyModel<UrinaryCatheterizationCode> = {
  codePairEdits: URINARY_CATHETERIZATION_PTP_EDITS,
  id: 'urinary-catheterization',
  procedureNames: PROCEDURE_NAMES['urinary-catheterization'],
  displayName: 'Urinary catheterization',
  fields,
  codes: Object.values(URINARY_CATHETERIZATION_CODES),
  suggest: (facts) => {
    if (facts.partOfOtherProcedure) return noCode('Catheterization is included in the other procedure.');
    if (!facts.catheter) return missing('Catheter type');

    // Code stem: complexity changes indwelling insertion only, not straight catheterization.
    let cpt: UrinaryCatheterizationCode = URINARY_CATHETERIZATION_CODES.StraightCatheter;

    if (facts.catheter === 'indwelling') {
      cpt = facts.complicated
        ? URINARY_CATHETERIZATION_CODES.ComplicatedIndwellingCatheter
        : URINARY_CATHETERIZATION_CODES.SimpleIndwellingCatheter;
    }

    const suggestions: CodeSuggestion[] = [
      {
        code: cpt,
        display: 'Insertion of bladder catheter',
        justification: 'Documented catheter type and insertion complexity.',
        units: 1,
        modifiers: [],
      },
    ];

    if (facts.catheter === 'straight' && facts.purpose === 'specimen only') {
      suggestions[0].alternative = 'standard';
      suggestions.push({
        code: URINARY_CATHETERIZATION_CODES.MedicareUrineSpecimen,
        display: 'Catheterization for urine specimen',
        justification: 'Medicare specimen-only alternative.',
        units: 1,
        modifiers: [],
        alternative: 'Medicare',
      });

      return buildEvaluation({
        suggestions,
        findings: [],
        payerNotes: ['For specimen-only catheterization, choose the payer-appropriate alternative; do not add both.'],
      });
    }

    return buildEvaluation({
      suggestions,
      findings: [],
      payerNotes: ['Catheterization included in another procedure is not separately billable.'],
    });
  },
  dailyLimits: {
    [URINARY_CATHETERIZATION_CODES.StraightCatheter]: {
      maxUnits: 2,
      adjudicationIndicator: MueAdjudication.DateOfServiceClinical,
    },
    [URINARY_CATHETERIZATION_CODES.SimpleIndwellingCatheter]: {
      maxUnits: 2,
      adjudicationIndicator: MueAdjudication.DateOfServiceClinical,
    },
    [URINARY_CATHETERIZATION_CODES.ComplicatedIndwellingCatheter]: {
      maxUnits: 2,
      adjudicationIndicator: MueAdjudication.DateOfServiceClinical,
    },
    [URINARY_CATHETERIZATION_CODES.MedicareUrineSpecimen]: {
      maxUnits: 1,
      adjudicationIndicator: MueAdjudication.DateOfServiceClinical,
    },
  },
  // Product checklist: catheter type/size, preparation, result and disposition; not extra coding gates.
  // https://www.cms.gov/files/document/07-chapter7-ncci-medicare-policy-manual-2026-final.pdf (§C.1: procedural inclusion)
  documentationChecklist: (facts) => [
    'Record indication, catheter type and French size, preparation, urine volume/character and result.',
    ...(facts.catheter === 'indwelling'
      ? [
          'Record balloon volume, drainage-bag connection and catheter removal/follow-up plan.',
          ...(facts.complicated ? ['Describe the actual insertion difficulty and additional technique used.'] : []),
        ]
      : ['Record catheter removal after drainage or specimen collection.']),
    ...(facts.purpose === 'specimen only' ? ['Record the specimen obtained and laboratory testing ordered.'] : []),
  ],
};
