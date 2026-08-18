// The note pane: the visit note as a clinical document, with every AI-written row marked.
//
// Sections follow the order in note-section-manifest.ts, which is Review & Sign's order, so a
// provider reading both sees the same document.
//
// A SECTION RENDERS ONLY WHEN IT HAS CONTENT, with two kinds of exception: the privacy-policy line,
// which is a static attestation rather than content, and the four free-text fields plus Vitals, which
// render while empty when the pane is editable — a section you cannot see is a section you cannot type
// into. Every rule lives in note-visibility.ts, computed once, so this file cannot disagree with it.
//
// The two attestations live ABOVE the sections, not among them.

import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import { Box, Collapse, Divider, Link, Stack, Typography } from '@mui/material';
import { DateTime } from 'luxon';
import { FC, Fragment, ReactNode, useState } from 'react';
import { HistoryOfPresentIllnessField, HistoryOfPresentIllnessFieldReadOnly } from 'src/features/visits/HpiField';
import { MechanismOfInjuryField, MechanismOfInjuryFieldReadOnly } from 'src/features/visits/MechanismOfInjuryField';
import { EMCodeField } from 'src/features/visits/shared/components/assessment-tab/EMCodeField';
import { DispositionCard } from 'src/features/visits/shared/components/DispositionCard';
import {
  DispositionSummary,
  dispositionTypeLabel,
  SubspecialtyFollowUpList,
} from 'src/features/visits/shared/components/DispositionSummary';
import { AddendumCard } from 'src/features/visits/shared/components/review-tab/AddendumCard';
import { useExcusePresignedFiles } from 'src/shared/hooks/useExcusePresignedFiles';
import { groupExamFindingsBySection } from 'utils/lib/config-helpers/exam-observations';
import { NoteTextField, PlannableVitalField } from 'utils/lib/easy-chart/actions';
import { chartKeyForNoteField, NOTE_FIELD_LABELS } from 'utils/lib/easy-chart/note-fields';
import { ADDABLE_VITAL_FIELDS, trimVitalNumber, VITAL_FIXED_UNIT, VITAL_LABEL } from 'utils/lib/easy-chart/vital-entry';
import { createMedicationString } from 'utils/lib/fhir/medication-administration';
import { formatHeightObservationValue } from 'utils/lib/helpers/vitals/vitals-height.helper';
import { celsiusToFahrenheit } from 'utils/lib/helpers/vitals/vitals-temperature.helper';
import { formatWeightKg, formatWeightLbs } from 'utils/lib/helpers/vitals/vitals-weight.helper';
import { ASQ_FIELD, ASQKeys, asqLabels, VitalFieldNames } from 'utils/lib/types/api/chart-data/chart-data.constants';
import {
  DiagnosisDTO,
  ExamObservationDTO,
  NOTE_TYPE,
  NoteDTO,
  ProcedureDTO,
  SchoolWorkNoteExcuseDocFileDTO,
  VitalsObservationDTO,
} from 'utils/lib/types/api/chart-data/chart-data.types';
import { GetChartDataResponse } from 'utils/lib/types/api/chart-data/get-chart-data.types';
import { ExtendedMedicationDataForResponse } from 'utils/lib/types/api/medication-administration.types';
import { formatDateToMDYWithTime } from 'utils/lib/utils/date';
import { buildChartSnapshot } from '../executor/chartSnapshot';
import { ProvenanceRecord, ProvenanceState } from '../provenance/provenance';
import { AiChartedItem, ItemCorrection } from './AiChartedItem';
import { InlineNoteField } from './InlineNoteField';
import { buildScreeningQuestionRows, computeSectionVisibility } from './note-visibility';
import { PROCEDURE_REVIEW_FIELDS, procedureFieldLabel } from './procedure-fields';
import { VitalAddChips, VitalDraft, VitalEntryEditor } from './VitalEntry';

export interface NotePaneProps {
  chartData: GetChartDataResponse | undefined;
  provenance: ProvenanceState;
  readOnly?: boolean;
  onSaveNoteText: (field: NoteTextField, text: string) => void | Promise<void>;
  /** Hand-editing a field clears the AI mark for the rows it owns. */
  onNoteEditStart: (field: NoteTextField) => void;
  onConfirmItem: (resourceId: string) => void;
  onDeleteItem: (field: string, resourceId: string, display: string) => void;
  /** Quick-add and inline correction of a vital, straight into the note. */
  onSaveVital?: (draft: VitalDraft) => void | Promise<void>;
  /** Promote a diagnosis to primary, demoting the current one. */
  onMakePrimary?: (diagnosis: DiagnosisDTO) => void | Promise<void>;
  /** Confirm ONE template-filled procedure field, each of which is its own assertion. */
  onConfirmProcedureField?: (resourceId: string, field: string) => void;
  /**
   * MAR orders given during THIS encounter. Not chart data: `chartData.inhouseMedications` is fetched
   * PATIENT-scoped with a `_tag`, so it is the patient's history across every visit — it showed a
   * medication from a previous encounter and omitted the one just given here. The MAR query is
   * encounter-scoped, which is what a visit note needs.
   */
  inHouseMedications?: ExtendedMedicationDataForResponse[];
  /** Administered immunizations for this encounter. Also a separate encounter-scoped query. */
  immunizations?: { id?: string; medicationName?: string; status?: string; details?: string }[];
  /**
   * Click-to-correct plumbing, per chart field. Returns the catalogue search and the replacement
   * write, or undefined for a row with nothing to search against. Kept as a callback so the note pane
   * owns no catalogue knowledge.
   */
  buildCorrection?: (field: string, item: { resourceId: string; display: string }) => ItemCorrection | undefined;
  /**
   * Lab orders placed at this encounter, in-house and send-out. Not chart data — chart data carries lab
   * RESULTS. Both sections exist and the same test legitimately appears in each: one says it was
   * ordered, the other says what came back.
   */
  labOrders?: EasyChartLabOrder[];
  /** Cancel a placed order. Absent on a signed visit. */
  onRemoveLabOrder?: (order: EasyChartLabOrder) => void;
  /** Drives the privacy-policy line's date. Absent renders the line without one. */
  appointmentStart?: string;
  /**
   * Required for the editable disposition card: it reads and writes chart data itself, and on a route
   * keyed by encounter there is no appointment store for it to resolve the id from.
   */
  encounterId?: string;
  /** The disposition card owns its own save, so the page's chart query has to be told to refresh. */
  onDispositionSaved?: () => void;
  /**
   * The reused note fields own their own debounced saves, so the page has to be told when one lands —
   * both to refresh its chart query and to drop the AI mark from a field the provider just rewrote.
   */
  onNoteFieldSaved?: () => void;
  /** All three ids the addendum card's note list needs. */
  addendumResources?: { encounterId?: string; appointmentId?: string; patientId?: string };
}

/** A lab order as the note shows it. Flattened from the two order-list DTOs, which differ in shape. */
export interface EasyChartLabOrder {
  serviceRequestId: string;
  kind: 'in-house' | 'external';
  testName: string;
  labName?: string;
  status?: string;
}

/** An empty section still says something: it says a provider looked and there was nothing. */
const EmptyValue: FC<{ text?: string }> = ({ text }) => (
  <Typography variant="body2" color="text.disabled">
    {text ?? '—'}
  </Typography>
);

const Section: FC<{ label: string; children: ReactNode }> = ({ label, children }) => (
  <Stack spacing={0.5}>
    <Typography variant="subtitle2" color="primary.dark">
      {label}
    </Typography>
    {children}
  </Stack>
);

/**
 * A section whose content is long enough to bury what follows it. Collapsed by default with the count in
 * the label, so the heading still states that the content EXISTS — a hidden section and a collapsed one
 * say very different things to a provider skimming for what they have not done yet.
 */
const CollapsibleSection: FC<{ label: string; children: ReactNode }> = ({ label, children }) => {
  const [open, setOpen] = useState(false);
  return (
    <Stack spacing={0.5}>
      <Stack
        direction="row"
        spacing={0.5}
        alignItems="center"
        onClick={() => setOpen((previous) => !previous)}
        sx={{ cursor: 'pointer', width: 'fit-content' }}
      >
        <Typography variant="subtitle2" color="primary.dark">
          {label}
        </Typography>
        {open ? (
          <ExpandLessIcon fontSize="small" color="primary" />
        ) : (
          <ExpandMoreIcon fontSize="small" color="primary" />
        )}
      </Stack>
      <Collapse in={open}>
        <Stack spacing={0.5}>{children}</Stack>
      </Collapse>
    </Stack>
  );
};

/**
 * Generated school / work excuses, as download links.
 *
 * Presigning is asynchronous, so the file NAMES render immediately and the links attach when the URLs
 * resolve — a section that stays blank until a second round trip reads as "no excuse was written".
 */
const SchoolWorkExcuseSection: FC<{ excuses: SchoolWorkNoteExcuseDocFileDTO[] }> = ({ excuses }) => {
  const presigned = useExcusePresignedFiles(excuses);
  const items: (SchoolWorkNoteExcuseDocFileDTO & { presignedUrl?: string })[] =
    presigned.length > 0 ? presigned : excuses;
  return (
    <Section label="School / Work Excuse">
      {items.map((excuse) => (
        <Typography key={excuse.id} variant="body2">
          {excuse.presignedUrl ? (
            <Link href={excuse.presignedUrl} target="_blank" rel="noopener noreferrer">
              {excuse.name}
            </Link>
          ) : (
            excuse.name
          )}
        </Typography>
      ))}
    </Section>
  );
};

/**
 * The one unconditional section: a static attestation rather than content, at the very bottom.
 *
 * The date is the APPOINTMENT START, in the browser's zone, matching Review & Sign's wording exactly —
 * two surfaces stating the same acknowledgement differently invites the question of which is right.
 */
const PrivacyPolicyLine: FC<{ appointmentStart?: string }> = ({ appointmentStart }) => {
  const start = formatDateToMDYWithTime(appointmentStart, DateTime.local().zoneName);
  return (
    <Typography variant="caption" color="text.secondary">
      {start
        ? `Privacy Policy and Terms and Conditions of Service were reviewed and accepted on ${start.date} at ${start.time}.`
        : 'Privacy Policy and Terms and Conditions of Service were reviewed and accepted.'}
    </Typography>
  );
};

/**
 * Per-section provider notes. The chart keeps free-text notes per section (allergy, medication,
 * hospitalization, vitals…); a note filed away from the thing it annotates is a note nobody reads.
 */
const SectionNotes: FC<{ notes: NoteDTO[] }> = ({ notes }) => {
  if (notes.length === 0) return null;
  return (
    <Stack spacing={0.25} sx={{ mt: 0.5 }}>
      {notes.map((note, index) => (
        <Typography key={note.resourceId ?? index} variant="caption" color="text.secondary">
          Note: {note.text}
        </Typography>
      ))}
    </Stack>
  );
};

export const NotePane: FC<NotePaneProps> = ({
  chartData,
  provenance,
  readOnly,
  onSaveNoteText,
  onNoteEditStart,
  onConfirmItem,
  onDeleteItem,
  onSaveVital,
  onMakePrimary,
  onConfirmProcedureField,
  inHouseMedications = [],
  immunizations = [],
  buildCorrection,
  labOrders = [],
  onRemoveLabOrder,
  appointmentStart,
  encounterId,
  onDispositionSaved,
  onNoteFieldSaved,
  addendumResources,
}) => {
  const correctionFor =
    (field: string) =>
    (item: { resourceId: string; display: string }): ItemCorrection | undefined =>
      buildCorrection?.(field, item);
  const snapshot = buildChartSnapshot(chartData);
  const record = (resourceId: string | undefined): ProvenanceRecord | undefined =>
    resourceId ? provenance.byResourceId.get(resourceId) : undefined;

  // The ENUM, not a string literal. Hand-written strings silently mismatched five of these — the notes
  // were fetched and then filtered out by a typo, which looks exactly like a patient with no notes.
  const notesOfType = (type: NOTE_TYPE): NoteDTO[] => (chartData?.notes ?? []).filter((note) => note.type === type);

  /** A code-first line: the code in bold, then what it means. How a coder reads the note. */
  const coded = (code: string | undefined, display: string): ReactNode => (
    <>
      {code ? <strong>{code}</strong> : null}
      {code ? ' — ' : ''}
      {display}
    </>
  );

  const listSection = (
    label: string,
    items: { resourceId: string; display: string }[],
    field: string,
    options: {
      describe?: (item: { resourceId: string; display: string }) => ReactNode;
      notes?: NoteDTO[];
      extra?: (item: { resourceId: string; display: string }) => ReactNode;
      emptyText?: string;
      /** Click-to-correct: search the catalogue and swap this row for what the provider picks. */
      correction?: (item: { resourceId: string; display: string }) => ItemCorrection | undefined;
    } = {}
  ): ReactNode => (
    <Section label={label}>
      {items.length === 0 ? (
        <EmptyValue text={options.emptyText} />
      ) : (
        items.map((item) => (
          <AiChartedItem
            key={item.resourceId}
            provenance={record(item.resourceId)}
            correction={readOnly ? undefined : options.correction?.(item)}
            onConfirm={() => onConfirmItem(item.resourceId)}
            onDelete={readOnly ? undefined : () => onDeleteItem(field, item.resourceId, item.display)}
            dataTestId={`easy-chart-${field}-${item.resourceId}`}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Typography variant="body2">{options.describe ? options.describe(item) : item.display}</Typography>
              {options.extra?.(item)}
            </Box>
          </AiChartedItem>
        ))
      )}
      <SectionNotes notes={options.notes ?? []} />
    </Section>
  );

  const freeText = (field: NoteTextField): ReactNode => (
    <InlineNoteField
      key={field}
      label={NOTE_FIELD_LABELS[field]}
      value={chartData?.[chartKeyForNoteField(field)]?.text}
      disabled={readOnly}
      onSave={(text) => onSaveNoteText(field, text)}
      onEditStart={() => onNoteEditStart(field)}
      dataTestId={`easy-chart-note-${field}`}
    />
  );

  const vitals = (chartData?.vitalsObservations ?? []) as VitalsObservationDTO[];
  const instructions = chartData?.instructions ?? [];
  const prescriptions = chartData?.prescribedMedications ?? [];
  const radiologyOrders = chartData?.radiologyOrders ?? [];
  const procedures = chartData?.procedures ?? [];
  const vitalsEditable = Boolean(onSaveVital) && !readOnly;

  // ROS states only what the patient REPORTED. A recorded "denies" is a negative the section does not
  // assert, and listing it reads as a positive finding to anyone skimming.
  const positiveRos = snapshot.rosFindings.filter((finding) =>
    (chartData?.rosObservations ?? []).some(
      (observation) => observation.resourceId === finding.resourceId && observation.value === true
    )
  );
  const examObservations = chartData?.examObservations ?? [];
  const tickedExam = examObservations.filter((finding) => finding.value === true);
  // Unticked but annotated: the note is the provider's own words and must not vanish with the checkbox.
  const notedExam = examObservations.filter(
    (finding) => finding.note?.trim() && !tickedExam.some((ticked) => ticked.field === finding.field)
  );
  const screeningRows = buildScreeningQuestionRows(chartData?.observations);
  const asq = (chartData?.observations ?? []).find((observation) => observation.field === ASQ_FIELD);

  // ONE source for every rule. Inlining a condition at a call site is how a section with a note and no
  // items disappears, taking the note with it.
  const visible = computeSectionVisibility({
    chartData,
    editable: !readOnly,
    canSaveVital: Boolean(onSaveVital),
    inHouseMedications,
    immunizations,
    labOrders,
  });

  const sections: { id: string; node: ReactNode }[] = [
    {
      id: 'allergies',
      node: listSection('Allergies', snapshot.allergies, 'allergies', {
        correction: correctionFor('allergies'),
        notes: notesOfType(NOTE_TYPE.ALLERGY),
        emptyText: 'None recorded',
      }),
    },

    {
      id: 'intake-medications',
      node: listSection('Medications', snapshot.medications, 'medications', {
        correction: correctionFor('medications'),
        notes: notesOfType(NOTE_TYPE.INTAKE_MEDICATION),
        describe: (item) => {
          const medication = chartData?.medications?.find((m) => m.resourceId === item.resourceId);
          return (
            <>
              {item.display}
              {medication?.intakeInfo?.dose ? ` — ${medication.intakeInfo.dose}` : ''}
              {medication?.intakeInfo?.patientCouldNotConfirmDosage && (
                // A dose the patient could not confirm is not a recorded dose, and the note must not
                // read as if it were.
                <Typography component="span" variant="caption" color="text.secondary">
                  {' '}
                  (dosage unconfirmed)
                </Typography>
              )}
            </>
          );
        },
      }),
    },

    {
      id: 'medical-history',
      node: listSection('Medical History', snapshot.conditions, 'conditions', {
        correction: correctionFor('conditions'),
        notes: notesOfType(NOTE_TYPE.MEDICAL_CONDITION),
        describe: (item) =>
          coded(chartData?.conditions?.find((c) => c.resourceId === item.resourceId)?.code, item.display),
      }),
    },

    {
      id: 'surgical-history',
      node: listSection('Surgical History', snapshot.surgicalHistory, 'surgicalHistory', {
        correction: correctionFor('surgicalHistory'),
        // Two different things, both belong here: the per-section NOTES, and the single free-text
        // surgicalHistoryNote the chart keeps separately.
        notes: [
          ...notesOfType(NOTE_TYPE.SURGICAL_HISTORY),
          ...(chartData?.surgicalHistoryNote?.text
            ? [{ text: chartData.surgicalHistoryNote.text, type: NOTE_TYPE.SURGICAL_HISTORY } as NoteDTO]
            : []),
        ],
        describe: (item) =>
          coded(chartData?.surgicalHistory?.find((s) => s.resourceId === item.resourceId)?.code, item.display),
      }),
    },

    {
      id: 'hospitalizations',
      node: listSection('Hospitalizations', snapshot.hospitalizations, 'episodeOfCare', {
        correction: correctionFor('episodeOfCare'),
        notes: notesOfType(NOTE_TYPE.HOSPITALIZATION),
        describe: (item) =>
          coded(chartData?.episodeOfCare?.find((h) => h.resourceId === item.resourceId)?.code, item.display),
      }),
    },

    {
      id: 'in-house-medications',
      node: (
        <Section key="in-house-medications" label="In-House Medications">
          {inHouseMedications.length === 0 ? (
            <EmptyValue />
          ) : (
            inHouseMedications.map((medication, index) => (
              <Typography key={medication.id ?? index} variant="body2">
                {createMedicationString(medication)}
              </Typography>
            ))
          )}
          <SectionNotes notes={notesOfType(NOTE_TYPE.MEDICATION)} />
        </Section>
      ),
    },

    {
      id: 'immunization',
      node: (
        <Section key="immunization" label="Immunization">
          {immunizations.length === 0 ? (
            <EmptyValue />
          ) : (
            immunizations.map((order, index) => (
              <Typography key={order.id ?? index} variant="body2">
                {order.medicationName}
                {order.details ? ` — ${order.details}` : ''}
              </Typography>
            ))
          )}
        </Section>
      ),
    },

    // Always shown: the free-text fields are how a provider writes the note by hand, and a section you
    // cannot see is a section you cannot type into.
    { id: 'chief-complaint', node: freeText('chiefComplaint') },
    // THE IN-PERSON CHART'S OWN FIELDS, not a second implementation. Each owns its debounced save, its
    // saving indicator, and — for the MOI — the "what to include" guidance a provider expects to find
    // there. They also encode the CC↔HPI storage swap (this field writes the `chiefComplaint` key), which
    // is exactly the kind of wart a reimplementation gets wrong.
    {
      id: 'hpi',
      node: (
        <Section key="hpi" label={NOTE_FIELD_LABELS.historyOfPresentIllness}>
          {readOnly || !encounterId ? (
            <HistoryOfPresentIllnessFieldReadOnly label="" encounterId={encounterId} />
          ) : (
            <HistoryOfPresentIllnessField label="" encounterId={encounterId} onSaved={onNoteFieldSaved} />
          )}
        </Section>
      ),
    },
    {
      id: 'mechanism-of-injury',
      node: (
        <Section key="mechanism-of-injury" label={NOTE_FIELD_LABELS.mechanismOfInjury}>
          {readOnly || !encounterId ? (
            <MechanismOfInjuryFieldReadOnly encounterId={encounterId} />
          ) : (
            <MechanismOfInjuryField encounterId={encounterId} onSaved={onNoteFieldSaved} />
          )}
        </Section>
      ),
    },

    {
      id: 'ros',
      node: (
        <Section key="ros" label="Review of Systems">
          {positiveRos.map((item) => (
            <AiChartedItem
              key={item.resourceId}
              provenance={record(item.resourceId)}
              correction={readOnly ? undefined : correctionFor('rosObservations')(item)}
              onConfirm={() => onConfirmItem(item.resourceId)}
              onDelete={readOnly ? undefined : () => onDeleteItem('rosObservations', item.resourceId, item.display)}
              dataTestId={`easy-chart-rosObservations-${item.resourceId}`}
            >
              <Typography variant="body2">{describeRosFinding(chartData, item)}</Typography>
            </AiChartedItem>
          ))}
          {/* The legacy single free-text ROS field. READ-ONLY: it predates the structured findings and
              nothing should write to it, but a chart that has one must still show it. */}
          {visible['ros-legacy'] && (
            <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap', mt: positiveRos.length ? 1 : 0 }}>
              {chartData?.ros?.text}
            </Typography>
          )}
        </Section>
      ),
    },

    {
      id: 'additional-questions',
      node: (
        <Section key="additional-questions" label="Additional questions">
          {/* Question label + formatted answer, in config order — the same selection and formatting
              rules Review & Sign applies, so the two surfaces read identically. Printing the raw field
              name and value showed "tobacco-user: true" where the note should read a question. */}
          {screeningRows.map((row) => (
            <Typography key={row.id} variant="body2">
              {row.text}
            </Typography>
          ))}
          {asq && (
            <Typography variant="body2">
              ASQ:{' '}
              {asqLabels[(asq as { value?: ASQKeys }).value as ASQKeys] ??
                String((asq as { value?: unknown }).value ?? '—')}
            </Typography>
          )}
          <SectionNotes notes={notesOfType(NOTE_TYPE.SCREENING)} />
        </Section>
      ),
    },

    {
      id: 'vitals',
      node: (
        <Section key="vitals" label="Vitals">
          {vitals.length === 0 && !vitalsEditable && <EmptyValue />}
          {vitals.map((vital, index) => (
            <VitalRow
              key={vital.resourceId ?? index}
              vital={vital}
              provenance={record(vital.resourceId)}
              editable={vitalsEditable}
              onConfirm={vital.resourceId ? () => onConfirmItem(vital.resourceId!) : undefined}
              onDelete={
                readOnly || !vital.resourceId
                  ? undefined
                  : () => onDeleteItem('vitalsObservations', vital.resourceId!, describeVital(vital))
              }
              onSave={onSaveVital}
            />
          ))}
          {/* Ghost "+ Temp" chips: a simple numeric should not have to be routed through the assistant. */}
          {vitalsEditable && onSaveVital && <VitalAddChips charted={vitals} onSave={onSaveVital} />}
          <SectionNotes notes={notesOfType(NOTE_TYPE.VITALS)} />
        </Section>
      ),
    },

    // Grouped by body-system card, the way the exam is organised. A flat list loses which system each
    // finding belongs to, which is the thing the exam is filed by.
    {
      id: 'examination',
      node: (
        <Section key="examination" label="Examination">
          {groupExamFindingsBySection(tickedExam.map((finding) => ({ ...finding, fieldName: finding.field }))).map(
            (group) => (
              <Box key={group.sectionKey} sx={{ mb: 0.5 }}>
                <Typography variant="body2" fontWeight={600}>
                  {group.sectionLabel}
                </Typography>
                {group.findings.map((finding) => (
                  <AiChartedItem
                    key={finding.field}
                    provenance={record(finding.resourceId)}
                    // A wrong exam finding is corrected the same way every other row is: click it, search
                    // the exam config, pick the right leaf. The plumbing already existed and only this
                    // section was not passing it, so clicking a finding did nothing.
                    correction={
                      readOnly || !finding.resourceId
                        ? undefined
                        : correctionFor('examObservations')({
                            resourceId: finding.resourceId,
                            display: finding.label ?? finding.field,
                          })
                    }
                    onConfirm={finding.resourceId ? () => onConfirmItem(finding.resourceId!) : undefined}
                    onDelete={
                      readOnly || !finding.resourceId
                        ? undefined
                        : () => onDeleteItem('examObservations', finding.resourceId!, finding.label ?? finding.field)
                    }
                  >
                    <Typography variant="body2">{describeExamFinding(finding)}</Typography>
                  </AiChartedItem>
                ))}
              </Box>
            )
          )}
          {/* Findings whose checkbox is not ticked but which carry a note. The note is the provider's
              own words about the exam and must not disappear with the checkbox. */}
          {notedExam.map((finding) => (
            <Typography key={finding.field} variant="caption" color="text.secondary">
              {finding.label ?? finding.field}: {finding.note}
            </Typography>
          ))}
        </Section>
      ),
    },

    {
      id: 'procedures',
      node: (
        <Section key="procedures" label="Procedures">
          {procedures.length === 0 ? (
            <EmptyValue />
          ) : (
            procedures.map((procedure, index) => (
              <ProcedureBlock
                key={procedure.resourceId ?? index}
                procedure={procedure}
                provenance={record(procedure.resourceId)}
                onConfirm={procedure.resourceId ? () => onConfirmItem(procedure.resourceId!) : undefined}
                onConfirmField={
                  procedure.resourceId && onConfirmProcedureField
                    ? (field) => onConfirmProcedureField(procedure.resourceId!, field)
                    : undefined
                }
                onDelete={
                  readOnly || !procedure.resourceId
                    ? undefined
                    : () => onDeleteItem('procedures', procedure.resourceId!, procedure.procedureType ?? 'procedure')
                }
              />
            ))
          )}
        </Section>
      ),
    },

    {
      id: 'assessment',
      node: listSection('Assessment / Diagnoses', snapshot.diagnoses, 'diagnosis', {
        correction: correctionFor('diagnosis'),
        describe: (item) => {
          const diagnosis = snapshot.diagnoses.find((dx) => dx.resourceId === item.resourceId);
          return (
            <>
              {coded(diagnosis?.code, item.display)}
              {diagnosis?.isPrimary ? ' (primary)' : ''}
            </>
          );
        },
        extra: (item) => {
          const diagnosis = chartData?.diagnosis?.find((dx) => dx.resourceId === item.resourceId);
          if (readOnly || !onMakePrimary || !diagnosis || diagnosis.isPrimary) return null;
          return (
            <Typography
              component="button"
              variant="caption"
              onClick={(event) => {
                event.stopPropagation();
                void onMakePrimary(diagnosis);
              }}
              sx={{
                border: 0,
                background: 'none',
                p: 0,
                cursor: 'pointer',
                color: 'primary.main',
                textDecoration: 'underline',
              }}
            >
              Make primary
            </Typography>
          );
        },
      }),
    },

    { id: 'mdm', node: freeText('medicalDecision') },

    {
      id: 'em-code',
      node: (
        <Section key="em-code" label="E&M Code">
          {/* The Assessment card's own dropdown, WRAPPED in the provenance row rather than placed beside
              it: the level is a billing decision the provider owns, and the row is what says the AI chose
              it and offers the confirm. Delete-only — which is what carrying the previous branch's
              read-only row left this as — gave a provider no way to change a level they disagreed with. */}
          {readOnly || !encounterId ? (
            chartData?.emCode?.code ? (
              <AiChartedItem
                provenance={record(chartData.emCode.resourceId)}
                onConfirm={chartData.emCode.resourceId ? () => onConfirmItem(chartData.emCode!.resourceId!) : undefined}
              >
                <Typography variant="body2">{coded(chartData.emCode.code, chartData.emCode.display ?? '')}</Typography>
              </AiChartedItem>
            ) : (
              <EmptyValue />
            )
          ) : (
            <AiChartedItem
              provenance={record(chartData?.emCode?.resourceId)}
              onConfirm={chartData?.emCode?.resourceId ? () => onConfirmItem(chartData.emCode!.resourceId!) : undefined}
              onDelete={
                chartData?.emCode?.resourceId
                  ? () => onDeleteItem('emCode', chartData.emCode!.resourceId!, chartData.emCode!.code)
                  : undefined
              }
            >
              <EMCodeField encounterId={encounterId} emCode={chartData?.emCode} onSaved={onNoteFieldSaved} />
            </AiChartedItem>
          )}
        </Section>
      ),
    },

    {
      id: 'cpt-codes',
      node: listSection('CPT Codes', snapshot.cptCodes, 'cptCodes', {
        correction: correctionFor('cptCodes'),
        describe: (item) => coded(snapshot.cptCodes.find((c) => c.resourceId === item.resourceId)?.code, item.display),
      }),
    },

    // Two sections, in this order. The same test legitimately appears in both: this one says it was
    // ordered, the next says what came back.
    {
      id: 'labs-ordered',
      node: (
        <Section key="labs-ordered" label="Labs ordered">
          {labOrders.map((order) => (
            <AiChartedItem
              key={order.serviceRequestId}
              onDelete={readOnly || !onRemoveLabOrder ? undefined : () => onRemoveLabOrder(order)}
            >
              <Typography variant="body2">
                {order.testName}
                <Typography component="span" variant="caption" color="text.secondary">
                  {' '}
                  — {order.kind === 'in-house' ? 'in-house' : order.labName ?? 'send-out'}
                  {order.status ? ` · ${order.status}` : ''}
                </Typography>
              </Typography>
            </AiChartedItem>
          ))}
        </Section>
      ),
    },

    { id: 'lab-results', node: <LabResultsSection key="lab-results" chartData={chartData} /> },

    {
      id: 'radiology',
      node: (
        <Section key="radiology" label="Radiology">
          {radiologyOrders.length === 0 ? (
            <EmptyValue />
          ) : (
            radiologyOrders.map((order, index) => (
              <Typography key={order.serviceRequestId ?? index} variant="body2">
                {order.studyName ?? order.studyType} — {order.cptCodeDisplay}
                {order.diagnosis ? ` · ${order.diagnosis}` : ''}
              </Typography>
            ))
          )}
        </Section>
      ),
    },

    {
      id: 'prescriptions',
      node: (
        <Section key="prescriptions" label="Prescriptions">
          {prescriptions.length === 0 ? (
            <EmptyValue />
          ) : (
            prescriptions.map((prescription, index) => (
              <Typography key={prescription.resourceId ?? index} variant="body2">
                {prescription.name}
                {prescription.instructions ? ` — ${prescription.instructions}` : ''}
                {prescription.status ? (
                  <Typography component="span" variant="caption" color="text.secondary">
                    {' '}
                    ({prescription.status})
                  </Typography>
                ) : null}
              </Typography>
            ))
          )}
        </Section>
      ),
    },

    {
      id: 'patient-instructions',
      node: (
        // Collapsible with the count in the title: a full discharge plan is four or five paragraphs, and
        // left expanded it buries the disposition and the addendum below it.
        <CollapsibleSection key="instructions" label={`Patient Instructions (${instructions.length})`}>
          {instructions.map((instruction, index) => (
            <AiChartedItem
              key={instruction.resourceId ?? index}
              provenance={record(instruction.resourceId)}
              onConfirm={instruction.resourceId ? () => onConfirmItem(instruction.resourceId!) : undefined}
              onDelete={
                readOnly || !instruction.resourceId
                  ? undefined
                  : () => onDeleteItem('instructions', instruction.resourceId!, instruction.text ?? '')
              }
            >
              <Typography variant="body2">{instruction.text}</Typography>
            </AiChartedItem>
          ))}
        </CollapsibleSection>
      ),
    },

    {
      id: 'school-work-excuse',
      node: <SchoolWorkExcuseSection key="school-work-excuse" excuses={chartData?.schoolWorkNotes ?? []} />,
    },

    // THE PLAN TAB'S OWN CARD, not a second implementation of it. A disposition is a form, not a value:
    // the type is a toggle group, and which further fields exist at all depends on which type is
    // selected — lab services and virus tests for an in-house lab, specialty and reason for a transfer,
    // nothing-to-eat-or-drink and the refusal-of-EMS attestation for an ED transfer. Re-deriving that in
    // the note pane is how it ended up read-only, showing the stored code as its heading and dropping
    // six of the fields.
    //
    // On a SIGNED visit the summary reads better than a form full of disabled inputs, and matches what
    // Review & Sign shows — so the card is for charting and the summary is for reading.
    {
      id: 'disposition',
      node: (
        <Section
          key="disposition"
          label={`Disposition${
            dispositionTypeLabel(chartData?.disposition?.type)
              ? ` — ${dispositionTypeLabel(chartData?.disposition?.type)}`
              : ''
          }`}
        >
          {readOnly || !encounterId ? (
            <>
              <DispositionSummary disposition={chartData?.disposition} />
              {(chartData?.disposition?.followUp?.length ?? 0) > 0 && (
                <>
                  <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5 }}>
                    Subspecialty follow-up
                  </Typography>
                  <SubspecialtyFollowUpList disposition={chartData?.disposition} />
                </>
              )}
            </>
          ) : (
            <DispositionCard
              // Both are required on this route: the appointment store is empty here, so the card's own
              // encounter id would be undefined and its lock state would read as UNLOCKED — a signed
              // visit would render editable.
              encounterId={encounterId}
              isReadOnly={readOnly}
              variant="plain"
              onSaved={onDispositionSaved}
            />
          )}
        </Section>
      ),
    },

    {
      id: 'privacy-policy',
      node: <PrivacyPolicyLine key="privacy" appointmentStart={appointmentStart} />,
    },

    {
      id: 'addendum',
      node: (
        // Review & Sign's own card, after the privacy line as it is there. An addendum is the one thing a
        // provider may append to a SIGNED visit, so it stays editable when the rest of the note is not —
        // and getting that right means per-author notes, soft-delete tombstones, an edited marker and the
        // legacy single-string addendum, all of which this card already does.
        <Section key="addendum" label="Addendum">
          <AddendumCard variant="plain" resources={addendumResources} />
        </Section>
      ),
    },
  ];

  // FILTERED, not conditionally rendered in place. A `null`-returning child still counts as a child to
  // the Stack's divider, which is how the note ended up with rows of empty ruled gaps.
  const shown = sections.filter((section) => visible[section.id]);

  return (
    <Stack spacing={2} divider={<Divider flexItem />} sx={{ pb: 4 }}>
      {shown.map((section) => (
        <Fragment key={section.id}>{section.node}</Fragment>
      ))}
    </Stack>
  );
};

/**
 * One charted vital. A vital is numeric, so its correction is an inline editor rather than a catalogue
 * picker — but it carries the same provenance treatment as every other AI-written row.
 */
const VitalRow: FC<{
  vital: VitalsObservationDTO;
  provenance?: ProvenanceRecord;
  editable?: boolean;
  onConfirm?: () => void;
  onDelete?: () => void;
  onSave?: (draft: VitalDraft) => void | Promise<void>;
}> = ({ vital, provenance, editable, onConfirm, onDelete, onSave }) => {
  const [editing, setEditing] = useState(false);
  const addable = (ADDABLE_VITAL_FIELDS as readonly string[]).includes(vital.field);

  if (editing && onSave) {
    return (
      <VitalEntryEditor
        field={vital.field as PlannableVitalField}
        initialCanonical={'value' in vital && typeof vital.value === 'number' ? vital.value : undefined}
        initialSystolic={'systolicPressure' in vital ? vital.systolicPressure : undefined}
        initialDiastolic={'diastolicPressure' in vital ? vital.diastolicPressure : undefined}
        onCommit={(draft) => {
          setEditing(false);
          if (draft) void onSave(draft);
        }}
        onCancel={() => setEditing(false)}
      />
    );
  }

  return (
    <AiChartedItem
      provenance={provenance}
      onConfirm={onConfirm}
      onDelete={onDelete}
      onCorrect={editable && onSave && addable ? () => setEditing(true) : undefined}
    >
      <Typography variant="body2">{describeVital(vital)}</Typography>
    </AiChartedItem>
  );
};

/**
 * A procedure, with a "default, verify" marker on every field a template filled.
 *
 * Per-ITEM provenance is not enough here: a quick-pick pre-fills complications, patientResponse and
 * timeSpent among others — legal and billing claims the provider never said — so one confirm click
 * would accept ten unspoken assertions. Each field carries its own marker and its own confirm.
 */
const ProcedureBlock: FC<{
  procedure: ProcedureDTO;
  provenance?: ProvenanceRecord;
  onConfirm?: () => void;
  onConfirmField?: (field: string) => void;
  onDelete?: () => void;
}> = ({ procedure, provenance, onConfirm, onConfirmField, onDelete }) => {
  const perField = provenance?.fields ?? {};

  return (
    <Box>
      <AiChartedItem provenance={provenance} onConfirm={onConfirm} onDelete={onDelete}>
        <Typography variant="body2" fontWeight={600}>
          {procedure.procedureType ?? 'Procedure'}
        </Typography>
      </AiChartedItem>

      <Stack spacing={0.25} sx={{ pl: 2, mt: 0.25 }}>
        {PROCEDURE_REVIEW_FIELDS.map((field) => {
          const value = (procedure as unknown as Record<string, unknown>)[field];
          if (value == null || value === '' || (Array.isArray(value) && value.length === 0)) return null;
          const text = Array.isArray(value) ? value.join(', ') : String(value);
          const needsVerify = Boolean(perField[field]) && !perField[field]?.reviewed;
          return (
            <Stack key={field} direction="row" spacing={1} alignItems="center">
              <Typography variant="caption" color="text.secondary" sx={{ minWidth: 130 }}>
                {procedureFieldLabel(field)}
              </Typography>
              <Typography variant="body2">{text}</Typography>
              {needsVerify && (
                <Typography
                  component="button"
                  variant="caption"
                  onClick={() => onConfirmField?.(field)}
                  sx={{
                    border: 0,
                    background: 'rgba(237,108,2,0.14)',
                    borderRadius: 1,
                    px: 0.75,
                    cursor: onConfirmField ? 'pointer' : 'default',
                    color: 'warning.dark',
                    fontWeight: 600,
                  }}
                >
                  default, verify
                </Typography>
              )}
            </Stack>
          );
        })}
      </Stack>
    </Box>
  );
};

/** A ROS finding with its note, if the provider wrote one against that system. */
function describeRosFinding(
  chartData: GetChartDataResponse | undefined,
  item: { resourceId: string; display: string }
): string {
  const finding = chartData?.rosObservations?.find((observation) => observation.resourceId === item.resourceId);
  return `${item.display}${finding?.note ? ` — ${finding.note}` : ''}`;
}

/** In-house and send-out results, including the ones still pending — a pending result blocks signing. */
const LabResultsSection: FC<{ chartData: GetChartDataResponse | undefined }> = ({ chartData }) => {
  const inHouse = chartData?.inHouseLabResults;
  const external = chartData?.externalLabResults;
  const pending = [...(inHouse?.resultsPending ?? []), ...(external?.resultsPending ?? [])];
  const results = [...(inHouse?.labOrderResults ?? []), ...(external?.labOrderResults ?? [])];

  return (
    <Section label="Lab Results">
      {pending.length === 0 && results.length === 0 && <EmptyValue />}
      {results.map((result, index) => (
        <Typography key={index} variant="body2">
          {result.name}
        </Typography>
      ))}
      {pending.length > 0 && (
        // Stated, not omitted: a note silent about a pending result reads as complete when it is not.
        <Typography variant="body2" color="warning.dark">
          Pending: {pending.join(', ')}
        </Typography>
      )}
    </Section>
  );
};

/**
 * Vitals are STORED CANONICAL — °C, kg, cm. Printing the raw number would show "38" for a fever and
 * "173" for a height in units the provider is not expecting, so each renders through the same helpers
 * the regular vitals cards use, showing both systems where the chart offers both.
 */
function describeVital(vital: VitalsObservationDTO): string {
  const label = VITAL_LABEL[vital.field] ?? vital.field;

  if (vital.field === VitalFieldNames.VitalBloodPressure) {
    return `${label}: ${vital.systolicPressure}/${vital.diastolicPressure} mmHg`;
  }
  if (
    vital.field === VitalFieldNames.VitalWeight &&
    'extraWeightOptions' in vital &&
    vital.extraWeightOptions?.includes('patient_refused')
  ) {
    return `${label}: patient refused`;
  }
  // The union includes vision and LMP, whose `value` is not numeric; those render by label only.
  if (!('value' in vital) || typeof vital.value !== 'number') return label;

  if (vital.field === VitalFieldNames.VitalTemperature) {
    return `${label}: ${trimVitalNumber(vital.value)} °C ≈ ${trimVitalNumber(celsiusToFahrenheit(vital.value))} °F`;
  }
  if (vital.field === VitalFieldNames.VitalWeight) {
    return `${label}: ${formatWeightKg(vital.value)} kg ≈ ${formatWeightLbs(vital.value)} lbs`;
  }
  if (vital.field === VitalFieldNames.VitalHeight) {
    return `${label}: ${formatHeightObservationValue(vital.value)}`;
  }
  const unit = VITAL_FIXED_UNIT[vital.field];
  return `${label}: ${trimVitalNumber(vital.value)}${unit ? ` ${unit}` : ''}`;
}

/**
 * An exam finding plus its checked sub-options, grouped the way the regular exam card summarises them
 * ("Frontal: Left, Right") — the components are the finding's detail, and dropping them loses which
 * side or structure was involved.
 */
function describeExamFinding(finding: ExamObservationDTO): string {
  const checked = (finding.components ?? []).filter((component) => component.value);
  const byGroup = new Map<string, string[]>();
  for (const component of checked) {
    const key = component.groupLabel ?? '';
    byGroup.set(key, [...(byGroup.get(key) ?? []), component.label]);
  }
  const summary = [...byGroup.entries()]
    .map(([group, labels]) => (group ? `${group}: ${labels.join(', ')}` : labels.join(', ')))
    .join('; ');

  return [finding.label ?? finding.field, summary, finding.note].filter(Boolean).join(' — ');
}
