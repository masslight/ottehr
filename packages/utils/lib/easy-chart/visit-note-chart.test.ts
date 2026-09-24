import { describe, expect, it } from 'vitest';
import { MedicationDTO, ProcedureDTO } from '../types/api/chart-data/chart-data.types';
import { VisitNoteResponse } from '../types/api/chart-data/get-visit-note.types';
import { wholeChartFromVisitNote } from './visit-note-chart';

const emptyNote = (): VisitNoteResponse => ({
  patientId: 'p-1',
  encounterNotes: {},
  history: {
    allergies: [],
    conditions: [],
    medications: [],
    inhouseMedications: [],
    surgicalHistory: [],
    episodeOfCare: [],
    birthHistory: [],
    medicationsInformationSourcePractitioners: [],
  },
  screening: { observations: [] },
  exam: { examObservations: [], rosObservations: [] },
  assessment: { diagnosis: [], cptCodes: [], procedures: [] },
  plan: {
    instructions: [],
    schoolWorkNotes: [],
    prescribedMedications: [],
    preferredPharmacies: [],
    prescribedMedicationsRequesterPractitioners: [],
  },
  notes: { notes: [] },
  aiChat: { aiChat: { documents: [], providers: [] }, observations: [] },
  vitalsObservations: [],
  externalLabResults: { resultsPending: [], labOrderResults: [] },
  inHouseLabResults: { resultsPending: [], reflexTestsPending: undefined, labOrderResults: [] },
  radiologyOrders: [],
  practitioners: [],
  patientHasPreviousVisits: false,
});

const medication = (partial: Partial<MedicationDTO>): MedicationDTO =>
  ({ status: 'active', intakeInfo: {}, type: 'as-needed', ...partial }) as MedicationDTO;

describe('wholeChartFromVisitNote', () => {
  it('carries the whole-chart lists and the progress-note fields in one object', () => {
    const note = emptyNote();
    note.assessment.diagnosis = [
      { resourceId: 'dx-1', code: 'J01.00', display: 'Acute maxillary sinusitis', isPrimary: true },
    ];
    note.encounterNotes.chiefComplaint = { resourceId: 'cc-1', text: 'Sinus pressure x 1 week.' };
    note.encounterNotes.medicalDecision = { resourceId: 'mdm-1', text: 'Likely viral.' };
    note.history.episodeOfCare = [{ resourceId: 'h-1', code: 'X', display: 'Appendectomy stay' }];
    note.vitalsObservations = [{ resourceId: 'v-1', field: 'vital-weight', value: 70 } as never];

    const chart = wholeChartFromVisitNote(note);

    expect(chart.patientId).toBe('p-1');
    expect(chart.diagnosis?.map((dx) => dx.code)).toEqual(['J01.00']);
    // The progress-note fields the old default read never carried.
    expect(chart.chiefComplaint?.text).toBe('Sinus pressure x 1 week.');
    expect(chart.medicalDecision?.text).toBe('Likely viral.');
    expect(chart.episodeOfCare?.map((stay) => stay.resourceId)).toEqual(['h-1']);
    expect(chart.vitalsObservations).toHaveLength(1);
  });

  it('does not blank a whole-chart field the progress-note shape leaves undefined', () => {
    const note = emptyNote();
    note.assessment.procedures = [{ resourceId: 'pr-1', procedureType: 'Laceration repair' } as ProcedureDTO];

    // `additionalChartData.procedures` is undefined by construction; a plain spread would erase the row.
    expect(wholeChartFromVisitNote(note).procedures?.map((row) => row.resourceId)).toEqual(['pr-1']);
  });

  it('lists current medications apart from the prescriptions', () => {
    const note = emptyNote();
    note.history.medications = [
      medication({ resourceId: 'm-1', name: 'Ibuprofen' }),
      medication({ resourceId: 'm-2', name: 'Amoxicillin', type: 'prescribed-medication' }),
    ];
    note.plan.prescribedMedications = [{ resourceId: 'rx-1', name: 'Amoxicillin' } as never];

    const chart = wholeChartFromVisitNote(note);

    expect(chart.medications?.map((row) => row.name)).toEqual(['Ibuprofen']);
    expect(chart.prescribedMedications?.map((row) => row.resourceId)).toEqual(['rx-1']);
  });
});
