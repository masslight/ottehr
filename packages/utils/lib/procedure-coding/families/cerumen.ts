/** Implements the cited rules using explicit form answers. Target code set: CPT 2026.
 * AMA CPT Assistant January 2016, pp. 1–4 (authorized AAO-HNS republication):
 * https://www.entnet.org/wp-content/uploads/2022/01/CPT-Assistant-69209-Cerumen-Removal_website.pdf
 * CMS MPFS RVU26A row 69210, bilateral indicator 2, supports the Medicare one-unit alternative:
 * https://www.cms.gov/files/zip/rvu26a.zip
 * Same-ear foreign-body access bundling comes from the PTP edits, not the CPT Assistant article.
 */
import { buildEvaluation, CPT_MODIFIERS, missing, MueAdjudication, noCode } from '../cpt';
import { CERUMEN_PTP_EDITS } from '../medicare-ptp';
import { CodeSuggestion, LegacyProcedureFields, ProcedureFamilyModel } from '../model.types';
import { PROCEDURE_NAMES } from '../procedure-names';
import { CodingField, selectedSide } from '../structured-fields';

const CERUMEN_CODES = {
  Irrigation: '69209',
  Instrumentation: '69210',
} as const;

type CerumenCode = (typeof CERUMEN_CODES)[keyof typeof CERUMEN_CODES];

const fields: readonly CodingField[] = [
  {
    key: 'impaction',
    label: 'Impaction established by',
    kind: 'select',
    options: [
      'obstructed examination',
      'hard symptomatic wax',
      'inflammation',
      'obstructive wax requiring skilled removal',
      'not impacted',
    ],
  },
  {
    key: 'leftMethod',
    label: 'Left ear removal method',
    kind: 'select',
    options: ['not treated', 'irrigation', 'instruments', 'both'],
    defaultValue: 'not treated',
  },
  {
    key: 'rightMethod',
    label: 'Right ear removal method',
    kind: 'select',
    options: ['not treated', 'irrigation', 'instruments', 'both'],
    defaultValue: 'not treated',
  },
  {
    key: 'leftForeignBodyAccess',
    label: 'Left ear wax cleared only to access a foreign body',
    kind: 'checkbox',
    defaultValue: false,
  },
  {
    key: 'rightForeignBodyAccess',
    label: 'Right ear wax cleared only to access a foreign body',
    kind: 'checkbox',
    defaultValue: false,
  },
];

export const cerumenFamily: ProcedureFamilyModel<CerumenCode> = {
  codePairEdits: CERUMEN_PTP_EDITS,
  capturesSite: true,
  capturesSide: true,
  id: 'cerumen',
  procedureNames: PROCEDURE_NAMES['cerumen'],
  displayName: 'Cerumen removal',
  fields,
  codes: Object.values(CERUMEN_CODES),
  suggest: (facts) => {
    if (!facts.impaction) return missing('Impaction established by');

    // CPT Assistant excludes non-impacted wax from 69209/69210. Access work is handled separately below.
    if (facts.impaction === 'not impacted') return noCode('No separate cerumen-removal code for this case.');

    const codeForEarMethod = (method: unknown): string | undefined => {
      if (method === 'irrigation') return CERUMEN_CODES.Irrigation;
      if (method === 'instruments' || method === 'both') return CERUMEN_CODES.Instrumentation;
      return undefined;
    };

    // Instrumentation governs when both methods were used on one ear (CPT Assistant, coding tip).
    const leftEarCode = facts.leftForeignBodyAccess ? undefined : codeForEarMethod(facts.leftMethod);
    const rightEarCode = facts.rightForeignBodyAccess ? undefined : codeForEarMethod(facts.rightMethod);

    if (!leftEarCode && !rightEarCode && (facts.leftForeignBodyAccess || facts.rightForeignBodyAccess))
      return noCode('Wax removal solely to access a foreign body is included in that procedure.');

    if (!leftEarCode && !rightEarCode) return missing('Left ear removal method', 'Right ear removal method');

    if (leftEarCode && leftEarCode === rightEarCode) {
      const suggestions: CodeSuggestion[] = [
        {
          code: leftEarCode,
          display: 'Removal of impacted cerumen',
          justification: 'Bilateral removal: CPT reporting option.',
          units: 1,
          modifiers: [CPT_MODIFIERS.Bilateral],
          // Only an instrumentation removal has a second, Medicare-specific way to report the same care.
          ...(leftEarCode === CERUMEN_CODES.Instrumentation ? { alternative: 'standard' as const } : {}),
        },
      ];

      if (leftEarCode === CERUMEN_CODES.Instrumentation)
        suggestions.push({
          code: leftEarCode,
          display: 'Removal of impacted cerumen',
          justification: 'Medicare bilateral reporting option.',
          units: 1,
          modifiers: [],
          alternative: 'Medicare',
        });

      return buildEvaluation({
        suggestions,
        findings: [],
        payerNotes:
          leftEarCode === CERUMEN_CODES.Instrumentation
            ? [
                'Choose the payer-appropriate alternative, not both. Medicare bilateral removal uses one unit without modifier 50.',
              ]
            : [],
      });
    }
    const suggestions: CodeSuggestion[] = [];

    if (leftEarCode) {
      suggestions.push({
        code: leftEarCode,
        display: 'Removal of impacted cerumen',
        justification: 'Left ear method documented.',
        units: 1,
        modifiers: [CPT_MODIFIERS.LeftSide],
      });
    }

    if (rightEarCode) {
      suggestions.push({
        code: rightEarCode,
        display: 'Removal of impacted cerumen',
        justification: 'Right ear method documented.',
        units: 1,
        modifiers: [CPT_MODIFIERS.RightSide],
      });
    }

    return buildEvaluation({ suggestions });
  },
  dailyLimits: {
    [CERUMEN_CODES.Irrigation]: { maxUnits: 1, adjudicationIndicator: MueAdjudication.DateOfServicePolicy },
    [CERUMEN_CODES.Instrumentation]: { maxUnits: 1, adjudicationIndicator: MueAdjudication.DateOfServicePolicy },
  },
  // AMA-authorized CPT Assistant (January 2016): impaction, ear and removal method. Post-removal exam is a documentation reminder.
  // https://www.entnet.org/wp-content/uploads/2022/01/CPT-Assistant-69209-Cerumen-Removal_website.pdf
  documentationChecklist: (facts) => {
    const methods = [facts.leftMethod, facts.rightMethod];
    const checklist = [
      'Record treated ears, the impaction finding and diagnosis laterality (H61.21/H61.22/H61.23).',
      'Record removal result, complications and the post-removal examination of the ear canal and tympanic membrane.',
    ];
    if (methods.some((method) => method === 'irrigation' || method === 'both'))
      checklist.push('Record irrigation solution or cerumenolytic used, performer and applicable supervision.');
    if (methods.some((method) => method === 'instruments' || method === 'both'))
      checklist.push(
        'Name the instruments and visualization used, clinician performing removal, and work requiring clinician skill.'
      );
    return checklist;
  },
  readLegacyFacts: (input: LegacyProcedureFields) => {
    const methods = input.technique ?? [];

    const instrument = ['Curette', 'Cerumen Loop', 'Micro-suction', 'Forceps', 'Splinter Forceps'].some((option) =>
      methods.includes(option)
    );

    const irrigation = methods.includes('Irrigation / Lavage');
    let method = 'not treated';

    if (instrument && irrigation) method = 'both';
    else if (instrument) method = 'instruments';
    else if (irrigation) method = 'irrigation';

    const side = selectedSide(input);

    return {
      leftMethod: side === 'left' || side === 'both' ? method : 'not treated',
      rightMethod: side === 'right' || side === 'both' ? method : 'not treated',
    };
  },
};
