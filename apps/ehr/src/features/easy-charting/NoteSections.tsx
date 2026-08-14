// Presentational building blocks of the easy-chart note: section frames, inline editors, vital
// rows, the flash/remove animations, and the full NoteSections renderer.
import CheckIcon from '@mui/icons-material/Check';
import HelpOutlineIcon from '@mui/icons-material/HelpOutline';
import { Box, Button, Divider, IconButton, Paper, Stack, Tooltip, Typography } from '@mui/material';
import { FIELD_TO_SECTION_LABEL } from 'utils/lib/helpers/easy-chart-chart-state';
import type { ExamObservationDTO } from 'utils/lib/types/api/chart-data/chart-data.types';
import {
  DiagnosisDTO,
  MedicationDTO,
  NOTE_TYPE,
  NoteDTO,
  ProcedureDTO,
  VitalsObservationDTO,
} from 'utils/lib/types/api/chart-data/chart-data.types';
import { GetChartDataResponse } from 'utils/lib/types/api/chart-data/get-chart-data.types';
import { ExtendedMedicationDataForResponse } from 'utils/lib/types/api/medication-administration.types';
import { ImmunizationOrder } from 'utils/lib/types/data/immunization/types';
import { AddendumSection, hasAddendaToShow } from './AddendumSection';
import { AdditionalQuestionsSection, hasAdditionalQuestions } from './AdditionalQuestionsSection';
import { AiAlternative, AiChartedItem } from './AiChartedItem';
import { AiChartedMeta, AiField, ChartNoteKey, EasyChartLabOrder, ProcedureProvenance } from './chart-types';
import { DispositionSection } from './DispositionSection';
import { ImmunizationSection } from './ImmunizationSection';
import { InHouseMedicationsSection } from './InHouseMedicationsSection';
import InlineNoteField from './InlineNoteField';
import { hasLabResultsToShow, LabResultsList } from './LabResultsList';
// Shared section-header styling so each band in the note reads like a real section header
// rather than a flat label. Underlined + bolded primary-color text on a hairline divider.
import {
  CollapsibleSection,
  DeletableRow,
  flashSx,
  formatProcedureType,
  InlineEditableText,
  InlineEnumField,
  removeFlashSx,
  Section,
  VitalRow,
} from './note-ui';
import { PrescriptionsSection } from './PrescriptionsSection';
import { PrivacyPolicyLine } from './PrivacyPolicyLine';
import { RadiologySection } from './RadiologySection';
import { ReviewableInstructionLine } from './ReviewableInstructionLine';
import { SchoolWorkExcuseSection } from './SchoolWorkExcuseSection';
import { VitalAddChips } from './VitalAddChips';

// Per-section provider notes (allergy / medication / hospitalization / vitals NoteDTOs from
// chartData.notes) rendered as compact caption lines under the section's items, mirroring the
// "…notes" sub-blocks of the Review & Sign containers.
function SectionNotes({ notes }: { notes: NoteDTO[] }): JSX.Element | null {
  if (notes.length === 0) return null;
  return (
    <Stack spacing={0.25} sx={{ mt: 0.5 }}>
      {notes.map((n, i) => (
        <Typography key={n.resourceId ?? i} variant="caption" color="text.secondary">
          Note: {n.text}
        </Typography>
      ))}
    </Stack>
  );
}

// The full easy-chart note, rendered section by section (history, free-text fields, ROS, exam,
// vitals, assessment, MDM, billing, procedures, labs, instructions, disposition). Split from
// note-ui.tsx so the reusable building blocks and the note assembly live separately.
export interface NoteSectionsProps {
  data: GetChartDataResponse;
  freshlyAdded: Set<string>;
  removingItems: Set<string>;
  // Lab orders on this encounter + the cancel callback. Rendered as a "Labs ordered" section with
  // the same remove affordance as other items; omitted/empty → no section.
  labOrders?: EasyChartLabOrder[];
  onRemoveLabOrder?: (order: EasyChartLabOrder) => void;
  // When true, the left pane is directly editable: free-text fields become text areas and
  // structured items get an inline remove control. Omitted/false → read-only (legacy behavior).
  editable?: boolean;
  onSaveField?: (key: ChartNoteKey, text: string) => void;
  // Provenance + needs-review flags for the AI-written free-text fields, keyed by chart-data scalar
  // key. Drives the source-comparison popover and the amber "review" highlight on HPI / MDM.
  noteFieldMeta?: Map<ChartNoteKey, { sourceText?: string; needsReview?: boolean; reason?: string }>;
  onConfirmNoteField?: (key: ChartNoteKey) => void;
  // Needs-review flags for patient-instruction lines, keyed by resourceId.
  instructionMeta?: Map<string, { needsReview?: boolean; reason?: string }>;
  onConfirmInstruction?: (resourceId: string) => void;
  onRemoveItem?: (field: string, dto: { resourceId?: string }) => void;
  // Promote a diagnosis to primary (and demote the previous primary). Shown inline next to each
  // non-primary diagnosis when editable.
  onMakePrimary?: (dto: DiagnosisDTO) => void;
  // Persist an edited procedure (inline per-field editing in the Procedures section).
  onSaveProcedure?: (procedure: ProcedureDTO) => void | Promise<void>;
  // Persist an edited vital (inline numeric editing in the Vitals section).
  onSaveVital?: (vital: VitalsObservationDTO) => void | Promise<void>;
  // Allowed values per constrained procedure field (code → display), from the loaded ValueSets.
  // Fields present here render a dropdown of their options; others stay free text.
  procedureFieldAllowed?: Map<keyof ProcedureDTO, Map<string, string>>;
  // AI-charted items needing review (keyed by resourceId), plus the correction callbacks. When a
  // row's resourceId is in this map it renders as a clickable <AiChartedItem> instead of a row.
  aiCharted?: Map<string, AiChartedMeta>;
  onAiSearch?: (field: AiField, query: string) => Promise<AiAlternative[]>;
  onAiReplace?: (field: AiField, dto: { resourceId?: string }, key: string, checkboxChecked?: boolean) => void;
  onAiRemove?: (field: AiField, dto: { resourceId?: string }) => void;
  /** Save edited free-text for an exam SECTION NOTE row (comment observations). */
  onEditExamComment?: (dto: ExamObservationDTO, newText: string) => void | Promise<void>;
  onAiDiscuss?: (field: AiField, dto: { resourceId?: string }, meta: AiChartedMeta) => void;
  onAiSetMedDosage?: (dto: { resourceId?: string }, value: boolean) => void;
  onAiSetRosState?: (dto: { resourceId?: string }, denies: boolean) => void;
  // Accept an AI-charted item as-is (clears its needs-review highlight) without changing it.
  onAiConfirm?: (dto: { resourceId?: string }) => void;
  // Field-level provenance for AI-added procedures (keyed by procedure resourceId): which template-
  // default fields still need the provider's review, plus the confirm callbacks.
  procedureProvenance?: Map<string, ProcedureProvenance>;
  onConfirmProcedureField?: (resourceId: string, field: keyof ProcedureDTO) => void;
  onConfirmProcedure?: (resourceId: string) => void;
  // ISO start of the visit's Appointment, for the privacy-policy acknowledgement line. Omitted →
  // the line renders without the date.
  appointmentStart?: string;
  // In-house (administered) MAR orders for this encounter, from a separate get-medication-orders
  // query (NOT the chart-data fetch). Omitted/empty → no section (unless medication notes exist).
  inHouseMedications?: ExtendedMedicationDataForResponse[];
  // Administered immunization orders, from a separate get-immunization-orders query (already
  // filtered to administered/administered-partly). Omitted/empty → no section.
  immunizationOrders?: ImmunizationOrder[];
  // Legacy single-string addendum (Encounter extension), fetched separately. The per-author
  // addendum notes come from data.notes.
  legacyAddendumText?: string;
}

export function NoteSections({
  data,
  freshlyAdded,
  removingItems,
  labOrders,
  onRemoveLabOrder,
  editable = false,
  onSaveField,
  noteFieldMeta,
  onConfirmNoteField,
  instructionMeta,
  onConfirmInstruction,
  onRemoveItem,
  onMakePrimary,
  onSaveProcedure,
  onSaveVital,
  procedureFieldAllowed,
  aiCharted,
  onAiSearch,
  onAiReplace,
  onAiRemove,
  onEditExamComment,
  onAiDiscuss,
  onAiSetMedDosage,
  onAiSetRosState,
  onAiConfirm,
  procedureProvenance,
  onConfirmProcedureField,
  onConfirmProcedure,
  appointmentStart,
  inHouseMedications,
  immunizationOrders,
  legacyAddendumText,
}: NoteSectionsProps): JSX.Element {
  const removeHandler = (field: string, dto: { resourceId?: string }): (() => void) | undefined =>
    editable && onRemoveItem && dto.resourceId ? () => onRemoveItem(field, dto) : undefined;
  // Render an allergy/diagnosis row that the assistant charted as a clickable, highlighted
  // AiChartedItem (review affordance); fall back to `fallback` (the normal row) when it's a
  // provider-entered item or the AI-review wiring isn't supplied.
  const aiMeta = (dto: { resourceId?: string }): AiChartedMeta | undefined =>
    dto.resourceId ? aiCharted?.get(dto.resourceId) : undefined;
  // Best-effort display string for an item that wasn't AI-charted this session (so no stored
  // provenance) — used to seed its inline editor's search.
  const deriveItemDisplay = (field: AiField, dto: { resourceId?: string }): string => {
    const d = dto as { display?: string; name?: string; code?: string; label?: string; field?: string };
    if (field === 'medications' || field === 'allergies') return d.name ?? d.display ?? '';
    if (field === 'examObservations' || field === 'rosObservations') return d.label ?? d.field ?? '';
    return d.display ?? d.name ?? d.code ?? '';
  };
  const renderAiChartable = (
    field: AiField,
    dto: { resourceId?: string },
    label: React.ReactNode,
    fallback: JSX.Element,
    editText?: { value: string; label: string; onSave: (newText: string) => void | Promise<void> }
  ): JSX.Element => {
    // EVERY discrete item with a resourceId is editable — not just ones the AI charted this session.
    // Reuse the stored review provenance when present (→ needs-review tint); otherwise synthesize a
    // default so a provider-entered / template / prior-session item gets the same edit affordance.
    const realMeta = aiMeta(dto);
    if (!editable || !dto.resourceId || !onAiSearch || !onAiReplace || !onAiRemove || !onAiDiscuss) return fallback;
    const needsReview = !!realMeta;
    const seedDisplay = realMeta?.display ?? deriveItemDisplay(field, dto);
    const meta: AiChartedMeta = realMeta ?? {
      field,
      display: seedDisplay,
      searchTerms: seedDisplay ? [seedDisplay] : [],
      lowConfidence: false,
    };
    const isMed = field === 'medications';
    // Observations (exam/ROS) and the billing codes have no right-panel picker → hide Discuss.
    const hideDiscuss =
      field === 'cptCodes' || field === 'emCode' || field === 'examObservations' || field === 'rosObservations';
    // The optional in-popover checkbox: medications carry "doesn't know dosage", ROS carries the
    // denies/reports polarity. Both update the current item in place and carry to a replacement.
    let checkboxOption: { label: string; checked: boolean; onChange: (v: boolean) => void } | undefined;
    if (isMed && onAiSetMedDosage) {
      checkboxOption = {
        label: "Patient doesn't know dosage",
        checked: !!(dto as MedicationDTO).intakeInfo?.patientCouldNotConfirmDosage,
        onChange: (v) => onAiSetMedDosage(dto, v),
      };
    } else if (field === 'rosObservations' && onAiSetRosState) {
      checkboxOption = {
        label: 'Patient denies (uncheck for reports)',
        checked: !!(dto as ExamObservationDTO).field?.endsWith('-denies'),
        onChange: (v) => onAiSetRosState(dto, v),
      };
    }
    return (
      <AiChartedItem
        key={dto.resourceId}
        needsReview={needsReview}
        lowConfidence={meta.lowConfidence}
        inferred={meta.inferred}
        sourceText={meta.sourceText}
        reviewNote={meta.reviewNote}
        caution={meta.caution}
        templateName={meta.templateName}
        onConfirm={needsReview && onAiConfirm && dto.resourceId ? () => onAiConfirm(dto) : undefined}
        // Medications: seed the picker from the clean drug name (searchTerms[0], e.g. "Prednisone")
        // rather than the verbose display ("Prednisone 40 mg tablet") — eRx's searchMedications
        // returns no matches for a strength/form-laden string, so the verbose display made every
        // click-to-correct on a charted med come up empty.
        initialQuery={isMed && meta.searchTerms?.[0] ? meta.searchTerms[0] : meta.display}
        onSearch={(q) => onAiSearch(field, q)}
        onReplace={(key, checked) => onAiReplace(field, dto, key, checked)}
        onRemove={() => onAiRemove(field, dto)}
        onDiscuss={() => onAiDiscuss(field, dto, meta)}
        hideDiscuss={hideDiscuss}
        checkboxOption={checkboxOption}
        editText={editText}
      >
        {label}
      </AiChartedItem>
    );
  };
  // Pick the right flash style: red if the item is being removed, yellow if it was just added,
  // none otherwise. Removing wins so adding-then-immediately-removing still reads as a removal.
  const itemSx = (resourceId: string | undefined): typeof flashSx | undefined => {
    if (!resourceId) return undefined;
    if (removingItems.has(resourceId)) return removeFlashSx;
    if (freshlyAdded.has(resourceId)) return flashSx;
    return undefined;
  };
  // In-person CC ↔ HPI swap: the textareas labelled "Chief Complaint" and "History of Present Illness"
  // are backed by the historyOfPresentIllness and chiefComplaint chart-data keys respectively.
  const chiefComplaint = data.historyOfPresentIllness?.text;
  const hpi = data.chiefComplaint?.text;
  const moi = data.mechanismOfInjury?.text;
  const rosText = data.ros?.text;
  const mdm = data.medicalDecision?.text;

  const positiveRos = (data.rosObservations ?? []).filter((o) => o.value === true);
  const abnormalExam = (data.examObservations ?? []).filter((o) => o.value === true);
  const examWithNotes = (data.examObservations ?? []).filter((o) => o.note && o.note.trim());

  const dx = data.diagnosis ?? [];
  const cptCodes = data.cptCodes ?? [];
  const emCode = data.emCode;
  const procedures = data.procedures ?? [];
  const instructions = data.instructions ?? [];
  const conditions = data.conditions ?? [];
  const allergies = data.allergies ?? [];
  const medications = data.medications ?? [];
  const surgicalHistory = data.surgicalHistory ?? [];
  const hospitalizations = data.episodeOfCare ?? [];
  const vitals = data.vitalsObservations ?? [];
  const showLabResults = hasLabResultsToShow(data.inHouseLabResults, data.externalLabResults);
  const disposition = data.disposition;
  const radiologyOrders = data.radiologyOrders ?? [];
  const schoolWorkNotes = data.schoolWorkNotes ?? [];
  // Per-type provider notes (Review & Sign appends these under the matching containers). They
  // arrive in the same chart-data fetch (progressNoteChartDataRequestedFields.notes).
  const notesOfType = (type: NOTE_TYPE): NoteDTO[] => (data.notes ?? []).filter((n) => n.type === type);
  const allergyNotes = notesOfType(NOTE_TYPE.ALLERGY);
  const medicationNotes = notesOfType(NOTE_TYPE.INTAKE_MEDICATION);
  const hospitalizationNotes = notesOfType(NOTE_TYPE.HOSPITALIZATION);
  const vitalsNotes = notesOfType(NOTE_TYPE.VITALS);
  const screeningNotes = notesOfType(NOTE_TYPE.SCREENING);
  const inHouseMedicationNotes = notesOfType(NOTE_TYPE.MEDICATION);
  const addendumNotes = notesOfType(NOTE_TYPE.ADDENDUM);
  const showAdditionalQuestions = hasAdditionalQuestions(data.observations, screeningNotes);
  const showInHouseMedications = (inHouseMedications?.length ?? 0) > 0 || inHouseMedicationNotes.length > 0;
  const showImmunizations = (immunizationOrders?.length ?? 0) > 0;
  const prescribedMedications = data.prescribedMedications ?? [];
  const showAddendum = hasAddendaToShow(addendumNotes, legacyAddendumText);

  const examBySection = new Map<string, typeof abnormalExam>();
  abnormalExam.forEach((o) => {
    const label = FIELD_TO_SECTION_LABEL[o.field] ?? 'Other';
    if (!examBySection.has(label)) examBySection.set(label, []);
    examBySection.get(label)!.push(o);
  });

  const anything =
    chiefComplaint ||
    hpi ||
    moi ||
    rosText ||
    positiveRos.length ||
    abnormalExam.length ||
    examWithNotes.length ||
    mdm ||
    dx.length ||
    cptCodes.length ||
    emCode ||
    instructions.length ||
    conditions.length ||
    allergies.length ||
    medications.length ||
    surgicalHistory.length ||
    hospitalizations.length ||
    vitals.length ||
    procedures.length ||
    showLabResults ||
    disposition?.type ||
    radiologyOrders.length ||
    schoolWorkNotes.length ||
    showAdditionalQuestions ||
    allergyNotes.length ||
    medicationNotes.length ||
    hospitalizationNotes.length ||
    vitalsNotes.length ||
    showInHouseMedications ||
    showImmunizations ||
    prescribedMedications.length ||
    showAddendum;

  // In editable mode we always render so the free-text editors are available to type into even
  // on a brand-new encounter; read-only mode keeps the original empty placeholder.
  if (!anything && !editable) {
    return (
      <Paper variant="outlined" sx={{ p: 2 }}>
        <Typography variant="body2" color="text.secondary">
          No chart data yet for this encounter.
        </Typography>
      </Paper>
    );
  }

  return (
    <Paper variant="outlined" sx={{ p: 2 }}>
      <Stack divider={<Divider flexItem />}>
        {(allergies.length > 0 || allergyNotes.length > 0) && (
          <Section title="Allergies">
            <Stack spacing={0.25}>
              {allergies.map((a, i) =>
                renderAiChartable(
                  'allergies',
                  a,
                  <Typography variant="body2">• {a.name ?? '(unnamed)'}</Typography>,
                  <DeletableRow
                    key={a.resourceId ?? i}
                    editable={editable}
                    resourceId={a.resourceId}
                    flashSx={itemSx(a.resourceId)}
                    onDelete={removeHandler('allergies', a)}
                  >
                    <Typography variant="body2">• {a.name ?? '(unnamed)'}</Typography>
                  </DeletableRow>
                )
              )}
            </Stack>
            <SectionNotes notes={allergyNotes} />
          </Section>
        )}

        {(medications.length > 0 || medicationNotes.length > 0) && (
          <Section title="Medications">
            <Stack spacing={0.25}>
              {medications.map((m, i) =>
                renderAiChartable(
                  'medications',
                  m,
                  <Typography variant="body2">
                    • {m.name}
                    {m.intakeInfo?.dose ? ` — ${m.intakeInfo.dose}` : ''}
                    {m.intakeInfo?.patientCouldNotConfirmDosage && (
                      <Typography component="span" variant="caption" color="text.secondary">
                        {' '}
                        (dosage unconfirmed)
                      </Typography>
                    )}
                  </Typography>,
                  <DeletableRow
                    key={m.resourceId ?? i}
                    editable={editable}
                    resourceId={m.resourceId}
                    flashSx={itemSx(m.resourceId)}
                    onDelete={removeHandler('medications', m)}
                  >
                    <Typography variant="body2">
                      • {m.name}
                      {m.intakeInfo?.dose ? ` — ${m.intakeInfo.dose}` : ''}
                      {m.intakeInfo?.patientCouldNotConfirmDosage && (
                        <Typography component="span" variant="caption" color="text.secondary">
                          {' '}
                          (dosage unconfirmed)
                        </Typography>
                      )}
                    </Typography>
                  </DeletableRow>
                )
              )}
            </Stack>
            <SectionNotes notes={medicationNotes} />
          </Section>
        )}

        {conditions.length > 0 && (
          <Section title="Medical History">
            <Stack spacing={0.25}>
              {conditions.map((c, i) =>
                renderAiChartable(
                  'conditions',
                  c,
                  <Typography variant="body2">
                    {c.code ? <strong>{c.code}</strong> : null}
                    {c.code ? ' — ' : ''}
                    {c.display ?? '(no display)'}
                  </Typography>,
                  <DeletableRow
                    key={c.resourceId ?? i}
                    editable={editable}
                    resourceId={c.resourceId}
                    flashSx={itemSx(c.resourceId)}
                    onDelete={removeHandler('conditions', c)}
                  >
                    <Typography variant="body2">
                      {c.code ? <strong>{c.code}</strong> : null}
                      {c.code ? ' — ' : ''}
                      {c.display ?? '(no display)'}
                    </Typography>
                  </DeletableRow>
                )
              )}
            </Stack>
          </Section>
        )}

        {surgicalHistory.length > 0 && (
          <Section title="Surgical History">
            <Stack spacing={0.25}>
              {surgicalHistory.map((s, i) =>
                renderAiChartable(
                  'surgicalHistory',
                  s,
                  <Typography variant="body2">
                    <strong>{s.code}</strong>
                    {s.display ? ` — ${s.display}` : ''}
                  </Typography>,
                  <DeletableRow
                    key={s.resourceId ?? i}
                    editable={editable}
                    resourceId={s.resourceId}
                    flashSx={itemSx(s.resourceId)}
                    onDelete={removeHandler('surgicalHistory', s)}
                  >
                    <Typography variant="body2">
                      <strong>{s.code}</strong>
                      {s.display ? ` — ${s.display}` : ''}
                    </Typography>
                  </DeletableRow>
                )
              )}
            </Stack>
          </Section>
        )}

        {(hospitalizations.length > 0 || hospitalizationNotes.length > 0) && (
          <Section title="Hospitalizations">
            <Stack spacing={0.25}>
              {hospitalizations.map((h, i) =>
                renderAiChartable(
                  'episodeOfCare',
                  h,
                  <Typography variant="body2">
                    <strong>{h.code}</strong>
                    {h.display ? ` — ${h.display}` : ''}
                  </Typography>,
                  <DeletableRow
                    key={h.resourceId ?? i}
                    editable={editable}
                    resourceId={h.resourceId}
                    flashSx={itemSx(h.resourceId)}
                    onDelete={removeHandler('episodeOfCare', h)}
                  >
                    <Typography variant="body2">
                      <strong>{h.code}</strong>
                      {h.display ? ` — ${h.display}` : ''}
                    </Typography>
                  </DeletableRow>
                )
              )}
            </Stack>
            <SectionNotes notes={hospitalizationNotes} />
          </Section>
        )}

        {/* In-house (administered) meds + immunizations after Hospitalizations, mirroring the tail
            of Review & Sign's medical-history block. Both are query-backed (fetched in
            EasyChartPage, separate from chart data) and display-only. */}
        {showInHouseMedications && (
          <InHouseMedicationsSection medications={inHouseMedications ?? []} notes={inHouseMedicationNotes} />
        )}

        {showImmunizations && <ImmunizationSection orders={immunizationOrders ?? []} />}

        {(editable || chiefComplaint) && (
          <Section title="Chief Complaint">
            {editable && onSaveField ? (
              // CC↔HPI swap: the "Chief Complaint" textarea is backed by the historyOfPresentIllness key.
              <InlineNoteField
                label="Chief Complaint"
                value={chiefComplaint ?? ''}
                minRows={1}
                onSave={(text) => onSaveField('historyOfPresentIllness', text)}
              />
            ) : (
              <Typography
                variant="body2"
                data-easy-chart-id={data.historyOfPresentIllness?.resourceId}
                sx={{
                  whiteSpace: 'pre-wrap',
                  ...(itemSx(data.historyOfPresentIllness?.resourceId) ?? {}),
                }}
              >
                {chiefComplaint}
              </Typography>
            )}
          </Section>
        )}

        {(editable || hpi) && (
          <Section title="History of Present Illness">
            {editable && onSaveField ? (
              <InlineNoteField
                label="History of Present Illness"
                value={hpi ?? ''}
                minRows={3}
                onSave={(text) => onSaveField('chiefComplaint', text)}
                sourceText={noteFieldMeta?.get('chiefComplaint')?.sourceText}
                needsReview={noteFieldMeta?.get('chiefComplaint')?.needsReview}
                reviewNote={noteFieldMeta?.get('chiefComplaint')?.reason}
                onConfirm={() => onConfirmNoteField?.('chiefComplaint')}
              />
            ) : (
              <Typography
                variant="body2"
                data-easy-chart-id={data.chiefComplaint?.resourceId}
                sx={{
                  whiteSpace: 'pre-wrap',
                  ...(itemSx(data.chiefComplaint?.resourceId) ?? {}),
                }}
              >
                {hpi}
              </Typography>
            )}
          </Section>
        )}

        {(editable || moi) && (
          <Section title="Mechanism of Injury">
            {editable && onSaveField ? (
              <InlineNoteField
                label="Mechanism of Injury"
                value={moi ?? ''}
                minRows={2}
                onSave={(text) => onSaveField('mechanismOfInjury', text)}
              />
            ) : (
              <Typography
                variant="body2"
                data-easy-chart-id={data.mechanismOfInjury?.resourceId}
                sx={{
                  whiteSpace: 'pre-wrap',
                  ...(itemSx(data.mechanismOfInjury?.resourceId) ?? {}),
                }}
              >
                {moi}
              </Typography>
            )}
          </Section>
        )}

        {/* ROS is a structured Observation collection (rosObservations) — the same shape as the
            exam findings — NOT a free-text field. Present the positive findings like Examination,
            with inline delete. The free-text `ros` is legacy; show it read-only only if present. */}
        {(rosText || positiveRos.length > 0) && (
          <Section title="Review of Systems">
            {positiveRos.length > 0 && (
              <Stack spacing={0.25}>
                {positiveRos.map((o) => {
                  const rosLabel = (
                    <Typography variant="body2">
                      • {o.field.endsWith('-denies') ? 'Denies' : 'Reports'} {o.label ?? o.field}
                      {o.note ? ` — ${o.note}` : ''}
                    </Typography>
                  );
                  return renderAiChartable(
                    'rosObservations',
                    o,
                    rosLabel,
                    <DeletableRow
                      key={o.field}
                      editable={editable}
                      resourceId={o.resourceId}
                      flashSx={itemSx(o.resourceId)}
                      onDelete={removeHandler('rosObservations', o)}
                    >
                      {rosLabel}
                    </DeletableRow>
                  );
                })}
              </Stack>
            )}
            {rosText && (
              <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap', mt: positiveRos.length ? 1 : 0 }}>
                {rosText}
              </Typography>
            )}
          </Section>
        )}

        {(vitals.length > 0 || vitalsNotes.length > 0 || (editable && onSaveVital)) && (
          <Section title="Vitals">
            <Stack spacing={0.25}>
              {vitals.map((v, i) => (
                // Vitals aren't searchable like diagnoses/meds, so they use VitalRow (numeric inline
                // edit) instead of AiChartedItem — but carry the same provenance/review treatment.
                <VitalRow
                  key={v.resourceId ?? i}
                  vital={v}
                  meta={aiMeta(v)}
                  editable={editable}
                  onConfirm={onAiConfirm && v.resourceId ? () => onAiConfirm(v) : undefined}
                  onRemove={removeHandler('vitalsObservations', v)}
                  onSaveVital={onSaveVital}
                />
              ))}
            </Stack>
            {/* When editable, un-charted standard vitals are always directly enterable via ghost
                "+ <Label>" chips — no need to route simple numerics through the assistant. */}
            {editable && onSaveVital && <VitalAddChips vitals={vitals} onSaveVital={onSaveVital} />}
            <SectionNotes notes={vitalsNotes} />
          </Section>
        )}

        {(abnormalExam.length > 0 || examWithNotes.length > 0) && (
          <Section title="Examination">
            {abnormalExam.length > 0 && (
              <Box sx={{ mb: examWithNotes.length ? 1 : 0 }}>
                <Typography variant="caption" color="text.secondary">
                  Abnormal findings
                </Typography>
                <Stack spacing={0.5} sx={{ mt: 0.5 }}>
                  {Array.from(examBySection.entries()).map(([label, findings]) => (
                    <Box key={label}>
                      <Typography variant="body2" fontWeight={600}>
                        {label}
                      </Typography>
                      <Stack spacing={0.25}>
                        {findings.map((f) => {
                          const checkedComponents = (f.components ?? []).filter((c) => c.value);
                          // Group component labels by their groupLabel so checked options read like the
                          // regular ExamCheckboxWithModal summary ("Frontal: Left, Right").
                          const componentsByGroup = new Map<string, string[]>();
                          for (const c of checkedComponents) {
                            const key = c.groupLabel || '';
                            const labels = componentsByGroup.get(key) ?? [];
                            labels.push(c.label);
                            componentsByGroup.set(key, labels);
                          }
                          const componentSummary = Array.from(componentsByGroup.entries())
                            .map(([g, labels]) => (g ? `${g}: ${labels.join(', ')}` : labels.join(', ')))
                            .join('; ');
                          const examLabel = (
                            <Typography variant="body2">
                              • {f.label ?? f.field}
                              {componentSummary ? ` — ${componentSummary}` : ''}
                              {f.note ? ` — ${f.note}` : ''}
                            </Typography>
                          );
                          return renderAiChartable(
                            'examObservations',
                            f,
                            examLabel,
                            <DeletableRow
                              key={f.field}
                              editable={editable}
                              resourceId={f.resourceId}
                              flashSx={itemSx(f.resourceId)}
                              onDelete={removeHandler('examObservations', f)}
                            >
                              {examLabel}
                            </DeletableRow>
                          );
                        })}
                      </Stack>
                    </Box>
                  ))}
                </Stack>
              </Box>
            )}
            {examWithNotes
              .filter((f) => !abnormalExam.find((a) => a.field === f.field))
              .map((f) => {
                const sectionLabel = FIELD_TO_SECTION_LABEL[f.field] ?? 'Exam';
                const noteLabel = (
                  <Typography variant="body2">
                    • {sectionLabel}{' '}
                    <Typography component="span" variant="body2" color="text.secondary">
                      (note)
                    </Typography>
                    : {f.note}
                  </Typography>
                );
                return renderAiChartable(
                  'examObservations',
                  f,
                  noteLabel,
                  <DeletableRow
                    key={f.field}
                    editable={editable}
                    resourceId={f.resourceId}
                    flashSx={itemSx(f.resourceId)}
                    onDelete={removeHandler('examObservations', f)}
                  >
                    {noteLabel}
                  </DeletableRow>,
                  onEditExamComment
                    ? {
                        value: f.note ?? '',
                        label: sectionLabel,
                        onSave: (newText: string) => onEditExamComment(f, newText),
                      }
                    : undefined
                );
              })}
          </Section>
        )}

        {/* Screening questions + ASQ + screening notes, after the exam area like Review & Sign. */}
        {showAdditionalQuestions && (
          <AdditionalQuestionsSection observations={data.observations} screeningNotes={screeningNotes} />
        )}

        {procedures.length > 0 && (
          <Section title="Procedures">
            <Stack spacing={1}>
              {procedures.map((p, i) => {
                // Which of THIS procedure's fields are still template-default (inferred) and awaiting
                // review. Editing or confirming a field drops it from this set.
                const procInferred = p.resourceId ? procedureProvenance?.get(p.resourceId)?.inferredFields : undefined;
                // The "default, verify" marker + per-field confirm ✓, shown after a field that was
                // pre-filled from the template. Editing the field also clears the flag (handled in save).
                const fieldMark = (field: keyof ProcedureDTO): JSX.Element | null => {
                  if (!p.resourceId || !procInferred?.has(field)) return null;
                  return (
                    <>
                      <Tooltip
                        title="Pre-filled from the procedure template — not from your dictation. Verify it reflects this visit."
                        placement="top"
                        arrow
                      >
                        <Box
                          component="span"
                          sx={{ ml: 0.75, color: 'warning.dark', fontStyle: 'italic', fontSize: 12, fontWeight: 600 }}
                        >
                          · default, verify
                        </Box>
                      </Tooltip>
                      <Tooltip title="Looks right — mark reviewed" placement="top" arrow>
                        <IconButton
                          size="small"
                          color="success"
                          aria-label="Confirm field"
                          sx={{ p: 0.25, ml: 0.25 }}
                          onClick={() => p.resourceId && onConfirmProcedureField?.(p.resourceId, field)}
                        >
                          <CheckIcon sx={{ fontSize: 15 }} />
                        </IconButton>
                      </Tooltip>
                    </>
                  );
                };
                // Inline-editable free-text field of THIS procedure. Hidden when empty + read-only;
                // shown as an "add…" affordance when editable. Saves the whole updated ProcedureDTO.
                const pf = (label: string, field: keyof ProcedureDTO, multiline?: boolean): JSX.Element | null => {
                  const allowed = procedureFieldAllowed?.get(field);
                  // Editing a field counts as reviewing it → drop its template-default flag.
                  const clearFlag = (): void => {
                    if (p.resourceId) onConfirmProcedureField?.(p.resourceId, field);
                  };
                  // technique is an array; suppliesUsed / postInstructions hold several comma-joined
                  // codes; the rest are single-valued.
                  const isMulti = field === 'technique' || field === 'suppliesUsed' || field === 'postInstructions';
                  const raw = p[field];
                  const selectedCodes: string[] =
                    field === 'technique'
                      ? Array.isArray(raw)
                        ? (raw as string[])
                        : []
                      : typeof raw === 'string' && raw
                      ? isMulti
                        ? raw
                            .split(',')
                            .map((s) => s.trim())
                            .filter(Boolean)
                        : [raw]
                      : [];
                  // Constrained field → dropdown of its value-set options (shows the friendly labels,
                  // stores the codes). Respects the allowed values instead of accepting free text.
                  if (allowed && allowed.size > 0) {
                    const displayText = selectedCodes.map((c) => allowed.get(c) ?? c).join(', ');
                    if (!editable && !displayText) return null;
                    const saveCodes = (codes: string[]): void => {
                      const nextVal: unknown =
                        field === 'technique' ? codes : isMulti ? codes.join(', ') : codes[0] ?? undefined;
                      void onSaveProcedure?.({ ...p, [field]: nextVal } as ProcedureDTO);
                      clearFlag();
                    };
                    return (
                      <Typography variant="body2" component="div">
                        <strong>{label}:</strong>{' '}
                        {editable && onSaveProcedure ? (
                          <InlineEnumField
                            selectedCodes={selectedCodes}
                            allowed={allowed}
                            multiple={isMulti}
                            onSave={saveCodes}
                          />
                        ) : (
                          displayText
                        )}
                        {fieldMark(field)}
                      </Typography>
                    );
                  }
                  // Free-text field.
                  const value = field === 'technique' ? selectedCodes.join(', ') : typeof raw === 'string' ? raw : '';
                  if (!editable && !value) return null;
                  const save = (v: string): void => {
                    const nextVal =
                      field === 'technique'
                        ? v
                            .split(',')
                            .map((s) => s.trim())
                            .filter(Boolean)
                        : v;
                    void onSaveProcedure?.({ ...p, [field]: nextVal } as ProcedureDTO);
                    clearFlag();
                  };
                  return (
                    <Typography variant="body2" component="div">
                      <strong>{label}:</strong>{' '}
                      {editable && onSaveProcedure ? (
                        <InlineEditableText value={value} multiline={multiline} onSave={save} />
                      ) : (
                        value
                      )}
                      {fieldMark(field)}
                    </Typography>
                  );
                };
                return (
                  <DeletableRow
                    key={p.resourceId ?? `${p.procedureType}-${i}`}
                    editable={editable}
                    resourceId={p.resourceId}
                    flashSx={itemSx(p.resourceId)}
                    onDelete={removeHandler('procedures', p)}
                  >
                    <Typography variant="body2" fontWeight={600}>
                      {formatProcedureType(p.procedureType) ?? '(unnamed procedure)'}
                    </Typography>
                    {p.resourceId && procInferred && procInferred.size > 0 && (
                      <Box
                        sx={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 1,
                          my: 0.5,
                          px: 1,
                          py: 0.5,
                          borderRadius: 1,
                          bgcolor: 'rgba(237,108,2,0.10)',
                          border: '1px solid',
                          borderColor: 'rgba(237,108,2,0.3)',
                        }}
                      >
                        <HelpOutlineIcon sx={{ fontSize: 16, color: 'warning.main' }} />
                        <Typography variant="caption" color="warning.dark" sx={{ flex: 1 }}>
                          Fields below were pre-filled from the “{formatProcedureType(p.procedureType) ?? 'procedure'}”
                          template, not your dictation — verify each, then confirm.
                        </Typography>
                        <Button
                          size="small"
                          variant="outlined"
                          color="warning"
                          sx={{ flexShrink: 0 }}
                          onClick={() => p.resourceId && onConfirmProcedure?.(p.resourceId)}
                        >
                          Confirm all
                        </Button>
                      </Box>
                    )}
                    {(p.cptCodes ?? []).length > 0 && (
                      <Typography variant="body2">
                        <strong>CPT:</strong> {p.cptCodes!.map((c) => `${c.code} ${c.display ?? ''}`.trim()).join('; ')}
                      </Typography>
                    )}
                    {(p.diagnoses ?? []).length > 0 && (
                      <Typography variant="body2">
                        <strong>Dx:</strong> {p.diagnoses!.map((d) => `${d.code} ${d.display ?? ''}`.trim()).join('; ')}
                      </Typography>
                    )}
                    {pf('Site', 'bodySite')}
                    {pf('Side', 'bodySide')}
                    {pf('Anesthesia / medication', 'medicationUsed')}
                    {pf('Technique', 'technique')}
                    {pf('Supplies', 'suppliesUsed')}
                    {pf('Details', 'procedureDetails', true)}
                    {pf('Complications', 'complications', true)}
                    {pf('Patient response', 'patientResponse', true)}
                    {pf('Post-procedure instructions', 'postInstructions', true)}
                    {pf('Time spent', 'timeSpent')}
                    {p.specimenSent !== undefined && (
                      <Typography variant="body2">
                        <strong>Specimen sent:</strong> {p.specimenSent ? 'Yes' : 'No'}
                      </Typography>
                    )}
                  </DeletableRow>
                );
              })}
            </Stack>
          </Section>
        )}

        {dx.length > 0 && (
          <Section title="Assessment / Diagnoses">
            <Stack spacing={0.25}>
              {dx.map((d, i) =>
                renderAiChartable(
                  'diagnosis',
                  d,
                  <Typography variant="body2">
                    <strong>{d.code}</strong> — {d.display}
                    {d.isPrimary && ' (primary)'}
                  </Typography>,
                  <DeletableRow
                    key={d.resourceId ?? `${d.code}-${i}`}
                    editable={editable}
                    resourceId={d.resourceId}
                    flashSx={itemSx(d.resourceId)}
                    onDelete={removeHandler('diagnosis', d)}
                  >
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Typography variant="body2">
                        <strong>{d.code}</strong> — {d.display}
                        {d.isPrimary && ' (primary)'}
                      </Typography>
                      {editable && onMakePrimary && !d.isPrimary && d.resourceId && (
                        <Button
                          size="small"
                          variant="text"
                          sx={{ minWidth: 0, p: 0, textTransform: 'none', fontSize: 12 }}
                          onClick={() => onMakePrimary(d)}
                        >
                          Make primary
                        </Button>
                      )}
                    </Box>
                  </DeletableRow>
                )
              )}
            </Stack>
          </Section>
        )}

        {(editable || mdm) && (
          <Section title="Medical Decision Making">
            {editable && onSaveField ? (
              <InlineNoteField
                label="Medical Decision Making"
                value={mdm ?? ''}
                minRows={3}
                onSave={(text) => onSaveField('medicalDecision', text)}
                sourceText={noteFieldMeta?.get('medicalDecision')?.sourceText}
                needsReview={noteFieldMeta?.get('medicalDecision')?.needsReview}
                reviewNote={noteFieldMeta?.get('medicalDecision')?.reason}
                onConfirm={() => onConfirmNoteField?.('medicalDecision')}
              />
            ) : (
              <Typography
                variant="body2"
                data-easy-chart-id={data.medicalDecision?.resourceId}
                sx={{
                  whiteSpace: 'pre-wrap',
                  ...(itemSx(data.medicalDecision?.resourceId) ?? {}),
                }}
              >
                {mdm}
              </Typography>
            )}
          </Section>
        )}

        {emCode && (
          <Section title="E&M Code">
            {renderAiChartable(
              'emCode',
              emCode,
              <Typography variant="body2">
                <strong>{emCode.code}</strong>
                {emCode.display ? ` — ${emCode.display}` : ''}
              </Typography>,
              <DeletableRow
                editable={editable}
                resourceId={emCode.resourceId}
                flashSx={itemSx(emCode.resourceId)}
                onDelete={removeHandler('emCode', emCode)}
              >
                <Typography variant="body2">
                  <strong>{emCode.code}</strong>
                  {emCode.display ? ` — ${emCode.display}` : ''}
                </Typography>
              </DeletableRow>
            )}
          </Section>
        )}

        {cptCodes.length > 0 && (
          <Section title="CPT Codes">
            <Stack spacing={0.25}>
              {cptCodes.map((c, i) =>
                renderAiChartable(
                  'cptCodes',
                  c,
                  <Typography variant="body2">
                    <strong>{c.code}</strong>
                    {c.display ? ` — ${c.display}` : ''}
                  </Typography>,
                  <DeletableRow
                    key={c.resourceId ?? `${c.code}-${i}`}
                    editable={editable}
                    resourceId={c.resourceId}
                    flashSx={itemSx(c.resourceId)}
                    onDelete={removeHandler('cptCodes', c)}
                  >
                    <Typography variant="body2">
                      <strong>{c.code}</strong>
                      {c.display ? ` — ${c.display}` : ''}
                    </Typography>
                  </DeletableRow>
                )
              )}
            </Stack>
          </Section>
        )}

        {labOrders && labOrders.length > 0 && (
          <Section title="Labs ordered">
            <Stack spacing={0.25}>
              {labOrders.map((o) => (
                <DeletableRow
                  key={o.serviceRequestId}
                  editable={editable}
                  resourceId={o.serviceRequestId}
                  flashSx={itemSx(o.serviceRequestId)}
                  onDelete={editable && onRemoveLabOrder ? () => onRemoveLabOrder(o) : undefined}
                >
                  <Typography variant="body2">
                    • {o.testName}
                    <Typography component="span" variant="caption" color="text.secondary">
                      {' '}
                      — {o.kind === 'in-house' ? 'in-house' : o.labName ?? 'send-out'}
                      {o.status ? ` · ${o.status}` : ''}
                    </Typography>
                  </Typography>
                </DeletableRow>
              ))}
            </Stack>
          </Section>
        )}

        {/* Lab RESULTS (what came back), separate from the orders above — same test can appear in
            both, like Review & Sign. Read-only: results are documents, not editable chart items. */}
        {showLabResults && (
          <Section title="Lab Results">
            <LabResultsList inHouse={data.inHouseLabResults} external={data.externalLabResults} />
          </Section>
        )}

        {/* Radiology after Lab Results, mirroring Review & Sign's results ordering. Read-only. */}
        {radiologyOrders.length > 0 && <RadiologySection radiologyOrders={radiologyOrders} />}

        {/* eRx prescriptions before Patient Instructions, mirroring Review & Sign's ordering.
            Display-only — prescribing happens in the regular chart. */}
        {prescribedMedications.length > 0 && <PrescriptionsSection prescriptions={prescribedMedications} />}

        {instructions.length > 0 && (
          <CollapsibleSection title={`Patient Instructions (${instructions.length})`}>
            <Stack spacing={0.5}>
              {instructions.map((c, i) => (
                <ReviewableInstructionLine
                  key={c.resourceId ?? i}
                  title={c.title}
                  text={c.text ?? ''}
                  needsReview={c.resourceId ? instructionMeta?.get(c.resourceId)?.needsReview : false}
                  reason={c.resourceId ? instructionMeta?.get(c.resourceId)?.reason : undefined}
                  onConfirm={c.resourceId ? () => onConfirmInstruction?.(c.resourceId as string) : undefined}
                />
              ))}
            </Stack>
          </CollapsibleSection>
        )}

        {/* School/work excuses next to Patient Instructions, matching Review & Sign's Plan block. */}
        {schoolWorkNotes.length > 0 && <SchoolWorkExcuseSection schoolWorkNotes={schoolWorkNotes} />}

        {/* Disposition after Patient Instructions, matching Review & Sign's Plan ordering.
            Display-only — the assistant edits it via chat. */}
        {disposition?.type && <DispositionSection disposition={disposition} />}

        {/* Static privacy-policy acknowledgement at the very bottom, like Review & Sign. */}
        <PrivacyPolicyLine appointmentStart={appointmentStart} />

        {/* Addenda AFTER the privacy line, like Review & Sign's AddendumCard. Read-only here —
            addenda are added/edited in the regular chart. */}
        {showAddendum && <AddendumSection notes={addendumNotes} legacyText={legacyAddendumText} />}
      </Stack>
    </Paper>
  );
}
