import { Observation, Practitioner } from 'fhir/r4b';
import {
  VitalFieldNames,
  VitalsOxygenSatObservationMethod,
  VitalsSupplementalO2DeliveryType,
} from 'utils/lib/types/api/chart-data/chart-data.constants';
import {
  PATIENT_VITALS_META_SYSTEM,
  VitalsOxygenSatObservationDTO,
} from 'utils/lib/types/api/chart-data/chart-data.types';
import { describe, expect, it } from 'vitest';
import { makeObservationResource } from '../../src/shared/chart-data';
import { parseVitalsObservationsToDTOs } from '../../src/shared/vitals/parse-vitals-observations';

const practitioner: Practitioner = {
  resourceType: 'Practitioner',
  id: 'practitioner-1',
  name: [{ given: ['Samanta'], family: 'Brooks' }],
};

// Saved through the chart's real writer, then read back the way the tracking board and encounter lists read it.
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

describe('parseVitalsObservationsToDTOs — SpO2 supplemental O2 details', () => {
  it('reads the details back with the reading', () => {
    const [dto] = parseVitalsObservationsToDTOs(
      [
        saved({
          field: VitalFieldNames.VitalOxygenSaturation,
          value: 91,
          observationMethod: VitalsOxygenSatObservationMethod.OnSupplementalO2,
          supplementalO2: { flowRate: 4.5, deliveryType: VitalsSupplementalO2DeliveryType.NasalCannula },
        }),
      ],
      [practitioner],
      undefined
    );

    expect(dto).toMatchObject({
      field: VitalFieldNames.VitalOxygenSaturation,
      value: 91,
      observationMethod: VitalsOxygenSatObservationMethod.OnSupplementalO2,
      supplementalO2: { flowRate: 4.5, deliveryType: VitalsSupplementalO2DeliveryType.NasalCannula },
    });
  });

  it('reads a reading without details as before', () => {
    const [dto] = parseVitalsObservationsToDTOs(
      [
        saved({
          field: VitalFieldNames.VitalOxygenSaturation,
          value: 97,
          observationMethod: VitalsOxygenSatObservationMethod.OnRoomAir,
        }),
      ],
      [practitioner],
      undefined
    );

    expect(dto).toMatchObject({ value: 97, observationMethod: VitalsOxygenSatObservationMethod.OnRoomAir });
    expect(dto.field === VitalFieldNames.VitalOxygenSaturation && dto.supplementalO2).toBeUndefined();
  });
});
