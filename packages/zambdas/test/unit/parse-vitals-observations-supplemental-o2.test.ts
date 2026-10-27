import { Observation, Practitioner } from 'fhir/r4b';
import { vitalsConfig } from 'utils/lib/helpers/vitals/config-schema';
import {
  VitalFieldNames,
  VitalsOxygenSatObservationMethod,
  VitalsSupplementalO2DeliveryType,
} from 'utils/lib/types/api/chart-data/chart-data.constants';
import {
  PATIENT_VITALS_META_SYSTEM,
  VitalsObservationDTO,
  VitalsOxygenSatObservationDTO,
} from 'utils/lib/types/api/chart-data/chart-data.types';
import { describe, expect, it } from 'vitest';
import { parseResourcesToDTOs } from '../../src/ehr/chart-data/vitals/get/index';
import { makeObservationResource } from '../../src/shared/chart-data';
import { parseVitalsObservationsToDTOs } from '../../src/shared/vitals/parse-vitals-observations';

const practitioner: Practitioner = {
  resourceType: 'Practitioner',
  id: 'practitioner-1',
  name: [{ given: ['Samanta'], family: 'Brooks' }],
};

// Saved through the chart's real writer, then read back by each SpO2 reader.
const saved = (dto: VitalsOxygenSatObservationDTO): Observation => ({
  ...makeObservationResource(
    'encounter-1',
    'patient-1',
    'practitioner-1',
    undefined,
    dto,
    PATIENT_VITALS_META_SYSTEM,
    undefined,
    undefined,
    undefined
  ),
  id: 'observation-1',
});

// get-vitals (vitals screen, progress note) and the shared parser (tracking board, encounter lists).
const readers: [string, (observations: Observation[]) => VitalsObservationDTO[]][] = [
  [
    'get-vitals',
    (observations) =>
      parseResourcesToDTOs(observations, [practitioner], {
        patientDOB: undefined,
        patientSex: undefined,
        vitalsAlertConfig: vitalsConfig,
      }),
  ],
  [
    'the shared vitals parser',
    (observations) => parseVitalsObservationsToDTOs(observations, [practitioner], undefined),
  ],
];

describe.each(readers)('%s — SpO2 supplemental O2 details', (_name, read) => {
  it('reads the details back with the reading', () => {
    const [dto] = read([
      saved({
        field: VitalFieldNames.VitalOxygenSaturation,
        value: 91,
        observationMethod: VitalsOxygenSatObservationMethod.OnSupplementalO2,
        supplementalO2: {
          flowRate: 4.5,
          deliveryType: VitalsSupplementalO2DeliveryType.Other,
          deliveryTypeOther: 'Face tent',
        },
      }),
    ]);

    expect(dto).toMatchObject({
      field: VitalFieldNames.VitalOxygenSaturation,
      value: 91,
      observationMethod: VitalsOxygenSatObservationMethod.OnSupplementalO2,
      supplementalO2: {
        flowRate: 4.5,
        deliveryType: VitalsSupplementalO2DeliveryType.Other,
        deliveryTypeOther: 'Face tent',
      },
    });
  });

  it('reads a reading without details as before', () => {
    const [dto] = read([
      saved({
        field: VitalFieldNames.VitalOxygenSaturation,
        value: 97,
        observationMethod: VitalsOxygenSatObservationMethod.OnRoomAir,
      }),
    ]);

    expect(dto).toMatchObject({ value: 97, observationMethod: VitalsOxygenSatObservationMethod.OnRoomAir });
    expect(dto.field === VitalFieldNames.VitalOxygenSaturation && dto.supplementalO2).toBeUndefined();
  });
});
