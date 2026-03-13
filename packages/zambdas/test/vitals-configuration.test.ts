import { randomUUID } from 'crypto';
import { Patient } from 'fhir/r4b';
import { DateTime } from 'luxon';
import {
  DefaultVitalsConfig,
  DOB_DATE_FORMAT,
  getVitalObservationAlertLevel,
  VitalAlertCriticality,
  VitalFieldNames,
  VitalsBloodPressureObservationDTO,
  VitalsDef,
  VitalsHeartbeatObservationDTO,
  VitalsRespirationRateObservationDTO,
  VitalsSchema,
  VitalsTemperatureObservationDTO,
  VitalsWeightObservationDTO,
} from 'utils';
import { assert, suite } from 'vitest';
import InvalidAgeUnitsVitals from './data/config-files/vitals-invalid-age-units-spec';
import InvalidAgeVitals from './data/config-files/vitals-invalid-ages-spec';
import InvalidBloodPressureShapeVitals from './data/config-files/vitals-invalid-bp-shape-spec';
import InvalidMinMaxValVitals from './data/config-files/vitals-invalid-min-max-val-spec';
import InvalidRuleTypeVitals from './data/config-files/vitals-invalid-rule-type-spec';
import { makeTestPatient } from './helpers/testScheduleUtils';

describe('testing vitals config validation', () => {
  const makeTestPatientWithAge = (patientAge?: { units: 'years' | 'months'; value: number }): Patient => {
    const partialPatient: Partial<Patient> = {
      id: randomUUID(),
    };
    if (patientAge) {
      const now = DateTime.now();
      const birthDate = now.minus({ [patientAge.units]: patientAge.value });
      partialPatient.birthDate = birthDate.toFormat(DOB_DATE_FORMAT);
    }
    const testPatient = makeTestPatient(partialPatient);
    expect(testPatient).toBeDefined();
    return testPatient;
  };

  suite('invalid config files are rejected by validation layer', () => {
    test.concurrent('min age greater than max age on some alert threshold causes parsing failure', async () => {
      try {
        const _vitals = VitalsDef(InvalidAgeVitals);
        expect(_vitals).toBeUndefined();
      } catch (error) {
        expect(error).toBeDefined();
        const errorObject = JSON.parse((error as any).message);
        expect(errorObject).toBeDefined();
        expect(typeof errorObject).toBe('object');
        expect(Array.isArray(errorObject)).toBe(true);
        const firstError = errorObject[0];
        expect(firstError).toBeDefined();
        expect(typeof firstError).toBe('object');
        expect(firstError.message).toBeDefined();
        expect(firstError.message).toBe('minAge must be less than or equal to maxAge in an alert threshold');
        expect(firstError.path).toBeDefined();
        expect(firstError.path).toEqual([
          'vital-blood-pressure',
          'components',
          'systolic-pressure',
          'alertThresholds',
          0,
        ]);
      }
    });
    test.concurrent('min value greater than max value on some alert threshold causes parsing failure', async () => {
      try {
        const _vitals = VitalsDef(InvalidMinMaxValVitals);
        expect(_vitals).toBeUndefined();
      } catch (error) {
        expect(error).toBeDefined();
        const errorObject = JSON.parse((error as any).message);
        expect(errorObject).toBeDefined();
        expect(typeof errorObject).toBe('object');
        expect(Array.isArray(errorObject)).toBe(true);
        const firstError = errorObject[0];
        expect(firstError).toBeDefined();
        expect(typeof firstError).toBe('object');
        expect(firstError.message).toBeDefined();
        expect(firstError.message).toBe('Conflicting rules found');
        expect(firstError.path).toBeDefined();
        expect(firstError.path).toEqual(['vital-heartbeat', 'alertThresholds', 0, 'rules']);
      }
    });
    test.concurrent('invalid rule types in alert thresholds cause parsing failure', async () => {
      try {
        const _vitals = VitalsDef(InvalidRuleTypeVitals);
        expect(_vitals).toBeUndefined();
      } catch (error) {
        expect(error).toBeDefined();
        const errorObject = JSON.parse((error as any).message);
        expect(errorObject).toBeDefined();
        expect(typeof errorObject).toBe('object');
        expect(Array.isArray(errorObject)).toBe(true);
        const firstError = errorObject[0];
        expect(firstError).toBeDefined();
        expect(typeof firstError).toBe('object');
        expect(firstError.message).toBeDefined();
        expect(firstError.message).toBe('Invalid input');
        expect(firstError.path).toBeDefined();
        expect(firstError.path).toEqual(['vital-heartbeat', 'alertThresholds', 0, 'rules', 0]);
        const secondError = errorObject[1];
        expect(secondError).toBeDefined();
        expect(typeof secondError).toBe('object');
        expect(secondError.message).toBeDefined();
        expect(secondError.message).toBe('Invalid input');
        expect(secondError.path).toBeDefined();
        expect(secondError.path).toEqual(['vital-heartbeat', 'alertThresholds', 0, 'rules', 1]);
      }
    });
    test.concurrent('invalid unit supplied on min/maxAge fails to parse', async () => {
      try {
        const _vitals = VitalsDef(InvalidAgeUnitsVitals);
        expect(_vitals).toBeUndefined();
      } catch (error) {
        expect(error).toBeDefined();
        const errorObject = JSON.parse((error as any).message);
        expect(errorObject).toBeDefined();
        expect(typeof errorObject).toBe('object');
        expect(Array.isArray(errorObject)).toBe(true);
        const firstError = errorObject[0];
        expect(firstError).toBeDefined();
        expect(typeof firstError).toBe('object');
        expect(firstError.message).toBeDefined();
        expect(firstError.message).toBe("Invalid enum value. Expected 'years' | 'months' | 'days', received 'decades'");
        expect(firstError.path).toBeDefined();
        expect(firstError.path).toEqual(['vital-heartbeat', 'alertThresholds', 0, 'minAge', 'unit']);
      }
    });
    test.concurrent(
      'alertThresholds supplied on blood pressure and not nested in components fails to parse',
      async () => {
        try {
          const _vitals = VitalsDef(InvalidBloodPressureShapeVitals);
          expect(_vitals).toBeUndefined();
        } catch (error) {
          expect(error).toBeDefined();
          const errorObject = JSON.parse((error as any).message);
          expect(errorObject).toBeDefined();
          expect(typeof errorObject).toBe('object');
          expect(Array.isArray(errorObject)).toBe(true);
          const firstError = errorObject[0];
          expect(firstError).toBeDefined();
          expect(typeof firstError).toBe('object');
          expect(firstError.message).toBeDefined();
          expect(firstError.message).toBe('vital-blood-pressure object may only define components');
          expect(firstError.path).toBeDefined();
          expect(firstError.path).toEqual(['vital-blood-pressure']);
        }
      }
    );
  });
  suite('valid config files customize various behavior per expectations', () => {
    beforeAll(() => {
      const defaultVitalsDef = VitalsDef();
      expect(defaultVitalsDef).toBeDefined();
      assert(defaultVitalsDef);
    });
    test.concurrent('setting critical alert thresholds and evaluating', async () => {
      const updatedChart = mutateVitals(
        [
          {
            path: ['vital-heartbeat', 'alertThresholds', 0, 'rules', 0],
            value: { criticality: 'critical', value: 80, type: 'min' },
          },
          {
            path: ['vital-temperature', 'alertThresholds', 0, 'rules', 0],
            value: { criticality: 'abnormal', value: 36.5, type: 'min' },
          },
          {
            path: ['vital-heartbeat', 'alertThresholds', 0, 'minAge'],
            value: { unit: 'years', value: 0 },
          },
          {
            path: ['vital-heartbeat', 'alertThresholds', 0, 'maxAge'],
            value: { unit: 'years', value: 1 },
          },
          {
            path: ['vital-temperature', 'alertThresholds', 0, 'minAge'],
            value: { unit: 'years', value: 0 },
          },
          {
            path: ['vital-temperature', 'alertThresholds', 0, 'maxAge'],
            value: { unit: 'years', value: 1 },
          },
          {
            path: ['vital-heartbeat', 'alertThresholds', 0, 'rules', 1],
            value: { value: 210, type: 'max', criticality: 'critical' },
          },
          {
            path: ['vital-temperature', 'alertThresholds', 0, 'rules', 1],
            value: { value: 33, type: 'min', criticality: 'abnormal' },
          },
          {
            path: ['vital-temperature', 'alertThresholds', 0, 'rules', 1],
            value: { value: 39, type: 'max', criticality: 'abnormal' },
          },
        ],
        DefaultVitalsConfig
      );
      const vitals = VitalsDef(updatedChart);
      expect(vitals).toBeDefined();
      // some sanity checks to make sure the rules were updated
      const heartbeatRules = vitals['vital-heartbeat']?.alertThresholds?.[0]?.rules;
      expect(heartbeatRules).toBeDefined();
      heartbeatRules?.forEach((rule) => {
        expect(rule.criticality).toBe('critical');
      });
      const temperatureRules = vitals['vital-temperature']?.alertThresholds?.[0]?.rules;
      expect(temperatureRules).toBeDefined();
      temperatureRules?.forEach((rule) => {
        expect(rule.criticality).toBe('abnormal');
      });
      // make a patient with age 0-1 years
      const testPatient = makeTestPatientWithAge({ units: 'years', value: 0.5 });
      expect(testPatient).toBeDefined();
      const patientDOB = testPatient.birthDate;
      expect(patientDOB).toBeDefined();
      assert(patientDOB);

      const alertingHighHeartbeat: VitalsHeartbeatObservationDTO = {
        patientId: testPatient.id,
        field: VitalFieldNames.VitalHeartbeat,
        value: 211,
        resourceId: randomUUID(),
      };
      const highObservationCriticality = getVitalObservationAlertLevel({
        patientDOB,
        patientSex: testPatient.gender,
        vitalsObservation: alertingHighHeartbeat,
        configOverride: updatedChart,
      });
      expect(highObservationCriticality).toBe('critical');
      const alertingLowHeartbeat: VitalsHeartbeatObservationDTO = {
        patientId: testPatient.id,
        field: VitalFieldNames.VitalHeartbeat,
        value: 79,
        resourceId: randomUUID(),
      };
      const lowObservationCriticality = getVitalObservationAlertLevel({
        patientDOB,
        vitalsObservation: alertingLowHeartbeat,
        configOverride: updatedChart,
        patientSex: testPatient.gender,
      });
      expect(lowObservationCriticality).toBe('critical');
      const nonAlertingHeartbeat: VitalsHeartbeatObservationDTO = {
        patientId: testPatient.id,
        field: VitalFieldNames.VitalHeartbeat,
        value: 109, // this was 100, which caused an alert
        resourceId: randomUUID(),
      };
      const nonAlertingHeartbeatCriticality = getVitalObservationAlertLevel({
        patientDOB,
        vitalsObservation: nonAlertingHeartbeat,
        configOverride: updatedChart,
        patientSex: testPatient.gender,
      });
      expect(nonAlertingHeartbeatCriticality).toBeUndefined();

      const alertingHighTemperature: VitalsTemperatureObservationDTO = {
        patientId: testPatient.id,
        field: VitalFieldNames.VitalTemperature,
        value: 40,
        resourceId: randomUUID(),
      };
      const highTemperatureCriticality = getVitalObservationAlertLevel({
        patientDOB,
        vitalsObservation: alertingHighTemperature,
        configOverride: updatedChart,
        patientSex: testPatient.gender,
      });
      expect(highTemperatureCriticality).toBe('abnormal');

      const alertingLowTemperature: VitalsTemperatureObservationDTO = {
        patientId: testPatient.id,
        field: VitalFieldNames.VitalTemperature,
        value: 32,
        resourceId: randomUUID(),
      };
      const lowTemperatureCriticality = getVitalObservationAlertLevel({
        patientDOB,
        vitalsObservation: alertingLowTemperature,
        configOverride: updatedChart,
        patientSex: testPatient.gender,
      });
      expect(lowTemperatureCriticality).toBe('abnormal');
      const nonAlertingTemperature: VitalsTemperatureObservationDTO = {
        patientId: testPatient.id,
        field: VitalFieldNames.VitalTemperature,
        value: 36.6,
        resourceId: randomUUID(),
      };
      const nonAlertingTemperatureCriticality = getVitalObservationAlertLevel({
        patientDOB,
        vitalsObservation: nonAlertingTemperature,
        configOverride: updatedChart,
        patientSex: testPatient.gender,
      });
      expect(nonAlertingTemperatureCriticality).toBeUndefined();
    });
  });
  test.concurrent(
    'setting critical alert thresholds and evaluating on vitals with components (blood pressure)',
    async () => {
      const updatedChart = mutateVitals(
        [
          {
            path: ['vital-blood-pressure', 'components', 'systolic-pressure', 'alertThresholds', 0],
            value: {
              rules: [{ criticality: 'critical', type: 'min', value: 90 }],
              minAge: { unit: 'years', value: 2 },
              maxAge: { unit: 'years', value: 4 },
            },
          },
        ],
        DefaultVitalsConfig
      );
      const vitals = VitalsDef(updatedChart);
      expect(vitals).toBeDefined();
      // some sanity checks to make sure the rules were updated
      const systolicPressureRules =
        vitals['vital-blood-pressure']?.components?.['systolic-pressure']?.alertThresholds?.[0]?.rules;
      expect(systolicPressureRules).toBeDefined();
      assert(systolicPressureRules);
      expect(systolicPressureRules[0].criticality).toBe('critical');

      const testPatient = makeTestPatientWithAge({ units: 'months', value: 3 * 12 });
      expect(testPatient).toBeDefined();
      const patientDOB = testPatient.birthDate;
      expect(patientDOB).toBeDefined();
      assert(patientDOB);

      const alertingLowSystolicBloodPressure: VitalsBloodPressureObservationDTO = {
        patientId: testPatient.id,
        field: VitalFieldNames.VitalBloodPressure,
        systolicPressure: 89.8,
        diastolicPressure: 70, // this should alert as well, but the overall criticality should be determined by the systolic pressure
        resourceId: randomUUID(),
      };
      const lowBPHighCriticality = getVitalObservationAlertLevel({
        patientDOB,
        vitalsObservation: alertingLowSystolicBloodPressure,
        configOverride: updatedChart,
        patientSex: testPatient.gender,
      });
      expect(lowBPHighCriticality).toBe('critical');

      const updatedChart2 = mutateVitals(
        [
          {
            path: ['vital-blood-pressure', 'components', 'diastolic-pressure'],
            value: {
              alertThresholds: [
                {
                  rules: [{ criticality: 'abnormal', type: 'min', value: 80 }],
                  minAge: { unit: 'years', value: 2 },
                  maxAge: { unit: 'years', value: 4 },
                },
              ],
            },
          },
        ],
        DefaultVitalsConfig
      );
      const vitals2 = VitalsDef(updatedChart2);
      expect(vitals2).toBeDefined();
      const diastolicPressureRules =
        vitals2['vital-blood-pressure']?.components?.['diastolic-pressure']?.alertThresholds?.[0]?.rules;
      expect(diastolicPressureRules).toBeDefined();
      diastolicPressureRules?.forEach((rule) => {
        expect(rule.criticality).toBe('abnormal');
      });
      const alertingLowDiastolicBloodPressure: VitalsBloodPressureObservationDTO = {
        patientId: testPatient.id,
        field: VitalFieldNames.VitalBloodPressure,
        systolicPressure: 100,
        diastolicPressure: 79.8,
        resourceId: randomUUID(),
      };
      const lowObservationCriticality = getVitalObservationAlertLevel({
        patientDOB,
        vitalsObservation: alertingLowDiastolicBloodPressure,
        configOverride: updatedChart2,
        patientSex: testPatient.gender,
      });
      expect(lowObservationCriticality).toBe('abnormal');
      const nonAlertingBloodPressure: VitalsBloodPressureObservationDTO = {
        patientId: testPatient.id,
        field: VitalFieldNames.VitalBloodPressure,
        systolicPressure: 100,
        diastolicPressure: 80.1,
        resourceId: randomUUID(),
      };
      const nonAlertingBloodPressureCriticality = getVitalObservationAlertLevel({
        patientDOB,
        vitalsObservation: nonAlertingBloodPressure,
        configOverride: updatedChart2,
        patientSex: testPatient.gender,
      });
      expect(nonAlertingBloodPressureCriticality).toBeUndefined();
    }
  );

  test('applies adult heart rate thresholds based on DOB', () => {
    const teenPatient = makeTestPatientWithAge({ units: 'years', value: 16 });
    const patientDOB = teenPatient.birthDate;
    assert(patientDOB);
    const tachyObservation: VitalsHeartbeatObservationDTO = {
      patientId: teenPatient.id,
      field: VitalFieldNames.VitalHeartbeat,
      value: 125,
      resourceId: randomUUID(),
    };

    const criticality = getVitalObservationAlertLevel({
      patientDOB,
      vitalsObservation: tachyObservation,
      patientSex: teenPatient.gender,
    });

    expect(criticality).toBe(VitalAlertCriticality.Abnormal);
  });

  test('applies adult respiration thresholds for adults', () => {
    const adultPatient = makeTestPatientWithAge({ units: 'years', value: 30 });
    const patientDOB = adultPatient.birthDate;
    assert(patientDOB);
    const highRespObservation: VitalsRespirationRateObservationDTO = {
      patientId: adultPatient.id,
      field: VitalFieldNames.VitalRespirationRate,
      value: 22,
      resourceId: randomUUID(),
    };

    const criticality = getVitalObservationAlertLevel({
      patientDOB,
      vitalsObservation: highRespObservation,
      patientSex: adultPatient.gender,
    });

    expect(criticality).toBe(VitalAlertCriticality.Abnormal);
  });

  test('applies adult weight thresholds for adults', () => {
    const adultPatient = makeTestPatientWithAge({ units: 'years', value: 30 });
    const patientDOB = adultPatient.birthDate;
    assert(patientDOB);
    const lowWeightObservation: VitalsWeightObservationDTO = {
      patientId: adultPatient.id,
      field: VitalFieldNames.VitalWeight,
      value: 40,
      resourceId: randomUUID(),
    };

    const criticality = getVitalObservationAlertLevel({
      patientDOB,
      vitalsObservation: lowWeightObservation,
      patientSex: adultPatient.gender,
    });

    expect(criticality).toBe(VitalAlertCriticality.Abnormal);
  });

  suite('age boundary threshold selection', () => {
    // These tests use respiration rate thresholds (not mutated by prior concurrent tests):
    // 0–2 months: min 25, max 60
    // 2–5 months: min 28, max 52
    // 5–8 months: min 26, max 49
    // At boundary points (e.g. exactly 2 months), only the older-age bracket should apply.

    test("patient in the middle of a threshold range gets that range's rules", () => {
      const patient = makeTestPatientWithAge({ units: 'months', value: 1 });
      const patientDOB = patient.birthDate;
      assert(patientDOB);

      // 24 is below the 0–2 month min of 25, so it should alert
      const lowResp: VitalsRespirationRateObservationDTO = {
        patientId: patient.id,
        field: VitalFieldNames.VitalRespirationRate,
        value: 24,
        resourceId: randomUUID(),
      };
      expect(
        getVitalObservationAlertLevel({ patientDOB, vitalsObservation: lowResp, patientSex: patient.gender })
      ).toBe(VitalAlertCriticality.Abnormal);
    });

    test('patient at exact boundary age gets the older-age-bracket threshold', () => {
      // Patient is exactly 2 months old — sits on the boundary between 0–2 and 2–5
      const patient = makeTestPatientWithAge({ units: 'months', value: 2 });
      const patientDOB = patient.birthDate;
      assert(patientDOB);

      // 27 is below 2–5 month min (28) but above 0–2 month min (25).
      // If the older bracket (2–5) applies, 27 SHOULD alert.
      // If the younger bracket (0–2) applied instead, 27 would NOT alert (above 25).
      const borderlineResp: VitalsRespirationRateObservationDTO = {
        patientId: patient.id,
        field: VitalFieldNames.VitalRespirationRate,
        value: 27,
        resourceId: randomUUID(),
      };
      expect(
        getVitalObservationAlertLevel({ patientDOB, vitalsObservation: borderlineResp, patientSex: patient.gender })
      ).toBe(VitalAlertCriticality.Abnormal);

      // 29 is above the 2–5 month min (28) and below max (52), should NOT alert
      const normalResp: VitalsRespirationRateObservationDTO = {
        patientId: patient.id,
        field: VitalFieldNames.VitalRespirationRate,
        value: 29,
        resourceId: randomUUID(),
      };
      expect(
        getVitalObservationAlertLevel({ patientDOB, vitalsObservation: normalResp, patientSex: patient.gender })
      ).toBeUndefined();
    });

    test('patient just past boundary gets the older-age-bracket threshold', () => {
      // Patient is 3 months old — clearly in the 2–5 range
      const patient = makeTestPatientWithAge({ units: 'months', value: 3 });
      const patientDOB = patient.birthDate;
      assert(patientDOB);

      // 29 is above 2–5 month min (28), should NOT alert
      const normalResp: VitalsRespirationRateObservationDTO = {
        patientId: patient.id,
        field: VitalFieldNames.VitalRespirationRate,
        value: 29,
        resourceId: randomUUID(),
      };
      expect(
        getVitalObservationAlertLevel({ patientDOB, vitalsObservation: normalResp, patientSex: patient.gender })
      ).toBeUndefined();
    });

    test('second boundary also resolves to older-age bracket', () => {
      // Patient is exactly 5 months — boundary between 2–5 (min 28, max 52) and 5–8 (min 26, max 49)
      const patient = makeTestPatientWithAge({ units: 'months', value: 5 });
      const patientDOB = patient.birthDate;
      assert(patientDOB);

      // 50 is above 5–8 month max (49) but below 2–5 month max (52).
      // If the older bracket (5–8) applies, 50 SHOULD alert.
      // If the younger bracket (2–5) applied instead, 50 would NOT alert (below 52).
      const borderlineHighResp: VitalsRespirationRateObservationDTO = {
        patientId: patient.id,
        field: VitalFieldNames.VitalRespirationRate,
        value: 50,
        resourceId: randomUUID(),
      };
      expect(
        getVitalObservationAlertLevel({ patientDOB, vitalsObservation: borderlineHighResp, patientSex: patient.gender })
      ).toBe(VitalAlertCriticality.Abnormal);

      // 48 is below 5–8 month max (49), should NOT alert
      const normalResp: VitalsRespirationRateObservationDTO = {
        patientId: patient.id,
        field: VitalFieldNames.VitalRespirationRate,
        value: 48,
        resourceId: randomUUID(),
      };
      expect(
        getVitalObservationAlertLevel({ patientDOB, vitalsObservation: normalResp, patientSex: patient.gender })
      ).toBeUndefined();
    });

    test('last open-ended threshold (no maxAge) still applies to older patients', () => {
      // Respiration rate final threshold: minAge 215 months, no maxAge, min 11, max 21
      const patient = makeTestPatientWithAge({ units: 'years', value: 20 });
      const patientDOB = patient.birthDate;
      assert(patientDOB);

      const highResp: VitalsRespirationRateObservationDTO = {
        patientId: patient.id,
        field: VitalFieldNames.VitalRespirationRate,
        value: 22,
        resourceId: randomUUID(),
      };
      expect(
        getVitalObservationAlertLevel({ patientDOB, vitalsObservation: highResp, patientSex: patient.gender })
      ).toBe(VitalAlertCriticality.Abnormal);

      const normalResp: VitalsRespirationRateObservationDTO = {
        patientId: patient.id,
        field: VitalFieldNames.VitalRespirationRate,
        value: 15,
        resourceId: randomUUID(),
      };
      expect(
        getVitalObservationAlertLevel({ patientDOB, vitalsObservation: normalResp, patientSex: patient.gender })
      ).toBeUndefined();
    });
  });
});

interface MutateVitalsOperation {
  path: (string | number)[];
  value: any;
}
const mutateVitals = (operation: MutateVitalsOperation[], vitals: VitalsSchema): VitalsSchema => {
  const newVal = { ...vitals };

  for (const { path, value } of operation) {
    let target: any = newVal;
    for (let i = 0; i < path.length - 1; i++) {
      const key = path[i];
      if (typeof key === 'number') {
        if (!Array.isArray(target[path[i - 1] as any])) {
          target[path[i - 1] as any] = [];
        }
        target = target[key];
      } else {
        if (!(key in target)) {
          target[key] = {};
        }
        target = target[key];
      }
    }
    const lastKey = path[path.length - 1];
    if (!target) {
      console.warn(`Target for path ${path.join('.')}, ${lastKey} not found in chart data.`);
    }
    if (Array.isArray(target[lastKey]) && typeof value === 'object' && value !== null) {
      target[lastKey] = target[lastKey].map((item: any) => ({ ...item, ...value }));
    } else {
      target[lastKey] = value;
    }
  }

  return newVal;
};
