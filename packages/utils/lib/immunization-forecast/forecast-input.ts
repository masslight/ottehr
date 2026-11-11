/**
 * Builds the engine's input from the patient's Immunization records (get-patient-immunizations response shape),
 * so the server-side forecast and the tests feed the engine the same way.
 */
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
 * Every dose goes in, undated ones included (the engine shows them as not counted); only the active marks do.
 * Dates given here are ISO date-times; the engine takes the calendar date.
 */
export function buildForecastInput(
  patient: ForecastPatientInput,
  immunizations: PatientImmunizationRecord[],
  marks: ImmunizationMark[]
): ImmunizationForecastInput {
  const active = activeMarksByGroup(marks);
  const markInputs: Partial<Record<ImmunizationGroupId, ForecastMarkInput>> = {};
  for (const [code, mark] of Object.entries(active) as [ImmunizationGroupId, ImmunizationMark][]) {
    markInputs[code] = {
      type: mark.mark,
      date: mark.markedAt.slice(0, 10),
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
      date: record.dateGiven ? record.dateGiven.slice(0, 10) : null,
      cvx: record.cvx ?? '',
      source: record.outside ? 'outside' : 'administered',
      ...(record.outside && record.sourceCode && { outsideSource: record.sourceCode as ImmunizationReportOrigin }),
    })),
    marks: markInputs,
  };
}
