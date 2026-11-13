import Oystehr from '@oystehr/sdk';
import { Observation, ObservationComponent } from 'fhir/r4b';
import { DAYS_PER_WEEK } from 'utils/lib/helpers/vitals/birth-history.helper';
import {
  BIRTH_HISTORY_CODE,
  BIRTH_HISTORY_COMPONENT_CODES,
  BIRTH_HISTORY_META_SYSTEM,
  BirthHistory,
  BirthHistoryDTO,
} from 'utils/lib/types/api/birth-history.types';

const UCUM_SYSTEM = 'http://unitsofmeasure.org';

/** The patient's birth history Observation (the newest, should more than one ever exist), if saved. */
export const fetchBirthHistoryObservation = async (
  oystehr: Oystehr,
  patientId: string
): Promise<Observation | undefined> =>
  (
    await oystehr.fhir.search<Observation>({
      resourceType: 'Observation',
      params: [
        { name: 'patient._id', value: patientId },
        { name: '_tag', value: `${BIRTH_HISTORY_META_SYSTEM}|${BIRTH_HISTORY_CODE}` },
        { name: 'status:not', value: 'entered-in-error,cancelled' },
        { name: '_sort', value: '-_lastUpdated' },
        { name: '_count', value: '1' },
      ],
    })
  ).unbundle()[0];

const component = (
  code: string,
  value: Pick<ObservationComponent, 'valueQuantity' | 'valueTime'>
): ObservationComponent => ({
  code: { coding: [{ system: BIRTH_HISTORY_META_SYSTEM, code }] },
  ...value,
});
const quantity = (value: number, unit: string): Pick<ObservationComponent, 'valueQuantity'> => ({
  valueQuantity: { value, unit, system: UCUM_SYSTEM, code: unit },
});

/** The one Observation that holds a patient's birth history; `existing` keeps its id so a save updates in place. */
export const makeBirthHistoryObservation = (
  patientId: string,
  history: BirthHistory,
  existing?: Observation
): Observation => {
  const codes = BIRTH_HISTORY_COMPONENT_CODES;
  const components: ObservationComponent[] = [];
  if (history.timeOfBirth) components.push(component(codes.timeOfBirth, { valueTime: `${history.timeOfBirth}:00` }));
  if (history.gestationalAgeWeeks !== undefined) {
    const days = history.gestationalAgeWeeks * DAYS_PER_WEEK + (history.gestationalAgeDays ?? 0);
    components.push(component(codes.gestationalAge, quantity(days, 'd')));
  }
  if (history.birthWeightKg !== undefined)
    components.push(component(codes.birthWeightKg, quantity(history.birthWeightKg, 'kg')));
  if (history.birthLengthCm !== undefined)
    components.push(component(codes.birthLengthCm, quantity(history.birthLengthCm, 'cm')));
  if (history.birthHeadCircumferenceCm !== undefined)
    components.push(component(codes.birthHeadCircumferenceCm, quantity(history.birthHeadCircumferenceCm, 'cm')));

  return {
    resourceType: 'Observation',
    ...(existing?.id ? { id: existing.id } : {}),
    status: 'final',
    meta: { tag: [{ system: BIRTH_HISTORY_META_SYSTEM, code: BIRTH_HISTORY_CODE }] },
    code: { coding: [{ system: BIRTH_HISTORY_META_SYSTEM, code: BIRTH_HISTORY_CODE, display: 'Birth history' }] },
    subject: { reference: `Patient/${patientId}` },
    component: components,
  };
};

export const makeBirthHistoryDTO = (observation: Observation): BirthHistoryDTO => {
  const codes = BIRTH_HISTORY_COMPONENT_CODES;
  const find = (code: string): ObservationComponent | undefined =>
    observation.component?.find((c) => c.code.coding?.some((coding) => coding.code === code));
  const number = (code: string): number | undefined => find(code)?.valueQuantity?.value;
  const gestationalDays = number(codes.gestationalAge);
  const timeOfBirth = find(codes.timeOfBirth)?.valueTime;
  return {
    resourceId: observation.id,
    ...(timeOfBirth ? { timeOfBirth: timeOfBirth.slice(0, 5) } : {}),
    ...(gestationalDays !== undefined
      ? {
          gestationalAgeWeeks: Math.floor(gestationalDays / DAYS_PER_WEEK),
          gestationalAgeDays: gestationalDays % DAYS_PER_WEEK,
        }
      : {}),
    ...(number(codes.birthWeightKg) !== undefined ? { birthWeightKg: number(codes.birthWeightKg) } : {}),
    ...(number(codes.birthLengthCm) !== undefined ? { birthLengthCm: number(codes.birthLengthCm) } : {}),
    ...(number(codes.birthHeadCircumferenceCm) !== undefined
      ? { birthHeadCircumferenceCm: number(codes.birthHeadCircumferenceCm) }
      : {}),
  };
};
