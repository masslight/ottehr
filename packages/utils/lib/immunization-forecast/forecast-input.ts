/**
 * Builds the engine's input from the patient's Immunization records (get-patient-immunizations response shape),
 * so the server-side forecast, the record PDF and the tests feed the engine the same way.
 */
import { DateTime } from 'luxon';
import { ImmunizationMark, PatientImmunizationRecord } from '../types/data/immunization/types';
import { FORECAST_GROUP_IDS } from './groups';
import {
  ForecastMarkInput,
  ForecastPatientSex,
  ImmunizationForecastInput,
  ImmunizationGroupId,
  ImmunizationReportOrigin,
} from './types';

export interface ForecastPatientInput {
  /** ISO yyyy-mm-dd. */
  dob: string;
  sex?: ForecastPatientSex;
  /** ISO yyyy-mm-dd. */
  asOf: string;
}

/**
 * The calendar date of a date or date-time: in `timezone` when known (the visit's location), else in the offset
 * the value carries. A dose given at 10:30 pm is that day's dose, not the next UTC day's.
 */
export const isoDateOf = (value: string, timezone?: string): string | undefined => {
  const parsed = DateTime.fromISO(value, { setZone: true });
  if (!parsed.isValid) return undefined;
  return (timezone ? parsed.setZone(timezone) : parsed).toISODate() ?? undefined;
};

export const isForecastGroupId = (code: string): code is ImmunizationGroupId =>
  (FORECAST_GROUP_IDS as string[]).includes(code);

/** The active (not cleared) mark of each vaccine group; `marks` is newest first, so the first active one wins. */
export function activeMarksByGroup(marks: ImmunizationMark[]): Partial<Record<ImmunizationGroupId, ImmunizationMark>> {
  const active: Partial<Record<ImmunizationGroupId, ImmunizationMark>> = {};
  for (const mark of marks) {
    const code = mark.vaccineGroup.code;
    if (mark.cleared || !isForecastGroupId(code) || active[code]) continue;
    active[code] = mark;
  }
  return active;
}

/**
 * Every dose goes in, undated ones included (the engine shows them as not counted) and ones without a CVX (the
 * engine lists them as unmapped); only the active marks do. Dates given are ISO dates or date-times; the engine
 * takes the calendar date in `timezone`.
 */
export function buildForecastInput(
  patient: ForecastPatientInput,
  immunizations: PatientImmunizationRecord[],
  marks: ImmunizationMark[],
  timezone?: string
): ImmunizationForecastInput {
  const active = activeMarksByGroup(marks);
  const markInputs: Partial<Record<ImmunizationGroupId, ForecastMarkInput>> = {};
  for (const [code, mark] of Object.entries(active) as [ImmunizationGroupId, ImmunizationMark][]) {
    markInputs[code] = {
      type: mark.mark,
      date: isoDateOf(mark.markedAt, timezone) ?? mark.markedAt.slice(0, 10),
      by: mark.markedBy.name,
      ...(mark.note && { note: mark.note }),
    };
  }
  return {
    dob: patient.dob,
    ...(patient.sex && { sex: patient.sex }),
    asOf: patient.asOf,
    doses: immunizations.map((record) => ({
      id: record.id,
      date: record.dateGiven ? isoDateOf(record.dateGiven, timezone) ?? null : null,
      cvx: record.cvx ?? '',
      source: record.outside ? 'outside' : 'administered',
      ...(record.outside && record.sourceCode && { outsideSource: record.sourceCode as ImmunizationReportOrigin }),
    })),
    marks: markInputs,
  };
}
