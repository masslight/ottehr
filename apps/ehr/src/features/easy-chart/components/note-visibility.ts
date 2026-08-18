// WHICH SECTIONS THE NOTE SHOWS, as data rather than as conditions scattered through the JSX.
//
// The default rule is that a section renders only when it has content: the note reads as a clinical
// document, and an empty heading is noise. There are exactly two kinds of exception, and both exist for
// a reason that is easy to lose:
//
//   1. The privacy-policy line is unconditional — it is a static attestation, not content.
//   2. The four free-text fields and Vitals render WHILE EMPTY when the pane is editable, because a
//      section you cannot see is a section you cannot type into. Collapse those into the default rule
//      and a provider can no longer write an HPI by hand on an empty chart.
//
// It lives here, computed once, so the rendering cannot disagree with the rule. A condition inlined at
// the call site is a condition no test can read, and the ways this breaks are all silent: a section
// with a note and no items disappears, taking the note with it.
//
// NOTES COUNT AS CONTENT. Several sections keep a per-section free-text note that can exist with no
// structured items at all — allergies, medications, hospitalizations, in-house medications, vitals,
// surgical history. Keying their visibility off the item count alone hides the note.

import {
  formatScreeningQuestionWithNote,
  shouldDisplayScreeningQuestion,
} from 'utils/lib/helpers/screening-questions/screening-questions-formatting.helper';
import { patientScreeningQuestionsConfig } from 'utils/lib/ottehr-config/screening-questions';
import { ASQ_FIELD } from 'utils/lib/types/api/chart-data/chart-data.constants';
import { NOTE_TYPE, NoteDTO } from 'utils/lib/types/api/chart-data/chart-data.types';
import { GetChartDataResponse } from 'utils/lib/types/api/chart-data/get-chart-data.types';
import { ObservationDTO } from 'utils/lib/types/data/screening-questions/types';

/** Everything the visibility rules need that is not chart data. */
export interface SectionVisibilityInput {
  chartData: GetChartDataResponse | undefined;
  /** The provider can type into the note — the four free-text fields then render while empty. */
  editable: boolean;
  /** A vitals save handler is actually wired, which is Vitals' only reason to render while empty. */
  canSaveVital: boolean;
  /** MAR administrations for THIS encounter, which are not chart data. */
  inHouseMedications: unknown[];
  /** Administered immunizations for this encounter, also a separate query. */
  immunizations: unknown[];
  /** In-house + send-out orders for this encounter, also a separate query. */
  labOrders: unknown[];
}

/** Section id → whether it renders. Keys are the ids in note-section-manifest.ts. */
export type SectionVisibility = Record<string, boolean>;

export function computeSectionVisibility(input: SectionVisibilityInput): SectionVisibility {
  const { chartData, editable, canSaveVital } = input;
  const notesOfType = (type: NOTE_TYPE): NoteDTO[] => (chartData?.notes ?? []).filter((note) => note.type === type);
  const filled = (text: string | undefined): boolean => Boolean(text?.trim());

  const examObservations = chartData?.examObservations ?? [];
  // A ticked exam finding is content whether it is normal or abnormal: the progress note renders both,
  // and the exam's documented normals are part of what supports the visit level. Anything carrying a
  // note is content too, even unticked — the note is the provider's own words.
  const tickedExam = examObservations.filter((finding) => finding.value === true);
  const examWithNotes = examObservations.filter((finding) => filled(finding.note));
  const positiveRos = (chartData?.rosObservations ?? []).filter((finding) => finding.value === true);

  const vitals = chartData?.vitalsObservations ?? [];

  return {
    allergies: (chartData?.allergies?.length ?? 0) > 0 || notesOfType(NOTE_TYPE.ALLERGY).length > 0,
    'intake-medications':
      (chartData?.medications?.length ?? 0) > 0 || notesOfType(NOTE_TYPE.INTAKE_MEDICATION).length > 0,
    'medical-history': (chartData?.conditions?.length ?? 0) > 0,
    // The item count AND the standalone `surgicalHistoryNote`. The note is a chart field of its own and
    // is rendered in this section, so keying off the item count alone would make a provider's written
    // "no prior surgeries per patient" invisible.
    'surgical-history':
      (chartData?.surgicalHistory?.length ?? 0) > 0 ||
      notesOfType(NOTE_TYPE.SURGICAL_HISTORY).length > 0 ||
      filled(chartData?.surgicalHistoryNote?.text),
    hospitalizations: (chartData?.episodeOfCare?.length ?? 0) > 0 || notesOfType(NOTE_TYPE.HOSPITALIZATION).length > 0,
    'in-house-medications': input.inHouseMedications.length > 0 || notesOfType(NOTE_TYPE.MEDICATION).length > 0,
    immunization: input.immunizations.length > 0,

    // The four editable free-text fields. `editable ||` is what makes "every free-text section is
    // directly editable, like a normal document" true.
    'chief-complaint': editable || filled(chartData?.chiefComplaint?.text),
    hpi: editable || filled(chartData?.historyOfPresentIllness?.text),
    'mechanism-of-injury': editable || filled(chartData?.mechanismOfInjury?.text),
    mdm: editable || filled(chartData?.medicalDecision?.text),

    // Positive findings only — a recorded "denies" is not something the ROS section states. The legacy
    // free-text `ros` field is its own condition and renders read-only inside the same section.
    ros: positiveRos.length > 0 || filled(chartData?.ros?.text),
    'ros-legacy': filled(chartData?.ros?.text),

    // Narrower than the free-text four: Vitals' reason to exist while empty is the quick-add chips, so
    // it appears empty only when a save handler is really wired.
    vitals: vitals.length > 0 || notesOfType(NOTE_TYPE.VITALS).length > 0 || (editable && canSaveVital),

    examination: tickedExam.length > 0 || examWithNotes.length > 0,
    'additional-questions': hasAdditionalQuestions(chartData?.observations, notesOfType(NOTE_TYPE.SCREENING)),

    procedures: (chartData?.procedures?.length ?? 0) > 0,
    assessment: (chartData?.diagnosis?.length ?? 0) > 0,
    // Content, or an editable note — the level is REQUIRED to sign, and the dropdown is how it gets set.
    // Hiding the section on a chart with no level would leave the one thing blocking the signature with
    // nowhere to fix it.
    'em-code': Boolean(chartData?.emCode?.code) || editable,
    'cpt-codes': (chartData?.cptCodes?.length ?? 0) > 0,

    // Orders and results are two sections, in that order. The same test legitimately appears in both:
    // one says it was ordered, the other says what came back.
    'labs-ordered': input.labOrders.length > 0,
    'lab-results': hasLabResultsToShow(chartData),

    radiology: (chartData?.radiologyOrders?.length ?? 0) > 0,
    prescriptions: (chartData?.prescribedMedications?.length ?? 0) > 0,
    'patient-instructions': (chartData?.instructions?.length ?? 0) > 0,
    'school-work-excuse': (chartData?.schoolWorkNotes?.length ?? 0) > 0,
    disposition: Boolean(chartData?.disposition?.type),

    // The one unconditional section: a static attestation rather than content.
    'privacy-policy': true,

    // Content, or a SIGNED visit. The addendum card is the one thing a provider may still write to after
    // signing, so hiding it when empty would leave nowhere to write the first addendum — the same reason
    // the free-text fields render empty while editable, at the opposite end of the visit. Before signing
    // an empty addendum heading is just noise.
    addendum: hasAddendaToShow(notesOfType(NOTE_TYPE.ADDENDUM), chartData?.addendumNote?.text) || !editable,
  };
}

/** Screening rows in config order, with the same selection and formatting Review & Sign applies. */
export function buildScreeningQuestionRows(observations: ObservationDTO[] | undefined): { id: string; text: string }[] {
  return patientScreeningQuestionsConfig.fields.flatMap((field) => {
    const observation = observations?.find((obs) => obs.field === field.fhirField);
    if (!observation || !shouldDisplayScreeningQuestion((observation as { value?: unknown }).value)) return [];
    const formatted = formatScreeningQuestionWithNote(field.fhirField, observation);
    if (!formatted) return [];
    return [{ id: field.id, text: `${field.question} - ${formatted}` }];
  });
}

/** Any answered screening question, an ASQ status, or a screening note. */
export function hasAdditionalQuestions(
  observations: ObservationDTO[] | undefined,
  screeningNotes: NoteDTO[] | undefined
): boolean {
  return (
    buildScreeningQuestionRows(observations).length > 0 ||
    observations?.some((observation) => observation.field === ASQ_FIELD) === true ||
    (screeningNotes?.length ?? 0) > 0
  );
}

/**
 * A pending result counts. A note silent about a result that has not come back reads as complete when
 * it is not, and a pending result blocks signing.
 */
export function hasLabResultsToShow(chartData: GetChartDataResponse | undefined): boolean {
  const has = (results?: { labOrderResults?: unknown[]; resultsPending?: string[] }): boolean =>
    Boolean(results) && ((results!.labOrderResults?.length ?? 0) > 0 || (results!.resultsPending?.length ?? 0) > 0);
  return has(chartData?.inHouseLabResults) || has(chartData?.externalLabResults);
}

/** Soft-deleted addenda are tombstones, never shown. */
export const visibleAddenda = (notes: NoteDTO[]): NoteDTO[] => notes.filter((note) => !note.deleted);

export function hasAddendaToShow(notes: NoteDTO[], legacyText?: string): boolean {
  return visibleAddenda(notes).length > 0 || Boolean(legacyText?.trim());
}
