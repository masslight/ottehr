import { VitalFieldNames } from 'utils/lib/types/api/chart-data/chart-data.constants';
import { VITAL_LABELS } from './sections/visit-note/vitals';
import { ProgressNoteData } from './types';

/**
 * Plain-text rendering of the composed progress note, for the configurable AI note review that runs
 * before signing.
 *
 * The input is the exact same `ProgressNoteData` the visit-note PDF renders, so the reviewer sees the
 * note the provider is about to sign rather than a separate, drifting serialization.
 *
 * ROS and Exam carry an explicit documented-system count. Several configured prompts are threshold
 * rules ("at least 4 systems with at least one item each"), and models are far more reliable
 * comparing a stated number than counting headings in free text.
 */

interface Section {
  heading: string;
  lines: string[];
}

const bullet = (text: string): string => `- ${text}`;

const listSection = (heading: string, values: (string[] | undefined)[]): Section => ({
  heading,
  lines: values
    .flatMap((value) => value ?? [])
    .filter((line) => line.trim().length > 0)
    .map(bullet),
});

const textSection = (heading: string, value: string | undefined): Section => ({
  heading,
  lines: value?.trim() ? [value.trim()] : [],
});

const serializeVitals = (data: ProgressNoteData): Section => {
  const vitals = data.vitals?.vitals;
  if (!vitals) return { heading: 'VITALS', lines: [] };

  const lines = (Object.keys(VITAL_LABELS) as (VitalFieldNames | 'notes')[]).flatMap((field) => {
    const records = vitals[field as VitalFieldNames];
    if (!records?.length) return [];
    // DOT vision screening records are multi-line (MCSA-5875 layout); keep each line on its own row
    // so a prompt asking about, say, color vision can actually find it.
    return records.flatMap((record) =>
      record
        .split('\n')
        .map((line) => line.trim())
        .filter(Boolean)
        .map((line) => bullet(`${VITAL_LABELS[field]}: ${line}`))
    );
  });

  return { heading: 'VITALS', lines };
};

const serializeRos = (data: ProgressNoteData): Section => {
  // The composer only emits a group once it has at least one checked item, so every entry counts.
  const groups = Object.entries(data.rosObservations?.rosObservations ?? {});

  return {
    heading: 'REVIEW OF SYSTEMS',
    lines: [
      `Systems documented with at least one item: ${groups.length}`,
      ...groups.map(([label, group]) =>
        bullet(
          `${label}: ${group.items.map((item) => `${item.label} (${item.abnormal ? 'reports' : 'denies'})`).join(', ')}`
        )
      ),
    ],
  };
};

// Synthetic group the composer appends for observations that no longer match the exam config. Its
// items belong in the note, but it is not a system, so it must not inflate the documented count.
const OTHER_EXAM_FINDINGS_KEY = 'other-findings';

const serializeExam = (data: ProgressNoteData): Section => {
  // Unlike ROS, the exam composer emits every configured section whether or not anything is checked.
  const groups = Object.entries(data.examination?.examination ?? {});
  const documented = groups.filter(([key, group]) => key !== OTHER_EXAM_FINDINGS_KEY && (group.items?.length ?? 0) > 0);

  return {
    heading: 'EXAM',
    lines: [
      `Systems documented with at least one item: ${documented.length}`,
      ...groups.flatMap(([, group]) => {
        const items = (group.items ?? []).map((item) => `${item.label}${item.abnormal ? ' (abnormal)' : ''}`);
        const parts: string[] = [];
        if (items.length > 0) parts.push(items.join(', '));
        if (group.comment?.trim()) parts.push(`comment: ${group.comment.trim()}`);
        return parts.length > 0 ? [bullet(`${group.groupLabel}: ${parts.join(' | ')}`)] : [];
      }),
    ],
  };
};

const serializeLabs = (data: ProgressNoteData): Section[] => {
  const results = [
    ...(data.externalLabs?.externalLabResults ?? []),
    ...(data.inHouseLabs?.inHouseLabResults ?? []),
  ].map((result) => {
    const values = result.resultValues?.length
      ? result.resultValues.join(', ')
      : ('simpleResultValue' in result && result.simpleResultValue) || 'received';
    const abnormal = result.nonNormalResultContained?.length ? ` [${result.nonNormalResultContained.join(', ')}]` : '';
    return `${result.name}: ${values}${abnormal}`;
  });

  return [
    listSection('LAB ORDERS', [data.externalLabs?.externalLabOrders, data.inHouseLabs?.inHouseLabOrders]),
    listSection('LAB RESULTS', [results]),
  ];
};

const serializeRadiology = (data: ProgressNoteData): Section =>
  listSection('RADIOLOGY', [
    data.radiology?.radiology?.map(
      (study) => `${study.name}${study.performedBy ? ` (${study.performedBy})` : ''}: ${study.result ?? 'no report'}`
    ),
    data.radiology?.pendingRadiologyOrders?.map((name) => `${name}: PENDING`),
  ]);

const serializeProcedures = (data: ProgressNoteData): Section =>
  listSection('PROCEDURES', [
    data.procedures?.procedures?.map((procedure) =>
      [
        `Procedure: ${procedure.procedureType || 'Unknown'}`,
        procedure.bodySite && `Body site: ${procedure.bodySite}${procedure.bodySide ? ` (${procedure.bodySide})` : ''}`,
        procedure.technique?.length && `Technique: ${procedure.technique.join(', ')}`,
        procedure.cptCodes?.length && `CPT: ${procedure.cptCodes.join(', ')}`,
        procedure.diagnoses?.length && `Dx: ${procedure.diagnoses.join(', ')}`,
        procedure.medicationUsed && `Medication: ${procedure.medicationUsed}`,
        procedure.suppliesUsed && `Supplies: ${procedure.suppliesUsed}`,
        procedure.procedureDetails && `Details: ${procedure.procedureDetails}`,
        procedure.complications && `Complications: ${procedure.complications}`,
        procedure.specimenSent && `Specimen sent: ${procedure.specimenSent}`,
      ]
        .filter(Boolean)
        .join(' | ')
    ),
  ]);

const serializeAssessment = (data: ProgressNoteData): Section =>
  listSection('ASSESSMENT', [
    data.assessment?.primary ? [`Primary: ${data.assessment.primary}`] : undefined,
    data.assessment?.secondary?.map((diagnosis) => `Secondary: ${diagnosis}`),
  ]);

export function progressNoteDataToText(data: ProgressNoteData): string {
  const sections: Section[] = [
    textSection('CHIEF COMPLAINT', data.chiefComplaint?.chiefComplaint),
    textSection('HPI', data.historyOfPresentIllness?.historyOfPresentIllness),
    textSection('MECHANISM OF INJURY', data.mechanismOfInjury?.mechanismOfInjury),
    listSection('ALLERGIES', [data.allergies?.allergies, data.allergies?.allergiesNotes]),
    listSection('CURRENT MEDICATIONS', [data.medications?.medications, data.medications?.medicationsNotes]),
    listSection('MEDICAL CONDITIONS', [
      data.medicalConditions?.medicalConditions,
      data.medicalConditions?.medicalConditionsNotes,
    ]),
    listSection('SURGICAL HISTORY', [
      data.surgicalHistory?.surgicalHistory,
      data.surgicalHistory?.surgicalHistoryNotes,
    ]),
    listSection('HOSPITALIZATION', [data.hospitalization?.hospitalization, data.hospitalization?.hospitalizationNotes]),
    listSection('INTAKE NOTES', [data.intakeNotes?.intakeNotes]),
    serializeVitals(data),
    serializeRos(data),
    textSection('REVIEW OF SYSTEMS NOTES', data.reviewOfSystems?.reviewOfSystems),
    serializeExam(data),
    ...serializeLabs(data),
    serializeRadiology(data),
    listSection('IN-HOUSE MEDICATIONS', [
      data.inHouseMedications?.inHouseMedications,
      data.inHouseMedications?.inHouseMedicationsNotes,
    ]),
    listSection('IMMUNIZATIONS', [data.immunizationOrders?.immunizationOrders]),
    serializeProcedures(data),
    serializeAssessment(data),
    textSection('MDM', data.medicalDecision?.medicalDecision),
    textSection('E&M CODE', data.emCode?.emCode),
    listSection('CPT CODES', [data.cptCodes?.cptCodes]),
    listSection('PRESCRIPTIONS', [data.prescriptions?.pharmacyGroups?.flatMap((group) => group.prescriptions)]),
    listSection('PATIENT INSTRUCTIONS', [data.plan?.patientInstructions]),
    textSection('DISPOSITION', data.plan?.disposition?.text),
  ];

  // ROS and Exam always render — their "0 systems documented" line is exactly what a threshold
  // prompt needs to see. Every other section is dropped when empty so the model isn't asked to
  // reason about a wall of blank headings.
  const alwaysRender = new Set(['REVIEW OF SYSTEMS', 'EXAM']);

  return sections
    .filter((section) => section.lines.length > 0 || alwaysRender.has(section.heading))
    .map((section) => `${section.heading}:\n${section.lines.join('\n')}`)
    .join('\n\n');
}
