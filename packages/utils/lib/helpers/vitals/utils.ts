import { CodeableConcept, Observation } from 'fhir/r4b';
import { DateTime } from 'luxon';
import {
  AlertRule,
  AlertThreshold,
  FHIRObservationInterpretation,
  FHIRObservationInterpretationCodesMap,
  GetVitalsResponseData,
  VitalAlertCriticality,
  VitalFieldNames,
  VitalsDef,
  VitalsObservationDTO,
} from '../../types';

export const convertVitalsListToMap = (list: VitalsObservationDTO[]): GetVitalsResponseData => {
  const vitalsMap: Partial<GetVitalsResponseData> = {};

  list.forEach((vital) => {
    // Ensure the field is a valid VitalFieldNames
    if (Object.values(VitalFieldNames).includes(vital.field)) {
      const current = (vitalsMap as any)[vital.field] ?? [];
      current.push(vital);
      (vitalsMap as any)[vital.field] = current;
    } else {
      console.log('field is not a valid VitalFieldNames:', vital.field, Object.values(VitalFieldNames));
    }
  });

  // Ensure all required fields are present and not undefined
  const fullVitalsMap: GetVitalsResponseData = {} as GetVitalsResponseData;
  Object.values(VitalFieldNames).forEach((field) => {
    (fullVitalsMap as any)[field] = (vitalsMap as any)[field] ?? [];
  });
  return fullVitalsMap;
};

export const getVitalDTOCriticalityFromObservation = (observation: Observation): VitalAlertCriticality | undefined => {
  const interpretations = observation?.interpretation ?? [];
  if (observation.component && observation.component.length > 0) {
    const componentInterpretations = observation.component.flatMap((comp) => comp.interpretation ?? []);
    interpretations.push(...componentInterpretations);
  }

  const mergeInterpretations = (interpretations: CodeableConcept[]): VitalAlertCriticality | undefined => {
    if (
      interpretations.some(
        (item) =>
          item.coding?.some(
            (code) =>
              code.code === FHIRObservationInterpretation.CriticalLow ||
              code.code === FHIRObservationInterpretation.CriticalHigh
          )
      )
    ) {
      return VitalAlertCriticality.Critical;
    }
    if (
      interpretations.some(
        (item) =>
          item.coding?.some(
            (code) =>
              code.code === FHIRObservationInterpretation.AbnormalLow ||
              code.code === FHIRObservationInterpretation.AbnormalHigh
          )
      )
    ) {
      return VitalAlertCriticality.Abnormal;
    }
    return undefined;
  };
  return mergeInterpretations(interpretations);
};

interface CheckForAbnormalValueInput {
  patientDOB: string;
  vitalsObservation: VitalsObservationDTO;
  configOverride?: any; // optional override for primarily for testing purposes
}
export const getVitalObservationAlertLevel = (input: CheckForAbnormalValueInput): VitalAlertCriticality | undefined => {
  const { patientDOB: dob, vitalsObservation, configOverride } = input;
  const vitalsKey = vitalsObservation.field;
  const patientAgeInMonths = DateTime.fromISO(dob).diffNow('months').months * -1;

  const getVitalCriticalityFromAlertLevels = (
    alertLevels: FHIRObservationInterpretation[]
  ): VitalAlertCriticality | undefined => {
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

  const rulesOrComponents = findRulesForVitalsKeyAndDOB(vitalsKey as VitalFieldNames, dob, configOverride);

  const { type } = rulesOrComponents;
  if (type === 'rules') {
    const { rules } = rulesOrComponents;
    const alertLevels = getAlertLevels({
      observation: vitalsObservation,
      rules,
      patientAgeInMonths,
    });
    return getVitalCriticalityFromAlertLevels(alertLevels);
  } else {
    // currently we do nothing in the ui to identify which component is the source of the alert,
    // so combining all components into a single criticality like this does the trick
    const { components } = rulesOrComponents;
    const result: { [componentName: string]: FHIRObservationInterpretation[] } = {};
    Object.entries(components).forEach(([name, componentRules]) => {
      const alertLevels = getAlertLevels({
        observation: vitalsObservation,
        rules: componentRules,
        patientAgeInMonths,
        componentName: name,
      });
      result[name] = alertLevels;
    });
    // Combine all interpretations from components
    const combinedAlertLevels = Object.values(result).flat();
    return getVitalCriticalityFromAlertLevels(combinedAlertLevels);
  }
};

export const getVitalObservationFhirInterpretations = (
  input: CheckForAbnormalValueInput
): CodeableConcept[] | undefined => {
  const { patientDOB: dob, vitalsObservation, configOverride } = input;
  const vitalsKey = vitalsObservation.field;
  const patientAgeInMonths = DateTime.fromISO(dob).diffNow('months').months * -1;
  const rulesOrComponents = findRulesForVitalsKeyAndDOB(vitalsKey as VitalFieldNames, dob, configOverride);
  // console.log('rules for', vitalsKey, rulesOrComponents.length);
  const { type } = rulesOrComponents;
  if (type === 'rules') {
    const { rules } = rulesOrComponents;
    const alertLevels = getAlertLevels({
      observation: vitalsObservation,
      rules,
      patientAgeInMonths,
    });
    return getAlertLevelsFromInterpretations(alertLevels);
  }
  return undefined;
};

export const getVitalObservationFhirComponentInterpretations = (
  input: CheckForAbnormalValueInput
): { [componentName: string]: CodeableConcept[] } | undefined => {
  const { patientDOB: dob, vitalsObservation, configOverride } = input;
  const vitalsKey = vitalsObservation.field;
  const patientAgeInMonths = DateTime.fromISO(dob).diffNow('months').months * -1;
  const rulesOrComponents = findRulesForVitalsKeyAndDOB(vitalsKey as VitalFieldNames, dob, configOverride);
  const { type } = rulesOrComponents;
  if (type === 'components') {
    const { components } = rulesOrComponents;
    const result: { [componentName: string]: CodeableConcept[] } = {};
    Object.entries(components).forEach(([name, componentRules]) => {
      const alertLevels = getAlertLevels({
        observation: vitalsObservation,
        rules: componentRules,
        patientAgeInMonths,
        componentName: name,
      });
      result[name] = getAlertLevelsFromInterpretations(alertLevels) ?? [];
    });
    return result;
  }
  return undefined;
};

const getAlertLevelsFromInterpretations = (alertLevels: FHIRObservationInterpretation[]): CodeableConcept[] => {
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

const findRulesForVitalsKeyAndDOB = (
  key: VitalFieldNames,
  dob: string,
  configOverride?: any // optional override for primarily for testing purposes
):
  | { type: 'rules'; rules: AlertRule[] }
  | { type: 'components'; components: { [componentName: string]: AlertRule[] } } => {
  const dateOfBirth = DateTime.fromISO(dob);
  const now = DateTime.now();
  const alertThresholds: AlertThreshold[] = VitalsDef(configOverride)[key]?.alertThresholds ?? [];
  const alertComponents: { [componentName: string]: AlertRule[] } = {};
  if (key === 'vital-blood-pressure' || key === 'vital-vision') {
    // For blood pressure, we need to check components
    const components = VitalsDef(configOverride)[key]?.components;
    if (components) {
      Object.entries(components).forEach(([name, component]) => {
        alertComponents[name] = getRulesForPatientDOB(component.alertThresholds ?? [], dateOfBirth, now);
      });
    }
    return { type: 'components', components: alertComponents };
  }
  return { type: 'rules', rules: getRulesForPatientDOB(alertThresholds, dateOfBirth, now) };
};

const getRulesForPatientDOB = (
  alertThresholds: AlertThreshold[],
  dateOfBirth: DateTime,
  now: DateTime
): AlertRule[] => {
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
  componentName?: string;
}

const getAlertLevels = (input: AlertableValuesInput): FHIRObservationInterpretation[] => {
  const { observation, rules, patientAgeInMonths, componentName } = input;
  let value: number | undefined = observation.value;
  if (observation.field === VitalFieldNames.VitalVision) {
    return [];
  }
  if (observation.field === VitalFieldNames.VitalBloodPressure) {
    // do a blood pressure-specific check on components
    if (componentName === 'systolic-pressure') {
      value = observation.systolicPressure;
    }
    if (componentName === 'diastolic-pressure') {
      value = observation.diastolicPressure;
    }
  }

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
    thresholdValue = rule.ageFunction(patientAgeInMonths / 12.0);
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
