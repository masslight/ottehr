import { GetVitalsResponseData, VitalFieldNames, VitalsObservationDTO } from '../../types';

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
