import { Observation } from 'fhir/r4b';
import { describe, expect, it } from 'vitest';
import { mapVitalsToDisplay } from '../helpers/visit-note/map-vitals-to-display.helper';
import { formatOxygenSatObservationMethod } from '../helpers/vitals/vitals-oxygen-saturation.helper';
import {
  VitalFieldNames,
  VitalsOxygenSatObservationMethod,
  VitalsSupplementalO2DeliveryType,
} from '../types/api/chart-data/chart-data.constants';
import { VitalsOxygenSatObservationDTO, VitalsSupplementalO2Details } from '../types/api/chart-data/chart-data.types';
import {
  fillVitalObservationAttributes,
  LOINC_SYSTEM,
  makeVitalsObservationDTO,
  VITAL_OXY_SATURATION_FLOW_RATE_LOINC_CODE,
  VITAL_OXY_SATURATION_OBS_METHOD_CODE_SUPPLEMENTAL_O2,
  VITAL_OXY_SATURATION_SUPPLEMENTAL_O2_LOCAL_SYSTEM,
} from './vitals';

const { OnRoomAir, OnSupplementalO2 } = VitalsOxygenSatObservationMethod;

// The Observation skeleton the chart-data save path builds before fillVitalObservationAttributes() fills it in.
const makeBaseObservation = (): Observation => ({
  resourceType: 'Observation',
  status: 'final',
  code: { text: VitalFieldNames.VitalOxygenSaturation },
  subject: { reference: 'Patient/patient-1' },
  encounter: { reference: 'Encounter/encounter-1' },
  performer: [{ reference: 'Practitioner/practitioner-1' }],
  effectiveDateTime: '2026-10-27T13:18:00.000Z',
  meta: { tag: [{ code: VitalFieldNames.VitalOxygenSaturation }] },
});

const makeDTO = (
  observationMethod: VitalsOxygenSatObservationMethod | undefined,
  supplementalO2?: VitalsSupplementalO2Details
): VitalsOxygenSatObservationDTO => ({
  field: VitalFieldNames.VitalOxygenSaturation,
  value: 91,
  observationMethod,
  supplementalO2,
});

// Runs a DTO through the real save (fillVitalObservationAttributes) and read (makeVitalsObservationDTO) paths.
const roundTrip = (
  dto: VitalsOxygenSatObservationDTO
): { observation: Observation; parsed: VitalsOxygenSatObservationDTO } => {
  const observation = fillVitalObservationAttributes(makeBaseObservation(), dto, undefined, undefined);
  const parsed = makeVitalsObservationDTO(observation);
  if (parsed?.field !== VitalFieldNames.VitalOxygenSaturation) throw new Error('expected an SpO2 DTO');
  return { observation, parsed };
};

describe('supplemental O2 details — FHIR round trip', () => {
  it.each<[string, VitalsSupplementalO2Details]>([
    ['flow rate only', { flowRate: 2 }],
    ['type only', { deliveryType: VitalsSupplementalO2DeliveryType.SimpleFaceMask }],
    ['both', { flowRate: 4.5, deliveryType: VitalsSupplementalO2DeliveryType.NasalCannula }],
    ['a decimal flow rate', { flowRate: 0.25 }],
    ['a zero flow rate, which is a recorded value rather than an empty one', { flowRate: 0 }],
  ])('preserves %s', (_label, supplementalO2) => {
    expect(roundTrip(makeDTO(OnSupplementalO2, supplementalO2)).parsed.supplementalO2).toEqual(supplementalO2);
  });

  it.each(Object.values(VitalsSupplementalO2DeliveryType))('preserves the %s type', (deliveryType) => {
    const { parsed } = roundTrip(makeDTO(OnSupplementalO2, { flowRate: 6, deliveryType }));
    expect(parsed.observationMethod).toBe(OnSupplementalO2);
    expect(parsed.supplementalO2).toEqual({ flowRate: 6, deliveryType });
  });

  it('preserves the Other text, trimmed', () => {
    const { parsed } = roundTrip(
      makeDTO(OnSupplementalO2, {
        deliveryType: VitalsSupplementalO2DeliveryType.Other,
        deliveryTypeOther: '  High-flow face tent ',
      })
    );
    expect(parsed.supplementalO2).toEqual({
      deliveryType: VitalsSupplementalO2DeliveryType.Other,
      deliveryTypeOther: 'High-flow face tent',
    });
  });

  it('keeps Other without a description when the text is blank', () => {
    const { parsed } = roundTrip(
      makeDTO(OnSupplementalO2, { deliveryType: VitalsSupplementalO2DeliveryType.Other, deliveryTypeOther: '   ' })
    );
    expect(parsed.supplementalO2).toEqual({ deliveryType: VitalsSupplementalO2DeliveryType.Other });
  });

  it('saves supplemental O2 with neither detail exactly like before', () => {
    const { observation, parsed } = roundTrip(makeDTO(OnSupplementalO2, {}));
    expect(observation.component).toBeUndefined();
    expect(observation.method?.coding?.[0]?.code).toBe(VITAL_OXY_SATURATION_OBS_METHOD_CODE_SUPPLEMENTAL_O2);
    expect(parsed.supplementalO2).toBeUndefined();
  });

  it('records the flow rate as the US Core inhaled O2 flow rate component in L/min', () => {
    const { observation } = roundTrip(makeDTO(OnSupplementalO2, { flowRate: 4.5 }));
    expect(observation.component).toEqual([
      {
        code: {
          coding: [
            {
              system: LOINC_SYSTEM,
              code: VITAL_OXY_SATURATION_FLOW_RATE_LOINC_CODE,
              display: 'Inhaled oxygen flow rate',
            },
          ],
        },
        valueQuantity: { value: 4.5, unit: 'L/min', system: 'http://unitsofmeasure.org', code: 'L/min' },
      },
    ]);
  });

  it('leaves the SpO2 value, unit and qualifier encoding untouched', () => {
    const withDetails = roundTrip(makeDTO(OnSupplementalO2, { flowRate: 3 })).observation;
    const without = roundTrip(makeDTO(OnSupplementalO2)).observation;
    expect(withDetails.valueQuantity).toEqual(without.valueQuantity);
    expect(withDetails.method).toEqual(without.method);
  });
});

describe('supplemental O2 details — stale and invalid values', () => {
  it('does not persist details left behind on another qualifier', () => {
    const { observation, parsed } = roundTrip(
      makeDTO(OnRoomAir, { flowRate: 4, deliveryType: VitalsSupplementalO2DeliveryType.VenturiMask })
    );
    expect(observation.component).toBeUndefined();
    expect(parsed).toMatchObject({ value: 91, observationMethod: OnRoomAir });
    expect(parsed.supplementalO2).toBeUndefined();
  });

  it('does not persist details without a qualifier', () => {
    expect(roundTrip(makeDTO(undefined, { flowRate: 4 })).observation.component).toBeUndefined();
  });

  it('does not persist Other text once the type is no longer Other', () => {
    const { observation, parsed } = roundTrip(
      makeDTO(OnSupplementalO2, {
        deliveryType: VitalsSupplementalO2DeliveryType.TracheostomyCollar,
        deliveryTypeOther: 'stale text',
      })
    );
    expect(JSON.stringify(observation)).not.toContain('stale text');
    expect(parsed.supplementalO2).toEqual({ deliveryType: VitalsSupplementalO2DeliveryType.TracheostomyCollar });
  });

  it('does not persist a negative flow rate', () => {
    expect(roundTrip(makeDTO(OnSupplementalO2, { flowRate: -1 })).observation.component).toBeUndefined();
  });

  it('ignores details stored on an observation whose qualifier is not supplemental O2', () => {
    const { observation } = roundTrip(makeDTO(OnSupplementalO2, { flowRate: 4 }));
    const roomAirObservation = makeVitalsObservationDTO({
      ...observation,
      method: roundTrip(makeDTO(OnRoomAir)).observation.method,
    });
    expect(roomAirObservation).toMatchObject({ observationMethod: OnRoomAir, supplementalO2: undefined });
  });

  it('ignores a delivery type it does not recognize', () => {
    const { observation } = roundTrip(
      makeDTO(OnSupplementalO2, { flowRate: 2, deliveryType: VitalsSupplementalO2DeliveryType.NasalCannula })
    );
    const parsed = makeVitalsObservationDTO({
      ...observation,
      component: observation.component?.map((cmp) =>
        cmp.code.coding?.[0]?.system === VITAL_OXY_SATURATION_SUPPLEMENTAL_O2_LOCAL_SYSTEM
          ? { ...cmp, valueString: 'Hyperbaric chamber' }
          : cmp
      ),
    });
    expect(parsed).toMatchObject({ supplementalO2: { flowRate: 2 } });
  });
});

describe('supplemental O2 details — legacy records', () => {
  it('reads a supplemental O2 reading saved before the details existed', () => {
    const legacy: Observation = {
      ...makeBaseObservation(),
      valueQuantity: { value: 94, system: 'http://unitsofmeasure.org', unit: 'beats/min' },
      method: {
        coding: [
          {
            system: 'http://snomed.info/sct',
            code: VITAL_OXY_SATURATION_OBS_METHOD_CODE_SUPPLEMENTAL_O2,
            display: 'Oxygen saturation with supplemental oxygen',
          },
        ],
      },
    };
    const parsed = makeVitalsObservationDTO(legacy);
    expect(parsed).toMatchObject({ value: 94, observationMethod: OnSupplementalO2 });
    expect(parsed?.field === VitalFieldNames.VitalOxygenSaturation && parsed.supplementalO2).toBeUndefined();
    expect(parsed && mapVitalsToDisplay([parsed], false)).toEqual({
      [VitalFieldNames.VitalOxygenSaturation]: ['94% (On supplemental O2)'],
    });
  });
});

describe('formatOxygenSatObservationMethod', () => {
  it.each<[string, VitalsOxygenSatObservationDTO, string | undefined]>([
    ['no qualifier', makeDTO(undefined), undefined],
    ['room air', makeDTO(OnRoomAir), 'On room air'],
    ['supplemental O2 without details', makeDTO(OnSupplementalO2), 'On supplemental O2'],
    ['a flow rate only', makeDTO(OnSupplementalO2, { flowRate: 4.5 }), 'On supplemental O2 - 4.5 L/min'],
    ['a zero flow rate', makeDTO(OnSupplementalO2, { flowRate: 0 }), 'On supplemental O2 - 0 L/min'],
    [
      'a type only',
      makeDTO(OnSupplementalO2, { deliveryType: VitalsSupplementalO2DeliveryType.NonRebreatherMask }),
      'On supplemental O2 - Non-Rebreather Mask',
    ],
    [
      'both details',
      makeDTO(OnSupplementalO2, { flowRate: 4.5, deliveryType: VitalsSupplementalO2DeliveryType.NasalCannula }),
      'On supplemental O2 - 4.5 L/min - Nasal Cannula',
    ],
    [
      'Other with a description',
      makeDTO(OnSupplementalO2, {
        flowRate: 10,
        deliveryType: VitalsSupplementalO2DeliveryType.Other,
        deliveryTypeOther: 'Face tent',
      }),
      'On supplemental O2 - 10 L/min - Other: Face tent',
    ],
    [
      'Other without a description',
      makeDTO(OnSupplementalO2, { deliveryType: VitalsSupplementalO2DeliveryType.Other, deliveryTypeOther: ' ' }),
      'On supplemental O2 - Other',
    ],
    ['stale details on room air', makeDTO(OnRoomAir, { flowRate: 3 }), 'On room air'],
  ])('formats %s', (_label, dto, expected) => {
    expect(formatOxygenSatObservationMethod(dto)).toBe(expected);
  });
});

describe('mapVitalsToDisplay — SpO2', () => {
  it('shows the supplemental O2 details after the reading, with and without the time', () => {
    const dto: VitalsOxygenSatObservationDTO = {
      ...makeDTO(OnSupplementalO2, { flowRate: 4.5, deliveryType: VitalsSupplementalO2DeliveryType.NasalCannula }),
      value: 98,
      lastUpdated: '2024-04-28T17:18:00.000Z',
    };
    expect(mapVitalsToDisplay([dto], false)?.[VitalFieldNames.VitalOxygenSaturation]).toEqual([
      '98% (On supplemental O2 - 4.5 L/min - Nasal Cannula)',
    ]);
    expect(mapVitalsToDisplay([dto], true, 'America/New_York')?.[VitalFieldNames.VitalOxygenSaturation]).toEqual([
      expect.stringMatching(/^\S.* - 98% \(On supplemental O2 - 4\.5 L\/min - Nasal Cannula\)$/),
    ]);
  });

  it('keeps room air and unqualified readings as before', () => {
    expect(
      mapVitalsToDisplay([makeDTO(OnRoomAir), makeDTO(undefined)], false)?.[VitalFieldNames.VitalOxygenSaturation]
    ).toEqual(['91% (On room air)', '91%']);
  });
});
