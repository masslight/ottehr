import { Practitioner } from 'fhir/r4b';
import { ObservationDTO } from '../../data/screening-questions/types';
import {
  AccidentDTO,
  AIChatDetails,
  AllergyDTO,
  BirthHistoryDTO,
  BooleanValueDTO,
  ClinicalImpressionDTO,
  CommunicationDTO,
  CPTCodeDTO,
  DiagnosisDTO,
  DispositionDTO,
  ExamObservationDTO,
  FreeTextNoteDTO,
  HospitalizationDTO,
  MedicalConditionDTO,
  MedicationDTO,
  NOTE_TYPE,
  NoteDTO,
  PharmacyDTO,
  PrescribedMedicationDTO,
  ProcedureDTO,
  SchoolWorkNoteExcuseDocFileDTO,
} from './chart-data.types';
import { GetChartDataResponse } from './get-chart-data.types';

/**
 * The chart is read in sections. Each section is a fixed set of fields whose FHIR searches live on the
 * server (packages/zambdas/src/shared/chart-sections); the client asks for a section by name and nothing
 * else. A section is the unit of caching and of invalidation on the client.
 */
export const CHART_SECTIONS = [
  'encounterNotes',
  'history',
  'screening',
  'exam',
  'assessment',
  'plan',
  'notes',
  'aiChat',
] as const;

export type ChartSection = (typeof CHART_SECTIONS)[number];

export const isChartSection = (value: unknown): value is ChartSection =>
  typeof value === 'string' && (CHART_SECTIONS as readonly string[]).includes(value);

/** Encounter-scoped free text and flags: everything documented as a single value on this visit. */
export interface EncounterNotesSectionData {
  reasonForVisit?: FreeTextNoteDTO;
  /** Legacy tagging: the HPI text is stored under the chief-complaint tag. */
  chiefComplaint?: FreeTextNoteDTO;
  /** Legacy tagging: the chief complaint / additional information text is stored under the HPI tag. */
  historyOfPresentIllness?: FreeTextNoteDTO;
  mechanismOfInjury?: FreeTextNoteDTO;
  ros?: FreeTextNoteDTO;
  accident?: AccidentDTO;
  surgicalHistoryNote?: FreeTextNoteDTO;
  medicalDecision?: ClinicalImpressionDTO;
  /** Legacy single-string addendum kept on the Encounter; per-author addenda are notes. */
  addendumNote?: FreeTextNoteDTO;
  patientInfoConfirmed?: BooleanValueDTO;
  addToVisitNote?: BooleanValueDTO;
}

/** Patient-level history, shared across the patient's encounters. */
export interface HistorySectionData {
  allergies: AllergyDTO[];
  conditions: MedicalConditionDTO[];
  /** Current and prescribed medication statements; `type` tells them apart. */
  medications: MedicationDTO[];
  inhouseMedications: MedicationDTO[];
  surgicalHistory: CPTCodeDTO[];
  episodeOfCare: HospitalizationDTO[];
  birthHistory: BirthHistoryDTO[];
  /** The practitioners the medication statements' informationSource references resolve to. */
  practitioners: Practitioner[];
}

export interface ScreeningSectionData {
  observations: ObservationDTO[];
}

export interface ExamSectionData {
  examObservations: ExamObservationDTO[];
  rosObservations: ExamObservationDTO[];
}

export interface AssessmentSectionData {
  diagnosis: DiagnosisDTO[];
  cptCodes: CPTCodeDTO[];
  emCode?: CPTCodeDTO;
  procedures: ProcedureDTO[];
}

export interface PlanSectionData {
  disposition?: DispositionDTO;
  instructions: CommunicationDTO[];
  schoolWorkNotes: SchoolWorkNoteExcuseDocFileDTO[];
  prescribedMedications: PrescribedMedicationDTO[];
  preferredPharmacies: PharmacyDTO[];
  /** The practitioners the prescriptions' requester references resolve to. */
  practitioners: Practitioner[];
}

export interface NotesSectionData {
  notes: NoteDTO[];
}

export interface AiChatSectionData {
  aiChat: AIChatDetails;
  /** The AI suggestion Observations. */
  observations: ObservationDTO[];
}

export interface ChartSectionDataMap {
  encounterNotes: EncounterNotesSectionData;
  history: HistorySectionData;
  screening: ScreeningSectionData;
  exam: ExamSectionData;
  assessment: AssessmentSectionData;
  plan: PlanSectionData;
  notes: NotesSectionData;
  aiChat: AiChatSectionData;
}

export type ChartSectionData<S extends ChartSection = ChartSection> = ChartSectionDataMap[S];

export interface NotesSectionParams {
  types: NOTE_TYPE[];
}

export interface HistorySectionParams {
  /** Page size for the current-medication search; defaults to the server's page size. */
  medicationCount?: number;
}

export interface ChartSectionParamsMap {
  encounterNotes: undefined;
  history: HistorySectionParams | undefined;
  screening: undefined;
  exam: undefined;
  assessment: undefined;
  plan: undefined;
  notes: NotesSectionParams;
  aiChat: undefined;
}

export type ChartSectionParams<S extends ChartSection = ChartSection> = ChartSectionParamsMap[S];

export type GetChartSectionRequest<S extends ChartSection = ChartSection> = {
  encounterId: string;
  section: S;
} & (ChartSectionParamsMap[S] extends undefined ? { params?: undefined } : { params: ChartSectionParamsMap[S] });

export interface GetChartSectionResponse<S extends ChartSection = ChartSection> {
  section: S;
  data: ChartSectionData<S>;
}

/**
 * Note types are scoped per type on the server: the visit-specific lists (intake, internal, addendum) are
 * read for this encounter only; the history-style types are read across all of the patient's encounters,
 * which is how the progress note has always shown them.
 */
export const ENCOUNTER_SCOPED_NOTE_TYPES: readonly NOTE_TYPE[] = [
  NOTE_TYPE.INTAKE,
  NOTE_TYPE.INTERNAL,
  NOTE_TYPE.ADDENDUM,
];

/**
 * Which section each saveable chart field lives in. save-chart-data and delete-chart-data request bodies are
 * keyed by these fields, so a mutation knows exactly which section caches to refresh.
 */
export const FIELD_TO_SECTION: Partial<Record<keyof GetChartDataResponse, ChartSection>> = {
  reasonForVisit: 'encounterNotes',
  chiefComplaint: 'encounterNotes',
  historyOfPresentIllness: 'encounterNotes',
  mechanismOfInjury: 'encounterNotes',
  ros: 'encounterNotes',
  accident: 'encounterNotes',
  surgicalHistoryNote: 'encounterNotes',
  medicalDecision: 'encounterNotes',
  addendumNote: 'encounterNotes',
  patientInfoConfirmed: 'encounterNotes',
  addToVisitNote: 'encounterNotes',
  allergies: 'history',
  conditions: 'history',
  medications: 'history',
  inhouseMedications: 'history',
  surgicalHistory: 'history',
  episodeOfCare: 'history',
  birthHistory: 'history',
  observations: 'screening',
  examObservations: 'exam',
  rosObservations: 'exam',
  diagnosis: 'assessment',
  cptCodes: 'assessment',
  emCode: 'assessment',
  procedures: 'assessment',
  disposition: 'plan',
  instructions: 'plan',
  schoolWorkNotes: 'plan',
  prescribedMedications: 'plan',
  preferredPharmacies: 'plan',
  notes: 'notes',
  aiChat: 'aiChat',
};
