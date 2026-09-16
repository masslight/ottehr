/** Implements the cited rules using explicit form answers. Target code set: CPT 2026.
 * CMS Claims Processing Manual Ch.13 §100.1; NCCI 2026 Ch.XI §I.
 * https://www.cms.gov/regulations-and-guidance/guidance/manuals/downloads/clm104c13.pdf
 * https://www.cms.gov/files/document/11-chapter11a-ncci-medicare-policy-manual-2026-final.pdf
 */
import { buildEvaluation, CPT_MODIFIERS, missing, MueAdjudication, noCode } from '../cpt';
import { EKG_PTP_EDITS } from '../medicare-ptp';
import { CodeSuggestion, ProcedureFamilyModel } from '../model.types';
import { PROCEDURE_NAMES } from '../procedure-names';
import { CodingField, readNumber } from '../structured-fields';

const EKG_CODES = {
  TracingAndReport: '93000',
  TracingOnly: '93005',
  InterpretationAndReportOnly: '93010',
} as const;

type EkgCode = (typeof EKG_CODES)[keyof typeof EKG_CODES];

const fields: readonly CodingField[] = [
  {
    key: 'component',
    label: 'Component furnished',
    kind: 'select',
    options: ['tracing and report', 'tracing only', 'interpretation/report only'],
  },
  { key: 'count', label: 'Same-day recordings', kind: 'number', defaultValue: 1, min: 0, step: 1 },
  {
    key: 'repeatClinician',
    label: 'Repeat clinician',
    kind: 'select',
    options: ['same', 'different'],
    defaultValue: 'same',
    details: true,
    // Only read when a repeat recording exists; asking otherwise adds a question that cannot change the code.
    visible: (facts) => (readNumber(facts, 'count') ?? 1) > 1,
  },
  {
    key: 'integralEcg',
    label: 'ECG integral to stress testing or monitoring',
    kind: 'checkbox',
    defaultValue: false,
    details: true,
  },
];

export const ekgFamily: ProcedureFamilyModel<EkgCode> = {
  codePairEdits: EKG_PTP_EDITS,
  id: 'ekg',
  procedureNames: PROCEDURE_NAMES['ekg'],
  displayName: 'EKG',
  fields,
  codes: Object.values(EKG_CODES),
  suggest: (facts) => {
    if (facts.integralEcg) return noCode('The ECG is included in the stress test or monitoring service.');
    if (!facts.component) return missing('Component furnished');

    const count = readNumber(facts, 'count');

    if (!count || !Number.isInteger(count)) return missing('Same-day recordings');
    let cpt: EkgCode = EKG_CODES.InterpretationAndReportOnly;
    if (facts.component === 'tracing and report') cpt = EKG_CODES.TracingAndReport;
    else if (facts.component === 'tracing only') cpt = EKG_CODES.TracingOnly;

    // Each repeat is a separate service; preserve rows for repeat modifiers rather than collapsing units.
    const suggestions: CodeSuggestion[] = [];

    suggestions.push({
      code: cpt,
      display: 'Electrocardiogram',
      justification: String(facts.component),
      units: 1,
      modifiers: [],
    });

    if (count > 1) {
      suggestions.push({
        code: cpt,
        display: 'Electrocardiogram',
        justification: 'Separate repeat recordings.',
        units: count - 1,
        modifiers: [
          facts.repeatClinician === 'different'
            ? CPT_MODIFIERS.RepeatDifferentClinician
            : CPT_MODIFIERS.RepeatSameClinician,
        ],
      });
    }

    return buildEvaluation({ suggestions });
  },
  dailyLimits: {
    [EKG_CODES.TracingAndReport]: { maxUnits: 3, adjudicationIndicator: MueAdjudication.DateOfServiceClinical },
    [EKG_CODES.TracingOnly]: { maxUnits: 3, adjudicationIndicator: MueAdjudication.DateOfServiceClinical },
    [EKG_CODES.InterpretationAndReportOnly]: {
      maxUnits: 5,
      adjudicationIndicator: MueAdjudication.DateOfServiceClinical,
    },
  },
  // CMS Claims Manual Ch.13 §100.1: separately identifiable interpretation/report addressing findings and clinical issues.
  // https://www.cms.gov/regulations-and-guidance/guidance/manuals/downloads/clm104c13.pdf
  documentationChecklist: (facts) => [
    'Record the order/indication and date/time; retain the patient-identified 12-lead tracing.',
    ...(facts.component && facts.component !== 'tracing only'
      ? [
          'Retain a signed, retrievable interpretation addressing rhythm/rate, axis, intervals, ST-T findings, relevant clinical issues and comparison when available.',
          'The interpretation should inform treatment; a brief “normal ECG” notation alone is insufficient.',
        ]
      : []),
    ...((readNumber(facts, 'count') ?? 1) > 1
      ? ['For each repeat, record its time, clinical reason and interpreting clinician.']
      : []),
  ],
};
