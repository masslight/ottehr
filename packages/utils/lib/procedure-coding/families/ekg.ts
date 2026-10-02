/** Implements the cited rules using explicit form answers. Target code set: CPT 2026.
 * CMS Claims Processing Manual Ch.13 §100.1; NCCI 2026 Ch.XI §I.
 * https://www.cms.gov/regulations-and-guidance/guidance/manuals/downloads/clm104c13.pdf
 * https://www.cms.gov/files/document/11-chapter11a-ncci-medicare-policy-manual-2026-final.pdf
 */
import { buildEvaluation, CPT_MODIFIERS, missing, MueAdjudication, noCode } from '../cpt';
import { EKG_PTP_EDITS } from '../medicare-ptp';
import { CodeSuggestion, ProcedureFamilyModel } from '../model.types';
import { PROCEDURE_NAMES } from '../procedure-names';
import { CodingField, readNumber, StructuredFacts } from '../structured-fields';
import {
  EKG_AXES,
  EKG_COMPARISONS,
  EKG_CONDUCTION,
  EKG_IMPRESSIONS,
  EKG_OTHER_FINDINGS,
  EKG_RHYTHMS,
  EKG_ST_T,
  QTC_METHODS,
} from './ekg-interpretation';

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
  // Measurements, read off the printout. None is required to save; 93000 needs the rate and intervals.
  { key: 'rate', label: 'Rate (bpm)', kind: 'number', min: 0, step: 1 },
  { key: 'pr', label: 'PR (ms)', kind: 'number', min: 0, step: 1 },
  { key: 'qrs', label: 'QRS (ms)', kind: 'number', min: 0, step: 1 },
  { key: 'qt', label: 'QT (ms)', kind: 'number', min: 0, step: 1 },
  // Calculated from QT and rate by the page (see ekgQtc) unless the method is manual; both are stored so
  // the note can say how the value was arrived at.
  { key: 'qtc', label: 'QTc (ms)', kind: 'number', min: 0, step: 1 },
  { key: 'qtcMethod', label: 'QTc method', kind: 'select', options: QTC_METHODS },
  { key: 'axisDegrees', label: 'Axis (°)', kind: 'number', min: -180, step: 1 },
  // Interpretation. "Other findings" is optional; the rest are needed for the interpretation and report.
  { key: 'rhythm', label: 'Rhythm', kind: 'select', options: EKG_RHYTHMS },
  { key: 'axis', label: 'Axis', kind: 'select', options: EKG_AXES },
  { key: 'conduction', label: 'Intervals and conduction', kind: 'multi', options: EKG_CONDUCTION, exclusive: 'normal' },
  { key: 'stt', label: 'ST / T', kind: 'multi', options: EKG_ST_T, exclusive: 'no acute ST-T wave changes' },
  {
    key: 'otherFindings',
    label: 'Other findings',
    kind: 'multi',
    options: EKG_OTHER_FINDINGS,
    exclusive: 'none',
    details: true,
  },
  { key: 'comparison', label: 'Comparison with prior', kind: 'select', options: EKG_COMPARISONS },
  { key: 'impression', label: 'Impression', kind: 'select', options: EKG_IMPRESSIONS },
];

/** The interpretation fields a report must cover besides the rate and intervals; "Other findings" is optional. */
const REPORT_FIELDS = ['rhythm', 'axis', 'conduction', 'stt', 'comparison', 'impression'];

const label = (key: string): string => fields.find((field) => field.key === key)?.label ?? key;

/** What the interpretation and report (CMS Claims Manual Ch.13 §100.1) still needs before 93000 is supported. */
const reportGaps = (facts: StructuredFacts): string[] => [
  ...(readNumber(facts, 'rate') === undefined ? [label('rate')] : []),
  ...(['pr', 'qrs', 'qt'].some((key) => readNumber(facts, key) === undefined) ? ['PR, QRS and QT intervals'] : []),
  ...REPORT_FIELDS.filter((key) => facts[key] === undefined).map(label),
];

export const ekgFamily: ProcedureFamilyModel<EkgCode> = {
  codePairEdits: EKG_PTP_EDITS,
  // MPFS PC/TC indicator 4 on 93000: it is the global service, with 93005 the technical component
  // (indicator 3) and 93010 the professional component (indicator 2). Neither component takes
  // modifier 26 or TC, because each descriptor already names its component.
  // CMS Claims Processing Manual Ch.13 §100.1 defines what the professional component must contain.
  // Adopted policy: choosing a component is flagged, never blocked — the provider keeps the selection.
  componentCodeNotices: [
    {
      selected: [EKG_CODES.TracingOnly, EKG_CODES.InterpretationAndReportOnly],
      global: EKG_CODES.TracingAndReport,
      message:
        'Documentation supports the full recording with interpretation and report; a component-only code is selected.',
    },
  ],
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

    // The global code includes the interpretation and report; a brief "normal" alone does not support it.
    if (facts.component === 'tracing and report') {
      const gaps = reportGaps(facts);
      if (gaps.length) return missing(...gaps);
    }
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
