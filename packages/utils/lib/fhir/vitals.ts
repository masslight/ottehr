import { CodeableConcept, Observation, ObservationComponent } from 'fhir/r4b';
import {
  ObservationDTO,
  VitalBloodPressureObservationMethod,
  VitalFieldNames,
  VitalHeartbeatObservationMethod,
  VitalsBaseObservationDTO,
  VitalsBloodPressureObservationDTO,
  VitalsHeartbeatObservationDTO,
  VitalsHeightObservationDTO,
  VitalsObservationDTO,
  VitalsOxygenSatObservationDTO,
  VitalsOxygenSatObservationMethod,
  VitalsRespirationRateObservationDTO,
  VitalsTemperatureObservationDTO,
  VitalsVisionObservationDTO,
  VitalsVisionOption,
  VitalsWeightObservationDTO,
  VitalTemperatureObservationMethod,
} from 'utils';

export const SNOMED_SYSTEM = 'http://snomed.info/sct';
export const LOINC_SYSTEM = 'http://loinc.org';

export const VITAL_TEMPERATURE_OBS_METHOD_CODE_ORAL = '89003005';
export const VITAL_TEMPERATURE_OBS_METHOD_CODE_RECTAL = '18649001';
export const VITAL_TEMPERATURE_OBS_METHOD_LOINC_CODE_AXILLARY = '8328-7';
export const VITAL_TEMPERATURE_OBS_METHOD_LOINC_CODE_TEMPORAL = '75539-7';

export const VITAL_HEARTBEAT_OBS_METHOD_CODE_SITTING = '33586001';
export const VITAL_HEARTBEAT_OBS_METHOD_CODE_STANDING = '10904000';
export const VITAL_HEARTBEAT_OBS_METHOD_CODE_SUPINE = '40199007';

export const VITAL_BLOOD_PRESSURE_OBS_METHOD_CODE_SITTING = '33586001';
export const VITAL_BLOOD_PRESSURE_OBS_METHOD_CODE_STANDING = '10904000';
export const VITAL_BLOOD_PRESSURE_OBS_METHOD_CODE_SUPINE = '40199007';

export const VITAL_SYSTOLIC_BLOOD_PRESSURE_LOINC_CODE = '8480-6';
export const VITAL_DIASTOLIC_BLOOD_PRESSURE_LOINC_CODE = '8462-4';

export const VITAL_OXY_SATURATION_OBS_METHOD_CODE_ROOM_AIR = '250590007';
export const VITAL_OXY_SATURATION_OBS_METHOD_CODE_SUPPLEMENTAL_O2 = '250591006';

export const VITAL_LEFT_EYE_SNOMED_CODE = '8976008';
export const VITAL_RIGHT_EYE_SNOMED_CODE = '8977004';

export const VITAL_CHILD_TOO_YOUNG_OPTION_SNOMED_CODE = '9876543';
export const VITAL_CHILD_WITH_GLASSES_OPTION_SNOMED_CODE = '1234567';
export const VITAL_CHILD_WITHOUT_GLASSES_OPTION_SNOMED_CODE = '7654321';

export const getTempObservationMethodCodable = (
  tempDTO: VitalsTemperatureObservationDTO
): CodeableConcept | undefined => {
  const obsMethod = tempDTO?.observationMethod;

  if (!obsMethod) return;

  if (obsMethod === VitalTemperatureObservationMethod.Oral) {
    return {
      coding: [
        {
          system: SNOMED_SYSTEM,
          code: VITAL_TEMPERATURE_OBS_METHOD_CODE_ORAL,
          display: 'Oral temperature taking',
        },
      ],
    };
  }

  if (obsMethod === VitalTemperatureObservationMethod.Rectal) {
    return {
      coding: [
        {
          system: SNOMED_SYSTEM,
          code: VITAL_TEMPERATURE_OBS_METHOD_CODE_RECTAL,
          display: 'Rectal temperature taking',
        },
      ],
    };
  }

  if (obsMethod === VitalTemperatureObservationMethod.Axillary) {
    return {
      coding: [
        {
          system: LOINC_SYSTEM,
          code: VITAL_TEMPERATURE_OBS_METHOD_LOINC_CODE_AXILLARY,
          display: 'Axillary temperature',
        },
      ],
    };
  }

  if (obsMethod === VitalTemperatureObservationMethod.Temporal) {
    return {
      coding: [
        {
          system: LOINC_SYSTEM,
          code: VITAL_TEMPERATURE_OBS_METHOD_LOINC_CODE_TEMPORAL,
          display: 'Body temperature - Temporal artery',
        },
      ],
    };
  }

  return undefined;
};

export const extractTemperatureObservationMethod = (
  observation: Observation
): VitalTemperatureObservationMethod | undefined => {
  const obsMethodCode = observation?.method?.coding?.at(0)?.code;
  if (!obsMethodCode) return;

  if (obsMethodCode === VITAL_TEMPERATURE_OBS_METHOD_CODE_ORAL) {
    return VitalTemperatureObservationMethod.Oral;
  }

  if (obsMethodCode === VITAL_TEMPERATURE_OBS_METHOD_CODE_RECTAL) {
    return VitalTemperatureObservationMethod.Rectal;
  }

  if (obsMethodCode === VITAL_TEMPERATURE_OBS_METHOD_LOINC_CODE_AXILLARY) {
    return VitalTemperatureObservationMethod.Axillary;
  }

  if (obsMethodCode === VITAL_TEMPERATURE_OBS_METHOD_LOINC_CODE_TEMPORAL) {
    return VitalTemperatureObservationMethod.Temporal;
  }

  return undefined;
};

export const getHeartbeatObservationMethodCodable = (
  heartbeatDTO: VitalsHeartbeatObservationDTO
): CodeableConcept | undefined => {
  const obsMethod = heartbeatDTO?.observationMethod;
  if (!obsMethod) return;
  if (obsMethod === VitalHeartbeatObservationMethod.Sitting) {
    return {
      coding: [
        {
          system: SNOMED_SYSTEM,
          code: VITAL_HEARTBEAT_OBS_METHOD_CODE_SITTING,
          display: 'Sitting position',
        },
      ],
    };
  }
  if (obsMethod === VitalHeartbeatObservationMethod.Standing) {
    return {
      coding: [
        {
          system: SNOMED_SYSTEM,
          code: VITAL_HEARTBEAT_OBS_METHOD_CODE_STANDING,
          display: 'Orthostatic body position',
        },
      ],
    };
  }
  if (obsMethod === VitalHeartbeatObservationMethod.Supine) {
    return {
      coding: [
        {
          system: SNOMED_SYSTEM,
          code: VITAL_HEARTBEAT_OBS_METHOD_CODE_SUPINE,
          display: 'Supine body position',
        },
      ],
    };
  }
  return undefined;
};

export const getBloodPressureObservationComponents = (
  bloodPressureDTO: VitalsBloodPressureObservationDTO
): ObservationComponent[] => {
  const result: ObservationComponent[] = [];

  const systolicPressure = bloodPressureDTO.systolicPressure;
  if (systolicPressure) {
    const systolicCode: CodeableConcept = {
      coding: [
        {
          system: SNOMED_SYSTEM,
          code: '271649006',
          display: 'Systolic blood pressure',
        },
        {
          system: LOINC_SYSTEM,
          code: VITAL_SYSTOLIC_BLOOD_PRESSURE_LOINC_CODE,
          display: 'Systolic blood pressure',
        },
      ],
    };
    const systolicComponent: ObservationComponent = {
      code: systolicCode,
      valueQuantity: { value: systolicPressure, system: 'http://unitsofmeasure.org', unit: 'mmHg' },
    };

    result.push(systolicComponent);
  }

  const diastolicPressure = bloodPressureDTO.diastolicPressure;
  if (diastolicPressure) {
    const diastolicCode: CodeableConcept = {
      coding: [
        {
          system: LOINC_SYSTEM,
          code: VITAL_DIASTOLIC_BLOOD_PRESSURE_LOINC_CODE,
          display: 'Diastolic blood pressure',
        },
      ],
    };
    const diastolicComponent: ObservationComponent = {
      code: diastolicCode,
      valueQuantity: { value: diastolicPressure, system: 'http://unitsofmeasure.org', unit: 'mmHg' },
    };

    result.push(diastolicComponent);
  }

  return result;
};

export const extractBloodPressureValues = (
  components: ObservationComponent[]
): { systolicPressureValue?: number; diastolicPressureValue?: number } => {
  const systolicComponent = components.find((cmp) => {
    return cmp.code?.coding?.find((coding) => coding?.code === VITAL_SYSTOLIC_BLOOD_PRESSURE_LOINC_CODE);
  });
  const systolicValue = systolicComponent?.valueQuantity?.value;

  const diastolicComponent = components.find((cmp) => {
    return cmp.code?.coding?.find((coding) => coding?.code === VITAL_DIASTOLIC_BLOOD_PRESSURE_LOINC_CODE);
  });
  const diastolicValue = diastolicComponent?.valueQuantity?.value;

  return {
    systolicPressureValue: systolicValue,
    diastolicPressureValue: diastolicValue,
  };
};

export const getBloodPressureObservationMethodCodable = (
  bloodPressureDTO: VitalsBloodPressureObservationDTO
): CodeableConcept | undefined => {
  const obsMethod = bloodPressureDTO?.observationMethod;
  if (!obsMethod) return;
  if (obsMethod === VitalBloodPressureObservationMethod.Sitting) {
    return {
      coding: [
        {
          system: SNOMED_SYSTEM,
          code: VITAL_BLOOD_PRESSURE_OBS_METHOD_CODE_SITTING,
          display: 'Sitting position',
        },
      ],
    };
  }
  if (obsMethod === VitalBloodPressureObservationMethod.Standing) {
    return {
      coding: [
        {
          system: SNOMED_SYSTEM,
          code: VITAL_BLOOD_PRESSURE_OBS_METHOD_CODE_STANDING,
          display: 'Orthostatic body position',
        },
      ],
    };
  }
  if (obsMethod === VitalBloodPressureObservationMethod.Supine) {
    return {
      coding: [
        {
          system: SNOMED_SYSTEM,
          code: VITAL_BLOOD_PRESSURE_OBS_METHOD_CODE_SUPINE,
          display: 'Supine body position',
        },
      ],
    };
  }
  return undefined;
};

export const extractBloodPressureObservationMethod = (
  observation: Observation
): VitalBloodPressureObservationMethod | undefined => {
  const obsMethodCode = observation?.method?.coding?.at(0)?.code;
  if (!obsMethodCode) return;

  if (obsMethodCode === VITAL_BLOOD_PRESSURE_OBS_METHOD_CODE_SITTING) {
    return VitalBloodPressureObservationMethod.Sitting;
  }

  if (obsMethodCode === VITAL_BLOOD_PRESSURE_OBS_METHOD_CODE_STANDING) {
    return VitalBloodPressureObservationMethod.Standing;
  }

  if (obsMethodCode === VITAL_BLOOD_PRESSURE_OBS_METHOD_CODE_SUPINE) {
    return VitalBloodPressureObservationMethod.Supine;
  }
  return undefined;
};

export const extractHeartbeatObservationMethod = (
  observation: Observation
): VitalHeartbeatObservationMethod | undefined => {
  const obsMethodCode = observation?.method?.coding?.at(0)?.code;
  if (!obsMethodCode) return;

  if (obsMethodCode === VITAL_HEARTBEAT_OBS_METHOD_CODE_SITTING) {
    return VitalHeartbeatObservationMethod.Sitting;
  }

  if (obsMethodCode === VITAL_HEARTBEAT_OBS_METHOD_CODE_STANDING) {
    return VitalHeartbeatObservationMethod.Standing;
  }

  if (obsMethodCode === VITAL_HEARTBEAT_OBS_METHOD_CODE_SUPINE) {
    return VitalHeartbeatObservationMethod.Supine;
  }
  return undefined;
};

export const getOxygenSaturationObservationMethodCodable = (
  oxySatDTO: VitalsOxygenSatObservationDTO
): CodeableConcept | undefined => {
  const obsMethod = oxySatDTO?.observationMethod;
  if (!obsMethod) return;
  if (obsMethod === VitalsOxygenSatObservationMethod.OnRoomAir) {
    return {
      coding: [
        {
          system: SNOMED_SYSTEM,
          code: VITAL_OXY_SATURATION_OBS_METHOD_CODE_ROOM_AIR,
          display: 'Oxygen saturation in room air',
        },
      ],
    };
  }
  if (obsMethod === VitalsOxygenSatObservationMethod.OnSupplementalO2) {
    return {
      coding: [
        {
          system: SNOMED_SYSTEM,
          code: VITAL_OXY_SATURATION_OBS_METHOD_CODE_SUPPLEMENTAL_O2,
          display: 'Oxygen saturation with supplemental oxygen',
        },
      ],
    };
  }

  return undefined;
};

export const extractOxySaturationObservationMethod = (
  observation: Observation
): VitalsOxygenSatObservationMethod | undefined => {
  const obsMethodCode = observation?.method?.coding?.at(0)?.code;
  if (!obsMethodCode) return;

  if (obsMethodCode === VITAL_OXY_SATURATION_OBS_METHOD_CODE_ROOM_AIR) {
    return VitalsOxygenSatObservationMethod.OnRoomAir;
  }

  if (obsMethodCode === VITAL_OXY_SATURATION_OBS_METHOD_CODE_SUPPLEMENTAL_O2) {
    return VitalsOxygenSatObservationMethod.OnSupplementalO2;
  }

  return undefined;
};

export const getVisionObservationComponents = (visionDTO: VitalsVisionObservationDTO): ObservationComponent[] => {
  let result: ObservationComponent[] = [];

  if (visionDTO.leftEyeVisionText) {
    const leftEye: CodeableConcept = {
      coding: [
        {
          system: SNOMED_SYSTEM,
          code: VITAL_LEFT_EYE_SNOMED_CODE,
          display: 'Left eye observation',
        },
      ],
    };
    const leftEyeVisionComponent: ObservationComponent = {
      code: leftEye,
      valueString: visionDTO.leftEyeVisionText,
    };

    result.push(leftEyeVisionComponent);
  }

  if (visionDTO.rightEyeVisionText) {
    const rightEyeCode: CodeableConcept = {
      coding: [
        {
          system: SNOMED_SYSTEM,
          code: VITAL_RIGHT_EYE_SNOMED_CODE,
          display: 'Right eye observation',
        },
      ],
    };
    const rightEyeVisionComponent: ObservationComponent = {
      code: rightEyeCode,
      valueString: visionDTO.rightEyeVisionText,
    };

    result.push(rightEyeVisionComponent);
  }

  const makeExtraVisionOptionComponent = (option: VitalsVisionOption, optionValue: boolean): ObservationComponent => {
    let optionCode = '';
    if (option === 'child_too_young') {
      optionCode = VITAL_CHILD_TOO_YOUNG_OPTION_SNOMED_CODE;
    } else if (option === 'with_glasses') {
      optionCode = VITAL_CHILD_WITH_GLASSES_OPTION_SNOMED_CODE;
    } else if (option === 'without_glasses') {
      optionCode = VITAL_CHILD_WITHOUT_GLASSES_OPTION_SNOMED_CODE;
    }

    let optionLabel = '';
    if (option === 'child_too_young') {
      optionLabel = 'Child too young';
    } else if (option === 'with_glasses') {
      optionLabel = 'With glasses';
    } else if (option === 'without_glasses') {
      optionLabel = 'Without glasses';
    }

    const optionCodeable: CodeableConcept = {
      coding: [
        {
          system: SNOMED_SYSTEM,
          code: optionCode,
          display: optionLabel,
        },
      ],
    };
    const visionOptionComponent: ObservationComponent = {
      code: optionCodeable,
      valueBoolean: optionValue,
    };
    return visionOptionComponent;
  };

  const extraVisionOptionsComponents = (visionDTO.extraVisionOptions ?? []).map((option) =>
    makeExtraVisionOptionComponent(option, true)
  );

  result = [...result, ...extraVisionOptionsComponents];

  return result;
};

export const extractVisionValues = (
  components: ObservationComponent[]
): {
  leftEyeVisText?: string;
  rightEyeVisText?: string;
  visionOptions?: VitalsVisionOption[];
} => {
  const leftEyeComponent = components.find((cmp) => {
    return cmp.code?.coding?.find((coding) => coding?.code === VITAL_LEFT_EYE_SNOMED_CODE);
  });

  const leftEyeVisionText = leftEyeComponent?.valueString || leftEyeComponent?.valueQuantity?.value?.toString();

  const rightEyeComponent = components.find((cmp) => {
    return cmp.code?.coding?.find((coding) => coding?.code === VITAL_RIGHT_EYE_SNOMED_CODE);
  });

  const rightEyeVisionText = rightEyeComponent?.valueString || rightEyeComponent?.valueQuantity?.value?.toString();

  const getVisionExtraOptionValue = (option: VitalsVisionOption): boolean | undefined => {
    let optionCode = '';
    if (option === 'child_too_young') {
      optionCode = VITAL_CHILD_TOO_YOUNG_OPTION_SNOMED_CODE;
    } else if (option === 'with_glasses') {
      optionCode = VITAL_CHILD_WITH_GLASSES_OPTION_SNOMED_CODE;
    } else if (option === 'without_glasses') {
      optionCode = VITAL_CHILD_WITHOUT_GLASSES_OPTION_SNOMED_CODE;
    }

    const optionComponent = components.find((cmp) => {
      return cmp.code?.coding?.find((coding) => coding?.code === optionCode);
    });
    return optionComponent?.valueBoolean;
  };

  const allExtraVisionOptions: VitalsVisionOption[] = ['child_too_young', 'with_glasses', 'without_glasses'];
  const storedExtraVisionOptions = allExtraVisionOptions.filter((option) => getVisionExtraOptionValue(option) === true);

  return {
    leftEyeVisText: leftEyeVisionText,
    rightEyeVisText: rightEyeVisionText,
    visionOptions: storedExtraVisionOptions,
  };
};

export function isVitalObservation(data: ObservationDTO): data is VitalsObservationDTO {
  return (
    isWeightVitalObservation(data) ||
    isHeightVitalObservation(data) ||
    isTemperatureVitalObservation(data) ||
    isHeartbeatVitalObservation(data) ||
    isBloodPressureVitalObservation(data) ||
    isOxygenSaturationVitalObservation(data) ||
    isRespirationRateVitalObservation(data) ||
    isVisionVitalObservation(data)
  );
}

export function isWeightVitalObservation(data: ObservationDTO): data is VitalsWeightObservationDTO {
  const fieldName = data.field;
  return fieldName === VitalFieldNames.VitalWeight;
}

export function isHeightVitalObservation(data: ObservationDTO): data is VitalsHeightObservationDTO {
  const fieldName = data.field;
  return fieldName === VitalFieldNames.VitalHeight;
}

export function isTemperatureVitalObservation(data: ObservationDTO): data is VitalsTemperatureObservationDTO {
  const fieldName = data.field;
  return fieldName === VitalFieldNames.VitalTemperature;
}

export function isHeartbeatVitalObservation(data: ObservationDTO): data is VitalsHeartbeatObservationDTO {
  const fieldName = data.field;
  return fieldName === VitalFieldNames.VitalHeartbeat;
}

export function isBloodPressureVitalObservation(data: ObservationDTO): data is VitalsBloodPressureObservationDTO {
  const fieldName = data.field;
  return fieldName === VitalFieldNames.VitalBloodPressure;
}

export function isVisionVitalObservation(data: ObservationDTO): data is VitalsVisionObservationDTO {
  const fieldName = data.field;
  return fieldName === VitalFieldNames.VitalVision;
}

export function isRespirationRateVitalObservation(data: ObservationDTO): data is VitalsRespirationRateObservationDTO {
  const fieldName = data.field;
  return fieldName === VitalFieldNames.VitalRespirationRate;
}

export function isOxygenSaturationVitalObservation(data: ObservationDTO): data is VitalsOxygenSatObservationDTO {
  const fieldName = data.field;
  return fieldName === VitalFieldNames.VitalOxygenSaturation;
}

export function toVitalTemperatureObservationMethod(
  value: string | undefined
): VitalTemperatureObservationMethod | undefined {
  if (Object.values(VitalTemperatureObservationMethod).includes(value as VitalTemperatureObservationMethod)) {
    return value as VitalTemperatureObservationMethod;
  }
  return undefined;
}

export function toVitalBloodPressureObservationMethod(
  value: string | undefined
): VitalBloodPressureObservationMethod | undefined {
  if (Object.values(VitalBloodPressureObservationMethod).includes(value as VitalBloodPressureObservationMethod)) {
    return value as VitalBloodPressureObservationMethod;
  }
  return undefined;
}

export function toVitalHeartbeatObservationMethod(
  value: string | undefined
): VitalHeartbeatObservationMethod | undefined {
  if (Object.values(VitalHeartbeatObservationMethod).includes(value as VitalHeartbeatObservationMethod)) {
    return value as VitalHeartbeatObservationMethod;
  }
  return undefined;
}

export function toVitalOxygenSatObservationMethod(
  value: string | undefined
): VitalsOxygenSatObservationMethod | undefined {
  if (Object.values(VitalsOxygenSatObservationMethod).includes(value as VitalsOxygenSatObservationMethod)) {
    return value as VitalsOxygenSatObservationMethod;
  }
  return undefined;
}

export function fillVitalObservationAttributes(baseResource: Observation, vitalDTO: VitalsObservationDTO): Observation {
  if (isTemperatureVitalObservation(vitalDTO)) {
    const temperatureDTO = vitalDTO as VitalsTemperatureObservationDTO;
    return {
      ...baseResource,
      valueQuantity: { value: temperatureDTO.value, system: 'http://unitsofmeasure.org', unit: 'C', code: 'Cel' },
      method: getTempObservationMethodCodable(temperatureDTO),
    };
  }

  if (isHeartbeatVitalObservation(vitalDTO)) {
    const heartbeatDTO = vitalDTO as VitalsHeartbeatObservationDTO;
    return {
      ...baseResource,
      valueQuantity: { value: heartbeatDTO.value, system: 'http://unitsofmeasure.org', unit: 'beats/min' },
      method: getHeartbeatObservationMethodCodable(heartbeatDTO),
    };
  }

  if (isBloodPressureVitalObservation(vitalDTO)) {
    const bloodPressureDTO = vitalDTO as VitalsBloodPressureObservationDTO;
    return {
      ...baseResource,
      component: getBloodPressureObservationComponents(bloodPressureDTO),
      method: getBloodPressureObservationMethodCodable(bloodPressureDTO),
    };
  }

  if (isOxygenSaturationVitalObservation(vitalDTO)) {
    const oxySatDTO = vitalDTO as VitalsOxygenSatObservationDTO;
    return {
      ...baseResource,
      valueQuantity: { value: oxySatDTO.value, system: 'http://unitsofmeasure.org', unit: 'beats/min' },
      method: getOxygenSaturationObservationMethodCodable(oxySatDTO),
    };
  }

  if (isRespirationRateVitalObservation(vitalDTO)) {
    const respirationRateDTO = vitalDTO as VitalsRespirationRateObservationDTO;
    return {
      ...baseResource,
      valueQuantity: { value: respirationRateDTO.value, system: 'http://unitsofmeasure.org', unit: 'respirations/min' },
    };
  }

  if (isWeightVitalObservation(vitalDTO)) {
    const weightDTO = vitalDTO as VitalsWeightObservationDTO;
    return {
      ...baseResource,
      code: { coding: [{ system: LOINC_SYSTEM, code: '29463-7', display: 'Body weight' }] },
      valueQuantity: { value: weightDTO.value, system: 'http://unitsofmeasure.org', unit: 'kg' },
    };
  }

  if (isHeightVitalObservation(vitalDTO)) {
    const heightDTO = vitalDTO as VitalsHeightObservationDTO;
    return {
      ...baseResource,
      code: { coding: [{ system: LOINC_SYSTEM, code: '8302-2', display: 'Body height' }] },
      valueQuantity: { value: heightDTO.value, system: 'http://unitsofmeasure.org', unit: 'cm' },
    };
  }

  if (isVisionVitalObservation(vitalDTO)) {
    const visionDTO = vitalDTO as VitalsVisionObservationDTO;
    return {
      ...baseResource,
      component: getVisionObservationComponents(visionDTO),
    };
  }

  //TODO: is it ok to throw error in this case ?
  throw new Error('fillVitalObservationAttributes() unknown VitalsObservationDTO type');
}

export function makeVitalsObservationDTO(observation: Observation): VitalsObservationDTO | undefined {
  const fieldName = observation.meta?.tag?.[0].code as VitalFieldNames;
  if (!fieldName) return;
  if (!Object.values(VitalFieldNames).includes(fieldName)) return;

  const resourceIdVal = observation.id;
  const patientIdVal = observation.subject?.reference?.split('/')[1] ?? '';
  const encounterIdVal = observation.encounter?.reference?.split('/')[1] ?? '';
  const authorIdVal = observation.performer?.at(0)?.reference?.split('/')?.[1];
  const lastUpdatedVal = observation.effectiveDateTime;

  const baseProps: Partial<VitalsBaseObservationDTO> = {
    resourceId: resourceIdVal,
    patientId: patientIdVal,
    encounterId: encounterIdVal,
    authorId: authorIdVal,
    lastUpdated: lastUpdatedVal,
  };

  if (fieldName === VitalFieldNames.VitalTemperature) {
    const obsNumericalValue = observation.valueQuantity?.value ?? 0;
    const result: VitalsTemperatureObservationDTO = {
      ...baseProps,
      field: VitalFieldNames.VitalTemperature,
      value: obsNumericalValue,
      observationMethod: extractTemperatureObservationMethod(observation),
    };
    return result;
  }

  if (fieldName === VitalFieldNames.VitalHeartbeat) {
    const obsNumericalValue = observation.valueQuantity?.value ?? 0;
    const result: VitalsHeartbeatObservationDTO = {
      ...baseProps,
      field: VitalFieldNames.VitalHeartbeat,
      value: obsNumericalValue,
      observationMethod: extractHeartbeatObservationMethod(observation),
    };
    return result;
  }

  if (fieldName === VitalFieldNames.VitalBloodPressure) {
    const bloodPressures = extractBloodPressureValues(observation.component ?? []);
    const result: VitalsBloodPressureObservationDTO = {
      ...baseProps,
      field: VitalFieldNames.VitalBloodPressure,
      systolicPressure: bloodPressures.systolicPressureValue ?? 0,
      diastolicPressure: bloodPressures.diastolicPressureValue ?? 0,
      observationMethod: extractBloodPressureObservationMethod(observation),
    };
    return result;
  }

  if (fieldName === VitalFieldNames.VitalOxygenSaturation) {
    const obsNumericalValue = observation.valueQuantity?.value ?? 0;
    const result: VitalsOxygenSatObservationDTO = {
      ...baseProps,
      field: VitalFieldNames.VitalOxygenSaturation,
      value: obsNumericalValue,
      observationMethod: extractOxySaturationObservationMethod(observation),
    };
    return result;
  }

  if (fieldName === VitalFieldNames.VitalRespirationRate) {
    const obsNumericalValue = observation.valueQuantity?.value ?? 0;
    const result: VitalsRespirationRateObservationDTO = {
      ...baseProps,
      field: VitalFieldNames.VitalRespirationRate,
      value: obsNumericalValue,
    };
    return result;
  }

  if (fieldName === VitalFieldNames.VitalWeight) {
    const obsNumericalValue = observation.valueQuantity?.value ?? 0;
    const result: VitalsWeightObservationDTO = {
      ...baseProps,
      field: VitalFieldNames.VitalWeight,
      value: obsNumericalValue,
    };
    return result;
  }

  if (fieldName === VitalFieldNames.VitalHeight) {
    const obsNumericalValue = observation.valueQuantity?.value ?? 0;
    const result: VitalsHeightObservationDTO = {
      ...baseProps,
      field: VitalFieldNames.VitalHeight,
      value: obsNumericalValue,
    };
    return result;
  }

  if (fieldName === VitalFieldNames.VitalVision) {
    const visionValues = extractVisionValues(observation.component ?? []);
    const result: VitalsVisionObservationDTO = {
      ...baseProps,
      field: VitalFieldNames.VitalVision,
      leftEyeVisionText: visionValues.leftEyeVisText ?? '',
      rightEyeVisionText: visionValues.rightEyeVisText ?? '',
      extraVisionOptions: visionValues.visionOptions,
    };
    return result;
  }

  return undefined;
}
