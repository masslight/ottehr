import Oystehr from '@oystehr/sdk';
import { Encounter, Patient } from 'fhir/r4b';
import { DateTime } from 'luxon';
import { forecastImmunizations } from 'utils/lib/immunization-forecast/engine';
import { buildForecastInput, isoDateOf } from 'utils/lib/immunization-forecast/forecast-input';
import {
  ForecastPatientSex,
  ImmunizationForecast,
  ImmunizationForecastInput,
} from 'utils/lib/immunization-forecast/types';
import { GetPatientImmunizationsResponse } from 'utils/lib/types/data/immunization/types';
import { FHIR_RESOURCE_NOT_FOUND, INVALID_INPUT_ERROR } from 'utils/lib/types/errors';
import { buildPatientImmunizationsResponse, searchPatientImmunizations } from './records';

/** The patient's records and the engine's result for them, as the forecast endpoint and the record PDF read them. */
export interface PatientForecast {
  patient: Patient;
  records: GetPatientImmunizationsResponse;
  forecast: ImmunizationForecast;
  /** What the engine was run on, so a caller can run it again (the timeline's later doses). */
  input: ImmunizationForecastInput;
}

/** The CDSi assessment date: the visit's day (in the visit's zone) when it has started, otherwise today. */
export const assessmentDate = (encounter: Encounter | undefined, now: DateTime, timezone?: string): string =>
  (encounter?.period?.start && isoDateOf(encounter.period.start, timezone)) ?? now.toISODate()!;

/**
 * Reads the patient and their Immunization records and runs the engine; the queries are fixed, the id their input.
 * Dose dates become calendar days in `timezone` (the visit's location) when it is known.
 */
export async function loadPatientForecast(
  oystehr: Oystehr,
  patientId: string,
  asOf: string,
  timezone?: string
): Promise<PatientForecast> {
  let patient: Patient;
  try {
    patient = await oystehr.fhir.get<Patient>({ resourceType: 'Patient', id: patientId });
  } catch (error) {
    console.error('Failed to read the patient to forecast:', error);
    throw FHIR_RESOURCE_NOT_FOUND('Patient');
  }
  if (!patient.birthDate) throw INVALID_INPUT_ERROR('The patient has no date of birth to forecast from');
  const records = buildPatientImmunizationsResponse(await searchPatientImmunizations(oystehr, patientId));
  const input = buildForecastInput(
    { dob: patient.birthDate, sex: patient.gender as ForecastPatientSex | undefined, asOf },
    records.immunizations,
    records.marks,
    timezone
  );
  return { patient, records, forecast: forecastImmunizations(input), input };
}
