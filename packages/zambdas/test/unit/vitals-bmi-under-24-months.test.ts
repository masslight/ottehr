import { Appointment, Patient } from 'fhir/r4b';
import { VitalFieldNames } from 'utils/lib/types/api/chart-data/chart-data.constants';
import { VitalsObservationDTO } from 'utils/lib/types/api/chart-data/chart-data.types';
import { GetChartDataResponse } from 'utils/lib/types/api/chart-data/get-chart-data.types';
import { describe, expect, it } from 'vitest';
import { progressNoteDataToText } from '../../src/shared/pdf/progress-note-text';
import { composeVitals } from '../../src/shared/pdf/sections/visit-note/vitals';
import { ProgressNoteData, ProgressNoteVisitDataInput } from '../../src/shared/pdf/types';

const visitStart = '2026-11-20T14:00:00.000Z';

const readings = [
  { field: VitalFieldNames.VitalWeight, value: 8.25, lastUpdated: visitStart },
  { field: VitalFieldNames.VitalHeight, value: 68, lastUpdated: visitStart },
  { field: VitalFieldNames.VitalBMI, value: 17.8, lastUpdated: visitStart },
] as VitalsObservationDTO[];

const noteVitals = (birthDate: string | undefined): ReturnType<typeof composeVitals> =>
  composeVitals({
    allChartData: {
      chartData: { patientId: 'patient-1' } as GetChartDataResponse,
      additionalChartData: { patientId: 'patient-1', vitalsObservations: readings } as GetChartDataResponse,
    },
    appointmentPackage: {
      timezone: 'America/New_York',
      patient: { resourceType: 'Patient', birthDate } as Patient,
      appointment: { resourceType: 'Appointment', start: visitStart } as Appointment,
    },
  } as ProgressNoteVisitDataInput);

describe('visit note PDF — BMI under 24 months', () => {
  it('leaves out a BMI saved for a visit when the patient was under 24 months, in the PDF and the AI review', () => {
    const { vitals } = noteVitals('2025-03-01');

    expect(vitals?.[VitalFieldNames.VitalBMI]).toBeUndefined();
    expect(vitals?.[VitalFieldNames.VitalWeight]).toEqual([expect.stringMatching(/ - 8\.25 kg ≈ 18\.19 lbs$/)]);
    expect(progressNoteDataToText({ vitals } as ProgressNoteData)).not.toMatch(/BMI/);
  });

  it('keeps it from 24 months at the visit, and when the birth date is unknown', () => {
    expect(noteVitals('2024-11-20').vitals?.[VitalFieldNames.VitalBMI]).toEqual([
      expect.stringMatching(/17\.8 kg\/m2$/),
    ]);
    expect(noteVitals(undefined).vitals?.[VitalFieldNames.VitalBMI]).toHaveLength(1);
  });
});
