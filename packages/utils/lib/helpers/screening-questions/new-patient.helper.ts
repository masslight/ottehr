import { Appointment } from 'fhir/r4b';
import { DateTime } from 'luxon';
import { PATIENT_INFO_META_DATA_RETURNING_PATIENT_CODE, PATIENT_INFO_META_DATA_SYSTEM } from '../../types/constants';
import {
  PATIENT_SEEN_IN_LAST_THREE_YEARS_FIELD,
  RecentVisitKeys,
  SEEN_IN_LAST_THREE_YEARS_FIELD,
} from '../../types/data/screening-questions/constants';

export const SEEN_VISIT_APPOINTMENT_STATUS: NonNullable<Appointment['status']> = 'fulfilled';

const NEW_PATIENT_LOOKBACK_YEARS = 3;

export const newPatientLookbackStart = (visitAt: string): string =>
  DateTime.fromISO(visitAt).minus({ years: NEW_PATIENT_LOOKBACK_YEARS }).toUTC().toISO() ?? visitAt;

export const isWithinNewPatientLookback = (priorVisitAt: string | undefined, visitAt: string | undefined): boolean => {
  if (!priorVisitAt || !visitAt) return false;
  const [prior, visit] = [DateTime.fromISO(priorVisitAt), DateTime.fromISO(visitAt)];
  return prior < visit && prior >= visit.minus({ years: NEW_PATIENT_LOOKBACK_YEARS });
};

export const hasReturningPatientTag = (appointment: Appointment | undefined): boolean =>
  appointment?.meta?.tag?.some(
    (tag) => tag.system === PATIENT_INFO_META_DATA_SYSTEM && tag.code === PATIENT_INFO_META_DATA_RETURNING_PATIENT_CODE
  ) ?? false;

export interface VisitSeenBeforeData {
  observations?: { field?: string; value?: unknown }[];
  appointment?: Appointment;
}

export function isNewPatient(hasPriorVisit: boolean, visits: VisitSeenBeforeData[]): boolean {
  if (hasPriorVisit) return false;

  let staffSeenBefore: boolean | undefined;
  let patientSeenBefore: boolean | undefined;

  for (const { observations = [], appointment } of visits) {
    const staff = observations.find((o) => o.field === SEEN_IN_LAST_THREE_YEARS_FIELD)?.value;

    if (staff === RecentVisitKeys.Yes || staff === RecentVisitKeys.No)
      staffSeenBefore ??= staff === RecentVisitKeys.Yes;

    const patient = observations.find((o) => o.field === PATIENT_SEEN_IN_LAST_THREE_YEARS_FIELD)?.value;

    if (typeof patient === 'boolean') patientSeenBefore ??= patient;
    if (hasReturningPatientTag(appointment)) patientSeenBefore ??= true;
  }

  return !(staffSeenBefore ?? patientSeenBefore ?? false);
}
