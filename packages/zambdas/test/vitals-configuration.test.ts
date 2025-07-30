import { randomUUID } from 'crypto';
import { Patient } from 'fhir/r4b';
import { DateTime } from 'luxon';
import {
  DefaultVitalsConfig,
  DOB_DATE_FORMAT,
  getVitalObservationAlertLevel,
  VitalFieldNames,
  VitalsBloodPressureObservationDTO,
  VitalsDef,
  VitalsHeartbeatObservationDTO,
  VitalsSchema,
  VitalsTemperatureObservationDTO,
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
      });
      expect(lowObservationCriticality).toBe('critical');
      const nonAlertingHeartbeat: VitalsHeartbeatObservationDTO = {
        patientId: testPatient.id,
        field: VitalFieldNames.VitalHeartbeat,
        value: 100,
        resourceId: randomUUID(),
      };
      const nonAlertingHeartbeatCriticality = getVitalObservationAlertLevel({
        patientDOB,
        vitalsObservation: nonAlertingHeartbeat,
        configOverride: updatedChart,
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
      });
      expect(lowTemperatureCriticality).toBe('abnormal');
      const nonAlertingTemperature: VitalsTemperatureObservationDTO = {
        patientId: testPatient.id,
        field: VitalFieldNames.VitalTemperature,
        value: 36.5,
        resourceId: randomUUID(),
      };
      const nonAlertingTemperatureCriticality = getVitalObservationAlertLevel({
        patientDOB,
        vitalsObservation: nonAlertingTemperature,
        configOverride: updatedChart,
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
      });
      expect(nonAlertingBloodPressureCriticality).toBeUndefined();
    }
  );
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
