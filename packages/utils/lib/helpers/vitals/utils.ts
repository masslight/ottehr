import { CodeableConcept, Observation } from 'fhir/r4b';
import { DateTime } from 'luxon';
import {
  AlertRule,
  FHIRObservationInterpretation,
  FHIRObservationInterpretationCodesMap,
  GetVitalsResponseData,
  VitalAlertCriticality,
  VitalFieldNames,
  VitalsDef,
  VitalsObservationDTO,
} from '../../types';

export const convertVitalsListToMap = (list: VitalsObservationDTO[]): GetVitalsResponseData => {
  const vitalsMap: Record<VitalFieldNames, VitalsObservationDTO[]> = {} as Record<
    VitalFieldNames,
    VitalsObservationDTO[]
  >;

  list.forEach((vital) => {
    console.log('Processing vital:', vital);
    // Ensure the field is a valid VitalFieldNames
    if (Object.values(VitalFieldNames).includes(vital.field)) {
      const current = vitalsMap[vital.field as VitalFieldNames] ?? [];
      current.push(vital);
      vitalsMap[vital.field as VitalFieldNames] = current;
    } else {
      console.log('field is not a valid VitalFieldNames:', vital.field, Object.values(VitalFieldNames));
    }
  });

  // todo: ts better
  return vitalsMap as GetVitalsResponseData;
};

export const getVitalDTOCriticalityFromObservation = (observation: Observation): VitalAlertCriticality | undefined => {
  const interpretation = observation?.interpretation?.[0];
  if (!interpretation) return undefined;

  if (
    interpretation.coding?.some(
      (code) =>
        code.code === FHIRObservationInterpretation.CriticalLow ||
        code.code === FHIRObservationInterpretation.CriticalHigh
    )
  ) {
    return VitalAlertCriticality.Critical;
  }
  if (
    interpretation.coding?.some(
      (code) =>
        code.code === FHIRObservationInterpretation.AbnormalLow ||
        code.code === FHIRObservationInterpretation.AbnormalHigh
    )
  ) {
    return VitalAlertCriticality.Abnormal;
  }
  return undefined;
};

interface CheckForAbnormalValueInput {
  patientDOB: string;
  vitalsObservation: VitalsObservationDTO;
}
export const getVitalObservationAlertLevel = (input: CheckForAbnormalValueInput): VitalAlertCriticality | undefined => {
  const { patientDOB: dob, vitalsObservation } = input;
  const vitalsKey = vitalsObservation.field;
  const patientAgeInMonths = DateTime.fromISO(dob).diffNow('months').months * -1;
  const rules = findRulesForVitalsKeyAndDOB(vitalsKey as VitalFieldNames, dob);
  console.log('rules for', vitalsKey, rules.length);
  const alertLevels = getAlertLevels({
    observation: vitalsObservation,
    rules,
    patientAgeInMonths,
  });

  const someCritical = alertLevels.some(
    (level) =>
      level === FHIRObservationInterpretation.CriticalHigh || level === FHIRObservationInterpretation.CriticalLow
  );
  const someAbnormal = alertLevels.some(
    (level) =>
      level === FHIRObservationInterpretation.AbnormalHigh || level === FHIRObservationInterpretation.AbnormalLow
  );

  if (someCritical) {
    return VitalAlertCriticality.Critical;
  }
  if (someAbnormal) {
    return VitalAlertCriticality.Abnormal;
  }
  return undefined;
};

export const getVitalObservationFhirInterpretations = (
  input: CheckForAbnormalValueInput
): CodeableConcept[] | undefined => {
  const { patientDOB: dob, vitalsObservation } = input;
  const vitalsKey = vitalsObservation.field;
  const patientAgeInMonths = DateTime.fromISO(dob).diffNow('months').months * -1;
  const rules = findRulesForVitalsKeyAndDOB(vitalsKey as VitalFieldNames, dob);
  console.log('rules for', vitalsKey, rules.length);
  const alertLevels = getAlertLevels({
    observation: vitalsObservation,
    rules,
    patientAgeInMonths,
  });

  let deduped = Array.from(new Set(alertLevels));
  // Remove AbnormalHigh if CriticalHigh is present
  if (deduped.includes(FHIRObservationInterpretation.CriticalHigh)) {
    deduped = deduped.filter((level) => level !== FHIRObservationInterpretation.AbnormalHigh);
  }
  // Remove AbnormalLow if CriticalLow is present
  if (deduped.includes(FHIRObservationInterpretation.CriticalLow)) {
    deduped = deduped.filter((level) => level !== FHIRObservationInterpretation.AbnormalLow);
  }

  // always remove Normal
  deduped = deduped.filter((level) => level !== FHIRObservationInterpretation.Normal);

  return deduped.map((level) => {
    return FHIRObservationInterpretationCodesMap[level];
  });
};

const findRulesForVitalsKeyAndDOB = (key: VitalFieldNames, dob: string): AlertRule[] => {
  const dateOfBirth = DateTime.fromISO(dob);
  const now = DateTime.now();
  const alertThresholds = VitalsDef[key]?.alertThresholds ?? [];
  const rules = alertThresholds
    .filter((threshold) => {
      const { minAge, maxAge } = threshold;
      if (!minAge && !maxAge) return true;
      if (minAge) {
        const minAgeDOB = now.minus({ [minAge.unit]: minAge.value });
        if (dateOfBirth > minAgeDOB) return false;
      }
      if (maxAge) {
        const maxAgeDOB = now.minus({ [maxAge.unit]: maxAge.value });
        if (dateOfBirth < maxAgeDOB) return false;
      }
      return true;
    })
    .flatMap((threshold) => threshold.rules ?? []);
  return rules;
};

interface AlertableValuesInput {
  observation: VitalsObservationDTO;
  rules: AlertRule[];
  patientAgeInMonths: number;
}

const getAlertLevels = (input: AlertableValuesInput): FHIRObservationInterpretation[] => {
  const { observation, rules, patientAgeInMonths } = input;

  if (observation.field === VitalFieldNames.VitalVision) {
    // do a vision-specific check on components
    return [];
  }
  if (observation.field === VitalFieldNames.VitalBloodPressure) {
    // do a blood pressure-specific check on components
    return [];
  }
  const value = observation.value;

  if (value === undefined || value === null || typeof value !== 'number') {
    console.warn('Vital value is not a number:', value);
    return [];
  }

  return rules
    .map((rule) => getAlertLevel({ rule, numericValue: value, patientAgeInMonths }))
    .filter((level) => level !== FHIRObservationInterpretation.Normal);
};

interface EvalRuleProps {
  numericValue: number;
  rule: AlertRule;
  patientAgeInMonths?: number;
}
const getAlertLevel = (input: EvalRuleProps): FHIRObservationInterpretation => {
  const { numericValue: value, rule, patientAgeInMonths } = input;
  let thresholdValue: number | undefined;

  if ('value' in rule && typeof rule.value === 'number') {
    thresholdValue = rule.value;
  } else if ('ageFunction' in rule && typeof rule.ageFunction === 'function') {
    if (patientAgeInMonths === undefined) {
      console.warn('Rule has an ageFunction but no patientAgeInMonths provided:', rule);
      return FHIRObservationInterpretation.Normal;
    }
    thresholdValue = rule.ageFunction(patientAgeInMonths);
  }

  if (thresholdValue === undefined) {
    console.warn('Rule does not have a value or ageFunction:', rule);
    return FHIRObservationInterpretation.Normal;
  }

  const ruleCriticality = rule.criticality;
  if (rule.type === 'min') {
    if (value < thresholdValue) {
      if (ruleCriticality === VitalAlertCriticality.Critical) {
        return FHIRObservationInterpretation.CriticalLow;
      }
      if (ruleCriticality === VitalAlertCriticality.Abnormal) {
        return FHIRObservationInterpretation.AbnormalLow;
      }
    }
  }
  if (rule.type === 'max') {
    if (value > thresholdValue) {
      if (ruleCriticality === VitalAlertCriticality.Critical) {
        return FHIRObservationInterpretation.CriticalHigh;
      }
      if (ruleCriticality === VitalAlertCriticality.Abnormal) {
        return FHIRObservationInterpretation.AbnormalHigh;
      }
    }
  }
  return FHIRObservationInterpretation.Normal;
};
