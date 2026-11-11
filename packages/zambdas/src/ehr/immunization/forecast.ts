import Oystehr from '@oystehr/sdk';
import { Encounter, Patient } from 'fhir/r4b';
import { DateTime } from 'luxon';
import { forecastImmunizations } from 'utils/lib/immunization-forecast/engine';
import { FORECAST_GROUP_IDS } from 'utils/lib/immunization-forecast/groups';
import {
  ForecastDoseInput,
  ForecastMarkInput,
  ForecastPatientSex,
  ImmunizationForecast,
  ImmunizationForecastInput,
  ImmunizationGroupId,
  ImmunizationReportOrigin,
} from 'utils/lib/immunization-forecast/types';
import { GetPatientImmunizationsResponse } from 'utils/lib/types/data/immunization/types';
import { FHIR_RESOURCE_NOT_FOUND, INVALID_INPUT_ERROR } from 'utils/lib/types/errors';
import { buildPatientImmunizationsResponse, searchPatientImmunizations } from './records';

/** The patient's records and the engine's result for them, as the forecast endpoint and the record PDF read them. */
export interface PatientForecast {
  patient: Patient;
  records: GetPatientImmunizationsResponse;
  forecast: ImmunizationForecast;
}

/** The calendar date of a date-time: in `timezone` when known, else in the offset the value carries. */
export const isoDateOf = (value: string, timezone?: string): string | undefined => {
  const parsed = DateTime.fromISO(value, { setZone: true });
  if (!parsed.isValid) return undefined;
  return (timezone ? parsed.setZone(timezone) : parsed).toISODate() ?? undefined;
};

/** The CDSi assessment date: the visit's day when it has started, otherwise today. */
export const assessmentDate = (encounter: Encounter | undefined, now: DateTime, timezone?: string): string =>
  (encounter?.period?.start && isoDateOf(encounter.period.start, timezone)) ?? now.toISODate()!;

/**
 * The engine's input from the patient's records: doses with a CVX as dated ISO days (undated ones stay undated and
 * are shown but not counted), and the active mark of each group (the records come newest first).
 */
export function toForecastInput(
  patient: Patient,
  records: GetPatientImmunizationsResponse,
  asOf: string,
  timezone?: string
): ImmunizationForecastInput {
  if (!patient.birthDate) throw INVALID_INPUT_ERROR('The patient has no date of birth to forecast from');
  const doses: ForecastDoseInput[] = records.immunizations.flatMap((record) => {
    if (!record.cvx) return [];
    return [
      {
        id: record.id,
        cvx: record.cvx,
        date: record.dateGiven ? isoDateOf(record.dateGiven, timezone) ?? null : null,
        source: record.outside ? 'outside' : 'administered',
        ...(record.outside && record.sourceCode && { outsideSource: record.sourceCode as ImmunizationReportOrigin }),
      },
    ];
  });
  const marks: Partial<Record<ImmunizationGroupId, ForecastMarkInput>> = {};
  for (const mark of records.marks) {
    const group = mark.vaccineGroup.code as ImmunizationGroupId;
    if (mark.cleared || marks[group] || !FORECAST_GROUP_IDS.includes(group)) continue;
    marks[group] = {
      type: mark.mark,
      date: isoDateOf(mark.markedAt, timezone) ?? mark.markedAt.slice(0, 10),
      by: mark.markedBy.name,
      ...(mark.note && { note: mark.note }),
    };
  }
  return { dob: patient.birthDate, sex: patient.gender as ForecastPatientSex | undefined, asOf, doses, marks };
}

/** Reads the patient and their Immunization records and runs the engine; the queries are fixed, the id their input. */
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
  const records = buildPatientImmunizationsResponse(await searchPatientImmunizations(oystehr, patientId));
  return { patient, records, forecast: forecastImmunizations(toForecastInput(patient, records, asOf, timezone)) };
}
