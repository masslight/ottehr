import { VisitNoteResponse } from 'utils/lib/types/api/chart-data/get-visit-note.types';

/** A visit note with every section present and empty; spread a section over it to describe a chart. */
export const emptyVisitNote = (overrides: Partial<VisitNoteResponse> = {}): VisitNoteResponse =>
  ({
    patientId: 'patient-1',
    encounterNotes: { reasonForVisit: { text: '' } },
    history: {
      allergies: [],
      conditions: [],
      medications: [],
      inhouseMedications: [],
      surgicalHistory: [],
      episodeOfCare: [],
      birthHistory: [],
      practitioners: [],
    },
    screening: { observations: [] },
    exam: { examObservations: [], rosObservations: [] },
    assessment: { diagnosis: [], cptCodes: [], procedures: [] },
    plan: {
      instructions: [],
      schoolWorkNotes: [],
      prescribedMedications: [],
      preferredPharmacies: [],
      practitioners: [],
    },
    notes: { notes: [] },
    aiChat: { aiChat: { documents: [], providers: [] }, observations: [] },
    vitalsObservations: [],
    externalLabResults: { labOrderResults: [] },
    inHouseLabResults: { labOrderResults: [] },
    radiologyOrders: [],
    practitioners: [],
    patientHasPreviousVisits: false,
    ...overrides,
  }) as unknown as VisitNoteResponse;
