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

import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import { Box, Collapse, Divider, IconButton, Link, Stack, Typography } from '@mui/material';
import { DateTime } from 'luxon';
import { FC, Fragment, ReactNode, useState } from 'react';
import { ChiefComplaintField, ChiefComplaintFieldReadOnly } from 'src/features/visits/ChiefComplaintField';
import { HistoryOfPresentIllnessField, HistoryOfPresentIllnessFieldReadOnly } from 'src/features/visits/HpiField';
import { HospitalizationField } from 'src/features/visits/in-person/components/hospitalization/HospitalizationField';
import { MechanismOfInjuryField, MechanismOfInjuryFieldReadOnly } from 'src/features/visits/MechanismOfInjuryField';
import { CptCodeField } from 'src/features/visits/shared/components/assessment-tab/CptCodeField';
import { DiagnosesField } from 'src/features/visits/shared/components/assessment-tab/DiagnosesField';
import { EMCodeField } from 'src/features/visits/shared/components/assessment-tab/EMCodeField';
import {
  MedicalDecisionField,
  MedicalDecisionFieldReadOnly,
} from 'src/features/visits/shared/components/assessment-tab/MedicalDecisionField';
import { DispositionCard } from 'src/features/visits/shared/components/DispositionCard';
import {
  DispositionSummary,
  dispositionTypeLabel,
  SubspecialtyFollowUpList,
} from 'src/features/visits/shared/components/DispositionSummary';
import { AllergenOption, AllergyField } from 'src/features/visits/shared/components/known-allergies/AllergyField';
import {
  MedicationField,
  MedicationOption,
} from 'src/features/visits/shared/components/medical-history-tab/CurrentMedications/MedicationField';
import { SurgicalHistoryField } from 'src/features/visits/shared/components/medical-history-tab/SurgicalHistory/SurgicalHistoryField';
import { AddendumCard } from 'src/features/visits/shared/components/review-tab/AddendumCard';
import VitalHistoryElement from 'src/features/visits/shared/components/vitals/components/VitalsHistoryEntry';
import { groupVitalsBySection } from 'src/features/visits/shared/components/vitals/groupVitalsBySection';
import { AppointmentAccessibilityOverrideProvider } from 'src/features/visits/shared/hooks/appointment-accessibility-override';
import { useExcusePresignedFiles } from 'src/shared/hooks/useExcusePresignedFiles';
import { groupExamFindingsBySection } from 'utils/lib/config-helpers/exam-observations';
import { NOTE_FIELD_LABELS } from 'utils/lib/easy-chart/note-fields';
import { trimVitalNumber, VITAL_FIXED_UNIT, VITAL_LABEL } from 'utils/lib/easy-chart/vital-entry';
import { createMedicationString } from 'utils/lib/fhir/medication-administration';
import { formatHeightObservationValue } from 'utils/lib/helpers/vitals/vitals-height.helper';
import { celsiusToFahrenheit } from 'utils/lib/helpers/vitals/vitals-temperature.helper';
import { formatWeightKg, formatWeightLbs } from 'utils/lib/helpers/vitals/vitals-weight.helper';
import { getRosFindingStateFromKey } from 'utils/lib/ottehr-config/review-of-systems';
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
import { GetVitalsResponseData } from 'utils/lib/types/api/chart-data/get-vitals.types';
import { ExtendedMedicationDataForResponse } from 'utils/lib/types/api/medication-administration.types';
import { formatDateToMDYWithTime } from 'utils/lib/utils/date';
import { buildChartSnapshot } from '../executor/chartSnapshot';
import { ProvenanceRecord, ProvenanceState } from '../provenance/provenance';
import { AiChartedItem } from './AiChartedItem';
import { ChartEditorSection } from './ChartEditorDialog';
import { buildScreeningQuestionRows, computeSectionVisibility } from './note-visibility';
import { PROCEDURE_REVIEW_FIELDS, procedureFieldLabel } from './procedure-fields';
import { VitalAddChips } from './VitalEntry';

export interface NotePaneProps {
  chartData: GetChartDataResponse | undefined;
  provenance: ProvenanceState;
  readOnly?: boolean;
  onConfirmItem: (resourceId: string) => void;
  onDeleteItem: (field: string, resourceId: string, display: string) => void;
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
  /**
   * Open the real section editor. Exam and ROS are not single-row swaps — the provider ticks several boxes
   * in a system, adds a comment, clears a template's normals — so the section heading opens the page's own
   * editor instead of putting a search box on one row.
   */
  onEditSection?: (section: ChartEditorSection, field?: string) => void;
  /** Replace a charted diagnosis with the row the provider picked from the ICD-10 search. */
  /**
   * Swap one charted row for what the provider picked: remove, write, refetch, and SAY SO if any of that
   * fails. The payload is built here, where the charted row is in hand; the caller owns the sequencing and
   * the error reporting. Absent means these rows are not editable.
   *
   * Diagnosis and CPT have their own props because each carries something extra across the swap — the
   * primary flag, and the rest of a billing line.
   */
  onReplaceItem?: (
    field: string,
    item: { resourceId: string; display: string },
    write: Record<string, unknown>,
    picked: string
  ) => Promise<void>;
  /**
   * Replace a charted CPT code with one the provider picked, the same remove-then-write the diagnosis row
   * does. Absent means the row is not editable.
   */
  onEditCptCode?: (
    item: { resourceId: string; display: string },
    code: { code: string; display: string }
  ) => Promise<void>;
  onEditDiagnosis?: (
    item: { resourceId: string; display: string },
    code: { code: string; display: string }
  ) => void | Promise<void>;
  /**
   * Lab orders placed at this encounter, in-house and send-out. Not chart data — chart data carries lab
   * RESULTS. Both sections exist and the same test legitimately appears in each: one says it was
   * ordered, the other says what came back.
   */
  /**
   * Vitals from get-vitals, already grouped by field. NOT `chartData.vitalsObservations`: only this response
   * carries `alertCriticality`, which is what makes an out-of-range reading red or amber with a warning icon
   * beside it — see the `vitals` field on EasyChartData.
   */
  vitals?: GetVitalsResponseData;
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

const Section: FC<{ label: string; children: ReactNode; onEdit?: () => void }> = ({ label, children, onEdit }) => (
  <Stack spacing={0.5}>
    <Stack direction="row" spacing={0.5} alignItems="center">
      <Typography variant="subtitle2" color="primary.dark">
        {label}
      </Typography>
      {/* On the HEADING, not on a row: what this opens edits the whole section. */}
      {onEdit && (
        <IconButton onClick={onEdit} size="small" aria-label={`edit ${label}`}>
          <EditOutlinedIcon fontSize="inherit" color="primary" />
        </IconButton>
      )}
    </Stack>
    {children}
  </Stack>
);

/**
 * A section whose content is long enough to bury what follows it. Collapsed by default with the count in
 * the label, so the heading still states that the content EXISTS — a hidden section and a collapsed one
 * say very different things to a provider skimming for what they have not done yet.
 */
const CollapsibleSection: FC<{ label: string; children: ReactNode; defaultOpen?: boolean }> = ({
  label,
  children,
  defaultOpen = false,
}) => {
  const [open, setOpen] = useState(defaultOpen);
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
  onConfirmItem,
  onDeleteItem,
  onMakePrimary,
  onConfirmProcedureField,
  inHouseMedications = [],
  immunizations = [],
  onEditSection,
  onEditCptCode,
  onEditDiagnosis,
  onReplaceItem,
  vitals,
  labOrders = [],
  onRemoveLabOrder,
  appointmentStart,
  encounterId,
  onDispositionSaved,
  onNoteFieldSaved,
  addendumResources,
}) => {
  // The ENUM, not a string literal. Hand-written strings silently mismatched five of these — the notes
  // were fetched and then filtered out by a typo, which looks exactly like a patient with no notes.
  const notesOfType = (type: NOTE_TYPE): NoteDTO[] => (chartData?.notes ?? []).filter((note) => note.type === type);

  const snapshot = buildChartSnapshot(chartData);
  const record = (resourceId: string | undefined): ProvenanceRecord | undefined =>
    resourceId ? provenance.byResourceId.get(resourceId) : undefined;

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
      /** Click-to-edit with the app's OWN field for this section, rendered in place. */
      editor?: (item: { resourceId: string; display: string }, close: () => void) => ReactNode;
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
            editor={readOnly || !options.editor ? undefined : (close) => options.editor!(item, close)}
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

  // Grouped exactly as the progress note groups them, by the shared helper.
  const vitalGroups = groupVitalsBySection(vitals);
  const vitalCount = vitalGroups.reduce((total, group) => total + group.readings.length, 0);
  const instructions = chartData?.instructions ?? [];
  const prescriptions = chartData?.prescribedMedications ?? [];
  const radiologyOrders = chartData?.radiologyOrders ?? [];
  const procedures = chartData?.procedures ?? [];

  // BOTH polarities, exactly as Review & Sign lists them (RosReviewContainer): a charted "Denies fever"
  // is part of the note the provider signs, and hiding it here made the two views disagree about what the
  // note contains. It cannot be mistaken for a positive because the snapshot's display carries the word —
  // "Denies fever" / "Reports fever" — which is also what a removal is matched against.
  /**
   * The BASE symptom key for a charted ROS row. The stored field carries the polarity as a suffix
   * (`ros-gi-vomiting-denies`) while the ROS table is keyed by the symptom itself, so the suffix has to
   * come off before it can be used as a scroll target.
   */
  const rosBaseFieldOf = (resourceId: string): string | undefined => {
    const field = (chartData?.rosObservations ?? []).find((o) => o.resourceId === resourceId)?.field;
    if (!field) return undefined;
    const state = getRosFindingStateFromKey(field);
    return state ? field.slice(0, -(state.length + 1)) : field;
  };

  const chartedRos = snapshot.rosFindings.filter((finding) =>
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
    // The chart's own vitals cards do the saving now, and they only need the encounter. This is still
    // "a save path is really wired" — the chips would otherwise open cards that cannot write.
    canSaveVital: Boolean(encounterId),
    vitalCount,
    inHouseMedications,
    immunizations,
    labOrders,
  });

  const sections: { id: string; node: ReactNode }[] = [
    {
      id: 'allergies',
      node: listSection('Allergies', snapshot.allergies, 'allergies', {
        // The Allergies page's own eRx allergen search, opened on the charted allergen.
        editor: (item, close) => {
          if (!onReplaceItem) return undefined;
          const charted = (chartData?.allergies ?? []).find((allergy) => allergy.resourceId === item.resourceId);
          return (
            <AllergyField
              autoFocus
              // No "Other": that branch needs a follow-up text field and an Add button, which a note row has
              // nowhere to put. A custom allergen is still added on the Allergies page.
              includeOther={false}
              value={charted?.name ? ({ name: charted.name } as AllergenOption) : null}
              onChange={(picked) => {
                if (!picked) return;
                close();
                void onReplaceItem(
                  'allergies',
                  item,
                  {
                    allergies: [
                      {
                        id: picked.id?.toString(),
                        name: picked.name,
                        // Status and the inactive note survive the swap: correcting the AGENT must not
                        // silently reactivate an inactive allergy or drop the note that explains it.
                        current: charted?.current ?? true,
                        ...(charted?.note ? { note: charted.note } : {}),
                      },
                    ],
                  },
                  picked.name ?? ''
                );
              }}
            />
          );
        },
        notes: notesOfType(NOTE_TYPE.ALLERGY),
        emptyText: 'None recorded',
      }),
    },

    {
      id: 'intake-medications',
      node: listSection('Medications', snapshot.medications, 'medications', {
        // The Medications page's own eRx drug search, opened on the charted drug.
        editor: (item, close) => {
          if (!onReplaceItem) return undefined;
          const charted = (chartData?.medications ?? []).find((med) => med.resourceId === item.resourceId);
          return (
            <MedicationField
              autoFocus
              value={charted?.name ? ({ name: charted.name } as MedicationOption) : null}
              onChange={(picked) => {
                if (!picked) return;
                close();
                void onReplaceItem(
                  'medications',
                  item,
                  {
                    medications: [
                      {
                        name: picked.name,
                        id: picked.id?.toString(),
                        // The dose and the "patient could not confirm the dosage" qualifier survive the
                        // swap: correcting the DRUG must not silently drop the fact that its dose was never
                        // confirmed. Deliberately NOT a blanket carry-over of the row — the eRx id has to
                        // come from the picked drug, not the old one.
                        ...(charted?.intakeInfo ? { intakeInfo: charted.intakeInfo } : {}),
                        ...(charted?.type ? { type: charted.type } : {}),
                      },
                    ],
                  },
                  picked.name ?? ''
                );
              }}
            />
          );
        },
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
        // The SAME ICD-10 search the Medical Conditions page uses, which is the same one DiagnosesField
        // already wraps — so no fifth picker. `correctionFor('conditions')` used to sit here and always
        // returned undefined: corrections.ts has no conditions catalogue, because the server confirms codes
        // against the terminology service. There was never anything to search, so the row did nothing.
        editor: (item, close) => {
          if (!onReplaceItem) return undefined;
          const charted = (chartData?.conditions ?? []).find((entry) => entry.resourceId === item.resourceId);
          return (
            <DiagnosesField
              autoFocus
              disableForPrimary={false}
              label="Medical condition"
              value={charted?.code ? { code: charted.code, display: charted.display ?? '' } : null}
              onChange={(picked) => {
                close();
                void onReplaceItem(
                  'conditions',
                  item,
                  {
                    conditions: [
                      {
                        code: picked.code,
                        display: picked.display,
                        // Status and note survive the swap, for the same reason they do on an allergy.
                        current: charted?.current ?? true,
                        ...(charted?.note ? { note: charted.note } : {}),
                      },
                    ],
                  },
                  picked.display
                );
              }}
            />
          );
        },
        notes: notesOfType(NOTE_TYPE.MEDICAL_CONDITION),
        describe: (item) =>
          coded(chartData?.conditions?.find((c) => c.resourceId === item.resourceId)?.code, item.display),
      }),
    },

    {
      id: 'surgical-history',
      node: listSection('Surgical History', snapshot.surgicalHistory, 'surgicalHistory', {
        // The Surgical History page's own picker, opened on the charted surgery.
        editor: (item, close) => {
          if (!onReplaceItem) return undefined;
          const charted = (chartData?.surgicalHistory ?? []).find((entry) => entry.resourceId === item.resourceId);
          return (
            <SurgicalHistoryField
              autoFocus
              includeOther={false}
              value={charted?.code ? { code: charted.code, display: charted.display } : null}
              onChange={(picked) => {
                if (!picked) return;
                close();
                void onReplaceItem(
                  'surgicalHistory',
                  item,
                  { surgicalHistory: [{ code: picked.code, display: picked.display }] },
                  picked.display
                );
              }}
            />
          );
        },
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
        // The Hospitalization page's own picker, opened on the charted stay.
        editor: (item, close) => {
          if (!onReplaceItem) return undefined;
          const charted = (chartData?.episodeOfCare ?? []).find((entry) => entry.resourceId === item.resourceId);
          return (
            <HospitalizationField
              autoFocus
              includeOther={false}
              value={charted?.code ? { code: charted.code, display: charted.display } : null}
              onChange={(picked) => {
                if (!picked) return;
                close();
                void onReplaceItem(
                  'episodeOfCare',
                  item,
                  { episodeOfCare: [{ code: picked.code, display: picked.display }] },
                  picked.display
                );
              }}
            />
          );
        },
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
    // The Chief Complaint page's own field. NOTE THE STORAGE SWAP: this component writes the
    // `historyOfPresentIllness` chart key, which is what the whole app displays as the chief complaint —
    // the same mapping `chartKeyForNoteField` encodes, and the reason a reimplementation of either field
    // gets the wrong key half the time.
    {
      id: 'chief-complaint',
      node: (
        <Section key="chief-complaint" label={NOTE_FIELD_LABELS.chiefComplaint}>
          {readOnly || !encounterId ? (
            <ChiefComplaintFieldReadOnly label="" encounterId={encounterId} />
          ) : (
            <ChiefComplaintField label="" encounterId={encounterId} onSaved={onNoteFieldSaved} />
          )}
        </Section>
      ),
    },
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
        <Section
          key="ros"
          label="Review of Systems"
          onEdit={readOnly || !onEditSection ? undefined : () => onEditSection('ros')}
        >
          {chartedRos.map((item) => (
            <AiChartedItem
              key={item.resourceId}
              provenance={record(item.resourceId)}
              // Same as Examination: the row opens the section editor rather than an in-row search, and
              // scrolls to this symptom. The stored field carries the polarity suffix (`…-denies`), while
              // the table is keyed by the BASE symptom, so the suffix is stripped for the scroll target.
              onCorrect={
                readOnly || !onEditSection ? undefined : () => onEditSection('ros', rosBaseFieldOf(item.resourceId))
              }
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
            <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap', mt: chartedRos.length ? 1 : 0 }}>
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
          {vitalCount === 0 && readOnly && <EmptyValue />}
          {/* Grouped under the reading's name, each row rendered by the CHART'S OWN vitals entry — the same
              unit conversions, the same critical/abnormal colour and icon the progress note prints. Only the
              "when, by whom" prefix is dropped: the row around it already carries the provenance and its
              hover detail, so the timestamp would be the same fact twice on one line. The cards below are for
              ENTRY. */}
          {vitalGroups.map((group) => (
            <Box key={group.field} sx={{ mb: 0.5 }}>
              <Typography variant="body2" fontWeight={600}>
                {group.label}
              </Typography>
              {group.readings.map((vital, index) => (
                <VitalRow
                  key={vital.resourceId ?? `${group.field}-${index}`}
                  vital={vital}
                  provenance={record(vital.resourceId)}
                  onConfirm={vital.resourceId ? () => onConfirmItem(vital.resourceId!) : undefined}
                  onDelete={
                    readOnly || !vital.resourceId
                      ? undefined
                      : () => onDeleteItem('vitalsObservations', vital.resourceId!, describeVital(vital))
                  }
                />
              ))}
            </Box>
          ))}
          {/* Ghost "+ HR" chips: a simple numeric should not have to be routed through the assistant.
              Clicking one opens the Vitals page's own card for that vital. */}
          {encounterId && <VitalAddChips encounterId={encounterId} readOnly={readOnly} />}
          <SectionNotes notes={notesOfType(NOTE_TYPE.VITALS)} />
        </Section>
      ),
    },

    // Grouped by body-system card, the way the exam is organised. A flat list loses which system each
    // finding belongs to, which is the thing the exam is filed by.
    {
      id: 'examination',
      node: (
        <Section
          key="examination"
          label="Examination"
          onEdit={readOnly || !onEditSection ? undefined : () => onEditSection('exam')}
        >
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
                    // Clicking a finding opens the Examination editor, not a search box on the row. A
                    // single-row swap cannot express what this section needs — several boxes in one
                    // system, a comment, clearing a template's normals — and the in-row search never
                    // worked anyway: it queried a fuzzy catalogue built for whole phrases from the model,
                    // so a partial typed query matched nothing and the field looked editable and was not.
                    onCorrect={readOnly || !onEditSection ? undefined : () => onEditSection('exam', finding.field)}
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
        // The Assessment page's own field, which searches ICD-10 through useICD10SearchNew. Its onChange
        // hands back one search row, so the charted code and display can never come from different rows —
        // the same rule the server enforces. The bespoke picker that used to be here had no catalogue at
        // all: `conditions` is UNAVAILABLE by design, so clicking a diagnosis did nothing.
        editor: (item, close) => {
          if (!onEditDiagnosis) return undefined;
          // Pre-filled with the row's own code, so the field opens showing what is charted rather than an
          // empty search — the provider is correcting a value, not entering one from nothing.
          const charted = (chartData?.diagnosis ?? []).find((dx) => dx.resourceId === item.resourceId);
          return (
            <DiagnosesField
              autoFocus
              disableForPrimary={false}
              value={charted?.code ? { code: charted.code, display: charted.display } : null}
              onChange={(code) => {
                // Close FIRST, then write. The row is controlled from chart data, so leaving the field
                // open re-renders it with the pre-write value and reads as the pick being discarded.
                close();
                void onEditDiagnosis(item, code);
              }}
            />
          );
        },
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

    // The Assessment card's own MDM field, not a second implementation. It owns the debounced save, the
    // in-flight indicator, and the `*` the practice's `mdmRequired` config adds to the label — and MDM is
    // a sign blocker, so a field that saves differently here than in the chart is a note that reports
    // itself signable in one place and not the other.
    {
      id: 'mdm',
      node: (
        <Section key="mdm" label={NOTE_FIELD_LABELS.medicalDecision}>
          {readOnly || !encounterId ? (
            <MedicalDecisionFieldReadOnly encounterId={encounterId} />
          ) : (
            // Empty label, as for HPI: the section heading already names the field, and the `*` the
            // practice's mdmRequired config appends would read as a second, competing requirement marker
            // next to the readiness banner that already reports MDM as a sign blocker.
            <MedicalDecisionField label="" encounterId={encounterId} onSaved={onNoteFieldSaved} />
          )}
        </Section>
      ),
    },

    {
      id: 'em-code',
      node: (
        <Section key="em-code" label="E&M Code">
          {/* A SET level reads as text and turns into the Assessment card's own dropdown on click, like
              every other charted row. It used to render that dropdown permanently, which made the one
              section of the note that is always a form; a level the provider agrees with does not need an
              input, it needs to be readable.

              An UNSET level is the exception, and it stays a field. There is no row to click, and the level
              is required to sign — the readiness banner reports it as a blocker — so hiding the only way to
              set it behind a click on nothing would leave that blocker with nowhere to fix it. */}
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
          ) : chartData?.emCode?.code ? (
            <AiChartedItem
              provenance={record(chartData.emCode.resourceId)}
              onConfirm={chartData.emCode.resourceId ? () => onConfirmItem(chartData.emCode!.resourceId!) : undefined}
              onDelete={
                chartData.emCode.resourceId
                  ? () => onDeleteItem('emCode', chartData.emCode!.resourceId!, chartData.emCode!.code)
                  : undefined
              }
              editor={(close) => (
                <EMCodeField
                  encounterId={encounterId}
                  emCode={chartData?.emCode}
                  autoFocus
                  // The field owns its own write, so unlike the diagnosis and CPT rows there is nothing to
                  // close BEFORE: it updates the store optimistically, so the value it shows is already the
                  // picked one. Closing when the save lands hands the row back to the refetched data.
                  onSaved={() => {
                    close();
                    onNoteFieldSaved?.();
                  }}
                />
              )}
            >
              <Typography variant="body2">{coded(chartData.emCode.code, chartData.emCode.display ?? '')}</Typography>
            </AiChartedItem>
          ) : (
            <EMCodeField encounterId={encounterId} emCode={chartData?.emCode} onSaved={onNoteFieldSaved} />
          )}
        </Section>
      ),
    },

    {
      id: 'cpt-codes',
      node: listSection('CPT Codes', snapshot.cptCodes, 'cptCodes', {
        // The Billing card's own CPT search, the same field the Assessment page adds codes with — so a
        // correction here picks from the same catalogue, ranked the same way. `correctionFor('cptCodes')`
        // used to sit here and always returned undefined: corrections.ts has no CPT catalogue, so the row
        // simply was not clickable.
        editor: (item, close) => {
          if (!onEditCptCode) return undefined;
          const charted = (chartData?.cptCodes ?? []).find((cpt) => cpt.resourceId === item.resourceId);
          return (
            <CptCodeField
              autoFocus
              label="CPT code"
              value={charted?.code ? { code: charted.code, display: charted.display } : null}
              onChange={(code) => {
                // Close FIRST, then write — see the diagnosis row: this row is controlled from chart data,
                // so an editor left open re-renders with the pre-write value and reads as a discarded pick.
                close();
                void onEditCptCode(item, code);
              }}
            />
          );
        },
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
        // Open by default, collapsible for when it gets long. These are what the assistant JUST wrote and
        // what the provider has to check before signing, so hiding them behind a click makes the one
        // section that most needs review the easiest to miss.
        <CollapsibleSection key="instructions" defaultOpen label={`Patient Instructions (${instructions.length})`}>
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
    // The chart's own components — the vitals cards, the note list, the disposition card — read the lock
    // from `useGetAppointmentAccessibility`, which derives it from the APPOINTMENT STORE. This route does
    // not populate that store, and an empty store answers "not locked": on a signed visit every one of
    // them would render live inputs. The provider hands them the truth.
    <AppointmentAccessibilityOverrideProvider value={{ isAppointmentReadOnly: Boolean(readOnly) }}>
      <Stack spacing={2} divider={<Divider flexItem />} sx={{ pb: 4 }}>
        {shown.map((section) => (
          <Fragment key={section.id}>{section.node}</Fragment>
        ))}
      </Stack>
    </AppointmentAccessibilityOverrideProvider>
  );
};

/**
 * One charted vital. A vital is numeric, so its correction is an inline editor rather than a catalogue
 * picker — but it carries the same provenance treatment as every other AI-written row.
 */
const VitalRow: FC<{
  vital: VitalsObservationDTO;
  provenance?: ProvenanceRecord;
  onConfirm?: () => void;
  onDelete?: () => void;
}> = ({ vital, provenance, onConfirm, onDelete }) => (
  // No inline editor. A reading is corrected the way the Vitals page corrects one — remove it and add
  // the right value through the card — because each reading is its own observation with its own time, and
  // silently rewriting one in place would lose that it was ever taken.
  //
  // `onDelete` goes to the ROW, not to VitalHistoryElement: the row's delete is this page's own (it clears
  // the AI mark with it), and the component's own delete button opens a separate confirmation modal.
  <AiChartedItem provenance={provenance} onConfirm={onConfirm} onDelete={onDelete}>
    <VitalHistoryElement historyEntry={vital} hideAttribution />
  </AiChartedItem>
);

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
