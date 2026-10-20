import { Practitioner } from 'fhir/r4b';
import { EncounterExternalLabResult, EncounterInHouseLabResult } from '../lab';
import { RadiologyDTO } from '../radiology';
import { VitalsObservationDTO } from './chart-data.types';
import {
  AiChatSectionData,
  AssessmentSectionData,
  EncounterNotesSectionData,
  ExamSectionData,
  HistorySectionData,
  NotesSectionData,
  PlanSectionData,
  ScreeningSectionData,
} from './chart-sections.types';

export interface GetVisitNoteRequest {
  encounterId: string;
}

/**
 * Everything the visit note (Review & Sign, the follow-up note, the visit note PDF and the discharge
 * summary) shows, in one read: every chart section plus the parts of the note that have endpoints of
 * their own on the individual screens.
 */
export interface VisitNoteResponse {
  patientId: string;
  encounterNotes: EncounterNotesSectionData;
  history: HistorySectionData;
  screening: ScreeningSectionData;
  exam: ExamSectionData;
  assessment: AssessmentSectionData;
  plan: PlanSectionData;
  /** The note types the visit note shows, scoped per type like the notes section. */
  notes: NotesSectionData;
  aiChat: AiChatSectionData;
  vitalsObservations: VitalsObservationDTO[];
  externalLabResults: EncounterExternalLabResult;
  inHouseLabResults: EncounterInHouseLabResult;
  radiologyOrders: RadiologyDTO[];
  /** The encounter's participating practitioners. */
  practitioners: Practitioner[];
  patientHasPreviousVisits: boolean;
}
