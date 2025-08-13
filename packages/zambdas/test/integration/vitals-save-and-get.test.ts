import Oystehr, { BatchInputPostRequest } from '@oystehr/sdk';
import { randomUUID } from 'crypto';
import { Appointment, Encounter, Observation, Patient } from 'fhir/r4b';
import { DateTime } from 'luxon';
import {
  DOB_DATE_FORMAT,
  FHIRObservationInterpretationSystem,
  GetVitalsResponseData,
  LOINC_SYSTEM,
  VITAL_DIASTOLIC_BLOOD_PRESSURE_LOINC_CODE,
  VITAL_SYSTOLIC_BLOOD_PRESSURE_LOINC_CODE,
  VitalFieldNames,
  VitalsObservationDTO,
} from 'utils';
import { assert, inject, suite } from 'vitest';
import { getAuth0Token } from '../../src/shared';
import { SECRETS } from '../data/secrets';
import { cleanupTestScheduleResources, makeTestPatient, persistTestPatient } from '../helpers/testScheduleUtils';

const DEFAULT_SUITE_TIMEOUT = 90000;

describe('saving and getting vitals', () => {
  let oystehr: Oystehr;
  let token: string;
  let processId: string;

  interface MakeTestResourcesParams {
    processId: string;
    oystehr: Oystehr;
    addDays?: number;
    existingPatientId?: string;
    patientAge?: { units: 'years' | 'months'; value: number };
    patientSex?: 'male' | 'female';
  }

  const makeTestResources = async ({
    processId,
    oystehr,
    addDays = 0,
    patientAge,
    existingPatientId,
    patientSex,
  }: MakeTestResourcesParams): Promise<{ encounter: Encounter; patient?: Patient }> => {
    let patientId = existingPatientId;
    let testPatient: Patient | undefined;
    if (!patientId) {
      const partialPatient: Partial<Patient> = {};
      if (patientAge) {
        const now = DateTime.now();
        const birthDate = now.minus({ [patientAge.units]: patientAge.value });
        partialPatient.birthDate = birthDate.toFormat(DOB_DATE_FORMAT);
      }
      if (patientSex) {
        partialPatient.gender = patientSex;
      }
      testPatient = await persistTestPatient({ patient: makeTestPatient(partialPatient), processId }, oystehr);
      expect(testPatient).toBeDefined();
      patientId = testPatient.id;
    }
    expect(patientId).toBeDefined();
    assert(patientId);
    const now = DateTime.now().plus({ days: addDays });
    const appointment: Appointment = {
      resourceType: 'Appointment',
      status: 'fulfilled',
      start: now.toISO(),
      end: now.plus({ minutes: 15 }).toISO(),
      participant: [
        {
          actor: {
            reference: `Patient/${patientId}`,
          },
          status: 'accepted',
        },
      ],
    };
    const batchInputApp: BatchInputPostRequest<Appointment> = {
      method: 'POST',
      resource: appointment,
      url: 'Appointment',
      fullUrl: `urn:uuid:${randomUUID()}`,
    };
    const encounter: Encounter = {
      resourceType: 'Encounter',
      status: 'in-progress',
      class: {
        system: 'http://terminology.hl7.org/CodeSystem/v3-ActCode',
        code: 'AMB',
        display: 'ambulatory',
      },
      subject: {
        reference: `Patient/${patientId}`,
      },
      appointment: [
        {
          reference: `${batchInputApp.fullUrl}`,
        },
      ],
      period: {
        start: now.toISO(),
      },
    };
    const batchInputEnc: BatchInputPostRequest<Encounter> = {
      method: 'POST',
      resource: encounter,
      url: 'Encounter',
    };

    try {
      const batchResults =
        (
          await oystehr.fhir.transaction<Appointment | Encounter>({
            requests: [batchInputApp, batchInputEnc],
          })
        ).entry?.flatMap((entry) => entry.resource ?? []) || [];
      expect(batchResults).toBeDefined();
      const createdEncounter = batchResults.find((entry) => entry.resourceType === 'Encounter') as Encounter;
      expect(createdEncounter?.id).toBeDefined();
      assert(createdEncounter);
      const createdAppointment = batchResults.find((entry) => entry.resourceType === 'Appointment') as Appointment;
      expect(createdAppointment?.id).toBeDefined();
      assert(createdAppointment);

      return { encounter: createdEncounter, patient: testPatient };
    } catch (error) {
      expect(error).toBeUndefined();
      throw new Error(`Error creating test resources: ${error}`);
    }
  };

  const saveVital = async (obs: VitalsObservationDTO[], encounterId: string): Promise<void> => {
    const payload = {
      encounterId: encounterId,
      vitalsObservations: obs,
    };
    try {
      await oystehr.zambda.execute({ id: 'save-chart-data', ...payload });
    } catch (error) {
      expect(error).toBeUndefined();
    }
  };
  const getVitals = async (encounterId: string): Promise<GetVitalsResponseData> => {
    const response = (
      await oystehr.zambda.execute({
        id: 'get-vitals',
        encounterId,
        mode: 'current',
      })
    ).output as Promise<GetVitalsResponseData>;
    return response;
  };

  const getHistoricVitals = async (encounterId: string): Promise<GetVitalsResponseData> => {
    const response = (
      await oystehr.zambda.execute({
        id: 'get-vitals',
        encounterId,
        mode: 'historical',
      })
    ).output as Promise<GetVitalsResponseData>;
    return response;
  };

  beforeAll(async () => {
    processId = randomUUID();
    const { AUTH0_ENDPOINT, AUTH0_CLIENT, AUTH0_SECRET, AUTH0_AUDIENCE, FHIR_API, PROJECT_ID } = SECRETS;
    const EXECUTE_ZAMBDA_URL = inject('EXECUTE_ZAMBDA_URL');
    expect(EXECUTE_ZAMBDA_URL).toBeDefined();
    token = await getAuth0Token({
      AUTH0_ENDPOINT: AUTH0_ENDPOINT,
      AUTH0_CLIENT: AUTH0_CLIENT,
      AUTH0_SECRET: AUTH0_SECRET,
      AUTH0_AUDIENCE: AUTH0_AUDIENCE,
    });

    oystehr = new Oystehr({
      accessToken: token,
      fhirApiUrl: FHIR_API,
      projectApiUrl: EXECUTE_ZAMBDA_URL,
      projectId: PROJECT_ID,
    });
    expect(oystehr).toBeDefined();
    expect(oystehr.fhir).toBeDefined();
    expect(oystehr.zambda).toBeDefined();
  });
  afterAll(async () => {
    if (!oystehr || !processId) {
      throw new Error('oystehr or processId is null! could not clean up!');
    }
    // this will clean up everything connect to the test patient too
    await cleanupTestScheduleResources(processId, oystehr);
  });

  suite(
    'writing vitals observations that dont rise to alert thresholds produces vitals dtos with no alerts',
    async () => {
      let encounterId: string;
      let patientId: string;
      beforeAll(async () => {
        // add one day in order to test for edge case where obs written for encounter in future show up for historic vitals
        const { encounter: maybeEncounter, patient: maybePatient } = await makeTestResources({
          processId,
          oystehr,
          addDays: 1,
        });
        expect(maybeEncounter?.id).toBeDefined();
        expect(maybePatient?.id).toBeDefined();
        assert(maybeEncounter?.id);
        assert(maybePatient?.id);
        encounterId = maybeEncounter?.id;
        patientId = maybePatient.id;
        const obs: VitalsObservationDTO[] = [
          {
            encounterId,
            patientId,
            field: VitalFieldNames.VitalHeartbeat,
            value: 72,
          },
          {
            encounterId,
            patientId,
            field: VitalFieldNames.VitalHeight,
            value: 100,
          },
          {
            encounterId,
            patientId,
            field: VitalFieldNames.VitalWeight,
            value: 97,
          },
          {
            encounterId,
            patientId,
            field: VitalFieldNames.VitalRespirationRate,
            value: 20,
          },
          {
            encounterId,
            patientId,
            field: VitalFieldNames.VitalVision,
            leftEyeVisionText: '20',
            rightEyeVisionText: '20',
          },
          {
            encounterId,
            patientId,
            field: VitalFieldNames.VitalBloodPressure,
            systolicPressure: 120,
            diastolicPressure: 80,
          },
          {
            encounterId,
            patientId,
            field: VitalFieldNames.VitalOxygenSaturation,
            value: 98,
          },
          {
            encounterId,
            patientId,
            field: VitalFieldNames.VitalTemperature,
            value: 37,
          },
        ];
        await saveVital(obs, encounterId);
      });
      test.concurrent('saving normal heart beat observation succeeds with no alerts', async () => {
        const vitals = await getVitals(encounterId);
        expect(vitals).toBeDefined();
        const heartbeatVitals = vitals[VitalFieldNames.VitalHeartbeat];
        expect(heartbeatVitals.length).toBe(1);
        expect(heartbeatVitals[0].field).toBe(VitalFieldNames.VitalHeartbeat);
        expect(heartbeatVitals[0].value).toBe(72);
        expect(heartbeatVitals[0].alertCriticality).toBeUndefined();
      });
      test.concurrent('saving height and weight observations succeeds with no alerts', async () => {
        const vitals = await getVitals(encounterId);
        expect(vitals).toBeDefined();
        const weightVitals = vitals[VitalFieldNames.VitalWeight];
        expect(weightVitals.length).toBe(1);
        expect(weightVitals[0].field).toBe(VitalFieldNames.VitalWeight);
        expect(weightVitals[0].value).toBe(97);
        expect(weightVitals[0].alertCriticality).toBeUndefined();
        const heightVitals = vitals[VitalFieldNames.VitalHeight];
        expect(heightVitals.length).toBe(1);
        expect(heightVitals[0].field).toBe(VitalFieldNames.VitalHeight);
        expect(heightVitals[0].value).toBe(100);
        expect(heightVitals[0].alertCriticality).toBeUndefined();
      });
      test.concurrent('respiration rate observation is saved and retrieved correctly', async () => {
        const vitals = await getVitals(encounterId);
        expect(vitals).toBeDefined();
        const respirationRateVitals = vitals[VitalFieldNames.VitalRespirationRate];
        expect(respirationRateVitals.length).toBe(1);
        expect(respirationRateVitals[0].field).toBe(VitalFieldNames.VitalRespirationRate);
        expect(respirationRateVitals[0].value).toBe(20);
        expect(respirationRateVitals[0].alertCriticality).toBeUndefined();
      });
      test.concurrent('vision observation is saved and retrieved correctly', async () => {
        const vitals = await getVitals(encounterId);
        expect(vitals).toBeDefined();
        const visionVitals = vitals[VitalFieldNames.VitalVision];
        expect(visionVitals.length).toBe(1);
        expect(visionVitals[0].field).toBe(VitalFieldNames.VitalVision);
        expect(visionVitals[0].leftEyeVisionText).toBe('20');
        expect(visionVitals[0].rightEyeVisionText).toBe('20');
        expect(visionVitals[0].alertCriticality).toBeUndefined();
      });
      test.concurrent('blood pressure observation is saved and retrieved correctly', async () => {
        const vitals = await getVitals(encounterId);
        expect(vitals).toBeDefined();
        const bloodPressureVitals = vitals[VitalFieldNames.VitalBloodPressure];
        expect(bloodPressureVitals.length).toBe(1);
        expect(bloodPressureVitals[0].field).toBe(VitalFieldNames.VitalBloodPressure);
        expect(bloodPressureVitals[0].systolicPressure).toBe(120);
        expect(bloodPressureVitals[0].diastolicPressure).toBe(80);
        expect(bloodPressureVitals[0].alertCriticality).toBeUndefined();
      });
      test.concurrent('oxygen saturation observation is saved and retrieved correctly', async () => {
        const vitals = await getVitals(encounterId);
        expect(vitals).toBeDefined();
        const oxygenSaturationVitals = vitals[VitalFieldNames.VitalOxygenSaturation];
        expect(oxygenSaturationVitals.length).toBe(1);
        expect(oxygenSaturationVitals[0].field).toBe(VitalFieldNames.VitalOxygenSaturation);
        expect(oxygenSaturationVitals[0].value).toBe(98);
        expect(oxygenSaturationVitals[0].alertCriticality).toBeUndefined();
      });

      test.concurrent('temperature observation is saved and retrieved correctly', async () => {
        const vitals = await getVitals(encounterId);
        expect(vitals).toBeDefined();
        const temperatureVitals = vitals[VitalFieldNames.VitalTemperature];
        expect(temperatureVitals.length).toBe(1);
        expect(temperatureVitals[0].field).toBe(VitalFieldNames.VitalTemperature);
        expect(temperatureVitals[0].value).toBe(37);
        expect(temperatureVitals[0].alertCriticality).toBeUndefined();
      });

      test('historical vitals do not include current encounter vitals, but do include previous encounter vitals', async () => {
        const originalVitals = await getVitals(encounterId);
        const vitals = await getHistoricVitals(encounterId);
        expect(vitals).toBeDefined();
        const allEntries = Object.values(vitals).flat();
        expect(allEntries).toHaveLength(0);

        const { encounter: maybeEncounter, patient: maybePatient } = await makeTestResources({
          processId,
          oystehr,
          addDays: 1,
          existingPatientId: patientId,
        });
        expect(maybeEncounter?.id).toBeDefined();
        expect(maybePatient).toBeUndefined();
        const newEncounterId = maybeEncounter?.id;
        assert(newEncounterId);
        const newEncounterVitals = await getVitals(newEncounterId);
        expect(newEncounterVitals).toBeDefined();
        const newAllEntries = Object.values(newEncounterVitals).flat();
        expect(newAllEntries).toHaveLength(0);
        const newHistoricVitals = await getHistoricVitals(newEncounterId);
        expect(newHistoricVitals).toBeDefined();
        expect(newHistoricVitals).toEqual(originalVitals);
      });
    },
    { timeout: DEFAULT_SUITE_TIMEOUT }
  );

  suite(
    'writing vitals observations for 0-2 month old patients that do rise to alert threshold level produce vitals dtos with alerts',
    async () => {
      let encounterId: string;
      let patientId: string;
      beforeAll(async () => {
        const patientAge = { units: 'months', value: 1 } as { units: 'months'; value: number };
        const { encounter: maybeEncounter, patient: maybePatient } = await makeTestResources({
          processId,
          oystehr,
          patientAge,
        });
        expect(maybeEncounter?.id).toBeDefined();
        expect(maybePatient?.id).toBeDefined();
        assert(maybeEncounter?.id);
        assert(maybePatient?.id);
        // expect(maybePatient.birthDate).toBe('1234567890'); // should be set by makeTestResources
        encounterId = maybeEncounter?.id;
        patientId = maybePatient.id;

        const obs: VitalsObservationDTO[] = [
          // too high heart rate
          {
            encounterId,
            patientId,
            field: VitalFieldNames.VitalHeartbeat,
            value: 201,
          },
          // too low heart rate
          {
            encounterId,
            patientId,
            field: VitalFieldNames.VitalHeartbeat,
            value: 99.5,
          },
          // too high temperature
          {
            encounterId,
            patientId,
            field: VitalFieldNames.VitalTemperature,
            value: 38.5,
          },
          // too low temperature
          {
            encounterId,
            patientId,
            field: VitalFieldNames.VitalTemperature,
            value: 36.4,
          },
          // too high respiration rate
          {
            encounterId,
            patientId,
            field: VitalFieldNames.VitalRespirationRate,
            value: 61,
          },
          // too low respiration rate
          {
            encounterId,
            patientId,
            field: VitalFieldNames.VitalRespirationRate,
            value: 29,
          },
          // too low oxygen saturation
          {
            encounterId,
            patientId,
            field: VitalFieldNames.VitalOxygenSaturation,
            value: 94,
          },
          // too low systolic blood pressure
          {
            encounterId,
            patientId,
            field: VitalFieldNames.VitalBloodPressure,
            systolicPressure: 69,
            diastolicPressure: 40,
          },
        ];
        await saveVital(obs, encounterId);
      });
      test.concurrent('abnormal heart beat vitals have abnormal alertCriticality', async () => {
        const vitals = await getVitals(encounterId);
        expect(vitals).toBeDefined();
        const heartbeatVitals = vitals[VitalFieldNames.VitalHeartbeat];
        expect(heartbeatVitals.length).toBeGreaterThanOrEqual(1);
        heartbeatVitals.forEach((vital) => {
          expect(vital.field).toBe(VitalFieldNames.VitalHeartbeat);
          expect(vital.alertCriticality).toBe('abnormal');
        });
      });
      test.concurrent('abnormal respiration rate observation has abnormal alertCriticality', async () => {
        const vitals = await getVitals(encounterId);
        expect(vitals).toBeDefined();
        const respirationRateVitals = vitals[VitalFieldNames.VitalRespirationRate];
        expect(respirationRateVitals.length).toBeGreaterThanOrEqual(1);
        respirationRateVitals.forEach((vital) => {
          expect(vital.field).toBe(VitalFieldNames.VitalRespirationRate);
          expect(vital.alertCriticality).toBe('abnormal');
        });
      });
      test.concurrent('abnormal blood pressure observation has abnormal alertCriticality', async () => {
        const vitals = await getVitals(encounterId);
        expect(vitals).toBeDefined();
        const bloodPressureVitals = vitals[VitalFieldNames.VitalBloodPressure];
        expect(bloodPressureVitals.length).toBeGreaterThanOrEqual(1);
        bloodPressureVitals.forEach((vital) => {
          expect(vital.field).toBe(VitalFieldNames.VitalBloodPressure);
          expect(vital.alertCriticality).toBe('abnormal');
        });
        // verify fhir resource looks correct
        const observationId = bloodPressureVitals[0].resourceId;
        const observation = await oystehr.fhir.get<Observation>({ resourceType: 'Observation', id: observationId! });
        expect(observation).toBeDefined();
        expect(observation.component).toBeDefined();
        const systolicComponent = observation.component?.find(
          (c) =>
            c.code?.coding?.some(
              (coding) => coding.code === VITAL_SYSTOLIC_BLOOD_PRESSURE_LOINC_CODE && coding.system === LOINC_SYSTEM
            )
        );
        expect(systolicComponent).toBeDefined();
        expect(systolicComponent?.valueQuantity?.value).toBe(69);
        assert(systolicComponent);
        const interpretation = systolicComponent.interpretation;
        expect(interpretation).toBeDefined();
        assert(interpretation);
        expect(interpretation?.[0].coding?.[0]?.code).toBe('LX');
        expect(interpretation?.[0].coding?.[0]?.system).toBe(FHIRObservationInterpretationSystem);
        const diastolicComponent = observation.component?.find(
          (c) =>
            c.code?.coding?.some(
              (coding) => coding.code === VITAL_DIASTOLIC_BLOOD_PRESSURE_LOINC_CODE && coding.system === LOINC_SYSTEM
            )
        );
        expect(diastolicComponent).toBeDefined();
        expect(diastolicComponent?.valueQuantity?.value).toBe(40);
      });
      test.concurrent('abnormal oxygen saturation observation has abnormal alertCriticality', async () => {
        const vitals = await getVitals(encounterId);
        expect(vitals).toBeDefined();
        const oxygenSaturationVitals = vitals[VitalFieldNames.VitalOxygenSaturation];
        expect(oxygenSaturationVitals.length).toBeGreaterThanOrEqual(1);
        oxygenSaturationVitals.forEach((vital) => {
          expect(vital.field).toBe(VitalFieldNames.VitalOxygenSaturation);
          expect(vital.alertCriticality).toBe('abnormal');
        });
      });
      test.concurrent('abnormal temperature vitals have abnormal alertCriticality', async () => {
        const vitals = await getVitals(encounterId);
        expect(vitals).toBeDefined();
        const temperatureVitals = vitals[VitalFieldNames.VitalTemperature];
        expect(temperatureVitals.length).toBeGreaterThanOrEqual(1);
        temperatureVitals.forEach((vital) => {
          expect(vital.field).toBe(VitalFieldNames.VitalTemperature);
          expect(vital.alertCriticality).toBe('abnormal');
        });
      });
    },
    { timeout: DEFAULT_SUITE_TIMEOUT }
  );
  suite(
    'writing vitals observations for 2-12 month old patients that do rise to alert threshold level produce vitals dtos with alerts',
    async () => {
      let encounterId: string;
      let patientId: string;
      beforeAll(async () => {
        const patientAge = { units: 'months', value: 10 } as { units: 'months'; value: number };
        const { encounter: maybeEncounter, patient: maybePatient } = await makeTestResources({
          processId,
          oystehr,
          patientAge,
        });
        expect(maybeEncounter?.id).toBeDefined();
        expect(maybePatient?.id).toBeDefined();
        assert(maybeEncounter?.id);
        assert(maybePatient?.id);
        // expect(maybePatient.birthDate).toBe('1234567890'); // should be set by makeTestResources
        encounterId = maybeEncounter?.id;
        patientId = maybePatient.id;

        const obs: VitalsObservationDTO[] = [
          // too high heart rate
          {
            encounterId,
            patientId,
            field: VitalFieldNames.VitalHeartbeat,
            value: 161,
          },
          // too low heart rate
          {
            encounterId,
            patientId,
            field: VitalFieldNames.VitalHeartbeat,
            value: 79.5,
          },
          // too high temperature
          {
            encounterId,
            patientId,
            field: VitalFieldNames.VitalTemperature,
            value: 38.5,
          },
          // too low temperature
          {
            encounterId,
            patientId,
            field: VitalFieldNames.VitalTemperature,
            value: 35.9,
          },
          // too low systolic blood pressure
          {
            encounterId,
            patientId,
            field: VitalFieldNames.VitalBloodPressure,
            systolicPressure: 69.9,
            diastolicPressure: 40,
          },
        ];
        await saveVital(obs, encounterId);
      });
      test.concurrent('abnormal heart beat vitals have abnormal alertCriticality', async () => {
        const vitals = await getVitals(encounterId);
        expect(vitals).toBeDefined();
        const heartbeatVitals = vitals[VitalFieldNames.VitalHeartbeat];
        expect(heartbeatVitals.length).toBeGreaterThanOrEqual(1);
        heartbeatVitals.forEach((vital) => {
          expect(vital.field).toBe(VitalFieldNames.VitalHeartbeat);
          expect(vital.alertCriticality).toBe('abnormal');
        });
      });

      test.concurrent('abnormal blood pressure observation has abnormal alertCriticality', async () => {
        const vitals = await getVitals(encounterId);
        expect(vitals).toBeDefined();
        const bloodPressureVitals = vitals[VitalFieldNames.VitalBloodPressure];
        expect(bloodPressureVitals.length).toBeGreaterThanOrEqual(1);
        bloodPressureVitals.forEach((vital) => {
          expect(vital.field).toBe(VitalFieldNames.VitalBloodPressure);
          expect(vital.alertCriticality).toBe('abnormal');
        });
      });
      test.concurrent('abnormal temperature vitals have abnormal alertCriticality', async () => {
        const vitals = await getVitals(encounterId);
        expect(vitals).toBeDefined();
        const temperatureVitals = vitals[VitalFieldNames.VitalTemperature];
        expect(temperatureVitals.length).toBeGreaterThanOrEqual(1);
        temperatureVitals.forEach((vital) => {
          expect(vital.field).toBe(VitalFieldNames.VitalTemperature);
          expect(vital.alertCriticality).toBe('abnormal');
        });
      });
    },
    { timeout: DEFAULT_SUITE_TIMEOUT }
  );

  suite(
    'writing vitals observations for 12-36 month old patients that do rise to alert threshold level produce vitals dtos with alerts',
    async () => {
      let encounterId: string;
      let patientId: string;
      beforeAll(async () => {
        const patientAge = { units: 'months', value: 24 } as { units: 'months'; value: number };
        const { encounter: maybeEncounter, patient: maybePatient } = await makeTestResources({
          processId,
          oystehr,
          patientAge,
        });
        expect(maybeEncounter?.id).toBeDefined();
        expect(maybePatient?.id).toBeDefined();
        assert(maybeEncounter?.id);
        assert(maybePatient?.id);

        encounterId = maybeEncounter?.id;
        patientId = maybePatient.id;

        const obs: VitalsObservationDTO[] = [
          // too high heart rate
          {
            encounterId,
            patientId,
            field: VitalFieldNames.VitalHeartbeat,
            value: 150.5,
          },
          // too low heart rate
          {
            encounterId,
            patientId,
            field: VitalFieldNames.VitalHeartbeat,
            value: 69,
          },
          /*
           { type: 'min', units: '', value: 20 },
          { type: 'max', units: '', value: 50 },
          */
          // respiration rate is too high
          {
            encounterId,
            patientId,
            field: VitalFieldNames.VitalRespirationRate,
            value: 50.5,
          },
          // respiration rate is too low
          {
            encounterId,
            patientId,
            field: VitalFieldNames.VitalRespirationRate,
            value: 19.9,
          },
        ];
        await saveVital(obs, encounterId);
      });
      test.concurrent('abnormal heart beat vitals have abnormal alertCriticality', async () => {
        const vitals = await getVitals(encounterId);
        expect(vitals).toBeDefined();
        const heartbeatVitals = vitals[VitalFieldNames.VitalHeartbeat];
        expect(heartbeatVitals.length).toBeGreaterThanOrEqual(1);
        heartbeatVitals.forEach((vital) => {
          expect(vital.field).toBe(VitalFieldNames.VitalHeartbeat);
          expect(vital.alertCriticality).toBe('abnormal');
        });
      });

      test.concurrent('abnormal respiration rate observation has abnormal alertCriticality', async () => {
        const vitals = await getVitals(encounterId);
        expect(vitals).toBeDefined();
        const respirationRateVitals = vitals[VitalFieldNames.VitalRespirationRate];
        expect(respirationRateVitals.length).toBeGreaterThanOrEqual(1);
        respirationRateVitals.forEach((vital) => {
          expect(vital.field).toBe(VitalFieldNames.VitalRespirationRate);
          expect(vital.alertCriticality).toBe('abnormal');
        });
      });
    },
    { timeout: DEFAULT_SUITE_TIMEOUT }
  );

  suite(
    'writing vitals observations for 12-36 month old patients that do rise to alert threshold level produce vitals dtos with alerts',
    async () => {
      let encounterId: string;
      let patientId: string;
      beforeAll(async () => {
        const patientAge = { units: 'months', value: 70 } as { units: 'months'; value: number };
        const { encounter: maybeEncounter, patient: maybePatient } = await makeTestResources({
          processId,
          oystehr,
          patientAge,
        });
        expect(maybeEncounter?.id).toBeDefined();
        expect(maybePatient?.id).toBeDefined();
        assert(maybeEncounter?.id);
        assert(maybePatient?.id);

        encounterId = maybeEncounter?.id;
        patientId = maybePatient.id;

        const obs: VitalsObservationDTO[] = [
          // too high heart rate
          {
            encounterId,
            patientId,
            field: VitalFieldNames.VitalHeartbeat,
            value: 150.5,
          },
          // too low heart rate
          {
            encounterId,
            patientId,
            field: VitalFieldNames.VitalHeartbeat,
            value: 50.9,
          },
          // respiration rate is too high
          {
            encounterId,
            patientId,
            field: VitalFieldNames.VitalRespirationRate,
            value: 40.5,
          },
          // respiration rate is too low
          {
            encounterId,
            patientId,
            field: VitalFieldNames.VitalRespirationRate,
            value: 19.9,
          },
        ];
        await saveVital(obs, encounterId);
      });
      test.concurrent('abnormal heart beat vitals have abnormal alertCriticality', async () => {
        const vitals = await getVitals(encounterId);
        expect(vitals).toBeDefined();
        const heartbeatVitals = vitals[VitalFieldNames.VitalHeartbeat];
        expect(heartbeatVitals.length).toBeGreaterThanOrEqual(1);
        heartbeatVitals.forEach((vital) => {
          expect(vital.field).toBe(VitalFieldNames.VitalHeartbeat);
          expect(vital.alertCriticality).toBe('abnormal');
        });
      });

      test.concurrent('abnormal respiration rate observation has abnormal alertCriticality', async () => {
        const vitals = await getVitals(encounterId);
        expect(vitals).toBeDefined();
        const respirationRateVitals = vitals[VitalFieldNames.VitalRespirationRate];
        expect(respirationRateVitals.length).toBeGreaterThanOrEqual(1);
        respirationRateVitals.forEach((vital) => {
          expect(vital.field).toBe(VitalFieldNames.VitalRespirationRate);
          expect(vital.alertCriticality).toBe('abnormal');
        });
      });
    },
    { timeout: DEFAULT_SUITE_TIMEOUT }
  );

  suite(
    'writing vitals observations for 72-108 month old patients that do rise to alert threshold level produce vitals dtos with alerts',
    async () => {
      let encounterId: string;
      let patientId: string;
      beforeAll(async () => {
        const patientAge = { units: 'months', value: 98 } as { units: 'months'; value: number };
        const { encounter: maybeEncounter, patient: maybePatient } = await makeTestResources({
          processId,
          oystehr,
          patientAge,
        });
        expect(maybeEncounter?.id).toBeDefined();
        expect(maybePatient?.id).toBeDefined();
        assert(maybeEncounter?.id);
        assert(maybePatient?.id);

        encounterId = maybeEncounter?.id;
        patientId = maybePatient.id;

        const obs: VitalsObservationDTO[] = [
          // too high heart rate
          {
            encounterId,
            patientId,
            field: VitalFieldNames.VitalHeartbeat,
            value: 140.5,
          },
          // too low heart rate
          {
            encounterId,
            patientId,
            field: VitalFieldNames.VitalHeartbeat,
            value: 59.9,
          },
          // respiration rate is too high
          {
            encounterId,
            patientId,
            field: VitalFieldNames.VitalRespirationRate,
            value: 40.1,
          },
          // respiration rate is too low
          {
            encounterId,
            patientId,
            field: VitalFieldNames.VitalRespirationRate,
            value: 14.9,
          },
          {
            encounterId,
            patientId,
            field: VitalFieldNames.VitalBloodPressure,
            systolicPressure: 89.9,
            diastolicPressure: 80,
          },
        ];
        await saveVital(obs, encounterId);
      });
      test.concurrent('abnormal heart beat vitals have abnormal alertCriticality', async () => {
        const vitals = await getVitals(encounterId);
        expect(vitals).toBeDefined();
        const heartbeatVitals = vitals[VitalFieldNames.VitalHeartbeat];
        expect(heartbeatVitals.length).toBeGreaterThanOrEqual(1);
        heartbeatVitals.forEach((vital) => {
          expect(vital.field).toBe(VitalFieldNames.VitalHeartbeat);
          expect(vital.alertCriticality).toBe('abnormal');
        });
      });

      test.concurrent('abnormal respiration rate observation has abnormal alertCriticality', async () => {
        const vitals = await getVitals(encounterId);
        expect(vitals).toBeDefined();
        const respirationRateVitals = vitals[VitalFieldNames.VitalRespirationRate];
        expect(respirationRateVitals.length).toBeGreaterThanOrEqual(1);
        respirationRateVitals.forEach((vital) => {
          expect(vital.field).toBe(VitalFieldNames.VitalRespirationRate);
          expect(vital.alertCriticality).toBe('abnormal');
        });
      });
    },
    { timeout: DEFAULT_SUITE_TIMEOUT }
  );

  suite(
    'writing vitals observations for 108-144 month old patients that do rise to alert threshold level produce vitals dtos with alerts',
    async () => {
      let encounterId: string;
      let patientId: string;
      beforeAll(async () => {
        const patientAge = { units: 'months', value: 120 } as { units: 'months'; value: number };
        const { encounter: maybeEncounter, patient: maybePatient } = await makeTestResources({
          processId,
          oystehr,
          patientAge,
        });
        expect(maybeEncounter?.id).toBeDefined();
        expect(maybePatient?.id).toBeDefined();
        assert(maybeEncounter?.id);
        assert(maybePatient?.id);

        encounterId = maybeEncounter?.id;
        patientId = maybePatient.id;

        const obs: VitalsObservationDTO[] = [
          // too high heart rate
          {
            encounterId,
            patientId,
            field: VitalFieldNames.VitalHeartbeat,
            value: 130.5,
          },
          // too low heart rate
          {
            encounterId,
            patientId,
            field: VitalFieldNames.VitalHeartbeat,
            value: 59.9,
          },
          // respiration rate is too high
          {
            encounterId,
            patientId,
            field: VitalFieldNames.VitalRespirationRate,
            value: 30.1,
          },

          // respiration rate is too low
          {
            encounterId,
            patientId,
            field: VitalFieldNames.VitalRespirationRate,
            value: 14.9,
          },

          {
            encounterId,
            patientId,
            field: VitalFieldNames.VitalBloodPressure,
            systolicPressure: 89.9,
            diastolicPressure: 80,
          },
        ];
        await saveVital(obs, encounterId);
      });
      test.concurrent('abnormal heart beat vitals have abnormal alertCriticality', async () => {
        const vitals = await getVitals(encounterId);
        expect(vitals).toBeDefined();
        const heartbeatVitals = vitals[VitalFieldNames.VitalHeartbeat];
        expect(heartbeatVitals.length).toBeGreaterThanOrEqual(1);
        heartbeatVitals.forEach((vital) => {
          expect(vital.field).toBe(VitalFieldNames.VitalHeartbeat);
          expect(vital.alertCriticality).toBe('abnormal');
        });
      });

      test.concurrent('abnormal blood pressure observation has abnormal alertCriticality', async () => {
        const vitals = await getVitals(encounterId);
        expect(vitals).toBeDefined();
        const bloodPressureVitals = vitals[VitalFieldNames.VitalBloodPressure];
        expect(bloodPressureVitals.length).toBeGreaterThanOrEqual(1);
        bloodPressureVitals.forEach((vital) => {
          expect(vital.field).toBe(VitalFieldNames.VitalBloodPressure);
          expect(vital.alertCriticality).toBe('abnormal');
        });
      });
    },
    { timeout: DEFAULT_SUITE_TIMEOUT }
  );

  suite(
    'writing vitals observations for 144+ month old patients that do rise to alert threshold level produce vitals dtos with alerts',
    async () => {
      let encounterId: string;
      let patientId: string;
      beforeAll(async () => {
        const patientAge = { units: 'months', value: 144 } as { units: 'months'; value: number };
        const { encounter: maybeEncounter, patient: maybePatient } = await makeTestResources({
          processId,
          oystehr,
          patientAge,
        });
        expect(maybeEncounter?.id).toBeDefined();
        expect(maybePatient?.id).toBeDefined();
        assert(maybeEncounter?.id);
        assert(maybePatient?.id);

        encounterId = maybeEncounter?.id;
        patientId = maybePatient.id;

        const obs: VitalsObservationDTO[] = [
          // too high heart rate
          {
            encounterId,
            patientId,
            field: VitalFieldNames.VitalHeartbeat,
            value: 120.1,
          },
          // too low heart rate
          {
            encounterId,
            patientId,
            field: VitalFieldNames.VitalHeartbeat,
            value: 59.9,
          },
          // respiration rate is too high
          {
            encounterId,
            patientId,
            field: VitalFieldNames.VitalRespirationRate,
            value: 30.1,
          },

          // respiration rate is too low
          {
            encounterId,
            patientId,
            field: VitalFieldNames.VitalRespirationRate,
            value: 9.9,
          },
        ];
        await saveVital(obs, encounterId);
      });
      test.concurrent('abnormal heart beat vitals have abnormal alertCriticality', async () => {
        const vitals = await getVitals(encounterId);
        expect(vitals).toBeDefined();
        const heartbeatVitals = vitals[VitalFieldNames.VitalHeartbeat];
        expect(heartbeatVitals.length).toBeGreaterThanOrEqual(1);
        heartbeatVitals.forEach((vital) => {
          expect(vital.field).toBe(VitalFieldNames.VitalHeartbeat);
          expect(vital.alertCriticality).toBe('abnormal');
        });
      });
    },
    { timeout: DEFAULT_SUITE_TIMEOUT }
  );
  suite(
    'writing weight/height vitals observations alert when appropriate but not otherwise',
    async () => {
      test.concurrent(
        'male patient younger than 24 months presents no alert, even when ridiculously teeny-tiny',
        async () => {
          const patientAge = { units: 'months', value: 14 } as { units: 'months'; value: number };
          const { encounter: maybeEncounter, patient: maybePatient } = await makeTestResources({
            processId,
            oystehr,
            patientAge,
            patientSex: 'male',
          });
          expect(maybeEncounter?.id).toBeDefined();
          expect(maybePatient?.id).toBeDefined();
          assert(maybeEncounter?.id);
          assert(maybePatient?.id);

          const encounterId = maybeEncounter?.id;
          const patientId = maybePatient.id;

          const obs: VitalsObservationDTO[] = [
            {
              encounterId,
              patientId,
              field: VitalFieldNames.VitalWeight,
              value: 3,
            },
            {
              encounterId,
              patientId,
              field: VitalFieldNames.VitalHeight,
              value: 5,
            },
          ];
          await saveVital(obs, encounterId);
          const vitals = await getVitals(encounterId);
          expect(vitals).toBeDefined();
          const heightVitals = vitals[VitalFieldNames.VitalHeight];
          expect(heightVitals.length).toBeGreaterThanOrEqual(1);
          heightVitals.forEach((vital) => {
            expect(vital.field).toBe(VitalFieldNames.VitalHeight);
            expect(vital.alertCriticality).toBeUndefined();
          });
          const weightVitals = vitals[VitalFieldNames.VitalWeight];
          expect(weightVitals.length).toBeGreaterThanOrEqual(1);
          weightVitals.forEach((vital) => {
            expect(vital.field).toBe(VitalFieldNames.VitalWeight);
            expect(vital.alertCriticality).toBeUndefined();
          });
        }
      );
      test.concurrent(
        'female patient younger than 24 months presents no alert, even when ridiculously teeny-tiny',
        async () => {
          const patientAge = { units: 'months', value: 14 } as { units: 'months'; value: number };
          const { encounter: maybeEncounter, patient: maybePatient } = await makeTestResources({
            processId,
            oystehr,
            patientAge,
            patientSex: 'female',
          });
          expect(maybeEncounter?.id).toBeDefined();
          expect(maybePatient?.id).toBeDefined();
          assert(maybeEncounter?.id);
          assert(maybePatient?.id);

          const encounterId = maybeEncounter?.id;
          const patientId = maybePatient.id;

          const obs: VitalsObservationDTO[] = [
            {
              encounterId,
              patientId,
              field: VitalFieldNames.VitalWeight,
              value: 3,
            },
            {
              encounterId,
              patientId,
              field: VitalFieldNames.VitalHeight,
              value: 5,
            },
          ];
          await saveVital(obs, encounterId);
          const vitals = await getVitals(encounterId);
          expect(vitals).toBeDefined();
          const heightVitals = vitals[VitalFieldNames.VitalHeight];
          expect(heightVitals.length).toBeGreaterThanOrEqual(1);
          heightVitals.forEach((vital) => {
            expect(vital.field).toBe(VitalFieldNames.VitalHeight);
            expect(vital.alertCriticality).toBeUndefined();
          });
          const weightVitals = vitals[VitalFieldNames.VitalWeight];
          expect(weightVitals.length).toBeGreaterThanOrEqual(1);
          weightVitals.forEach((vital) => {
            expect(vital.field).toBe(VitalFieldNames.VitalWeight);
            expect(vital.alertCriticality).toBeUndefined();
          });
        }
      );
      test.concurrent(
        'male patient older than 240 months presents no alert, even when ridiculously teeny-tiny',
        async () => {
          const patientAge = { units: 'months', value: 241 } as { units: 'months'; value: number };
          const { encounter: maybeEncounter, patient: maybePatient } = await makeTestResources({
            processId,
            oystehr,
            patientAge,
            patientSex: 'male',
          });
          expect(maybeEncounter?.id).toBeDefined();
          expect(maybePatient?.id).toBeDefined();
          assert(maybeEncounter?.id);
          assert(maybePatient?.id);

          const encounterId = maybeEncounter?.id;
          const patientId = maybePatient.id;

          const obs: VitalsObservationDTO[] = [
            {
              encounterId,
              patientId,
              field: VitalFieldNames.VitalWeight,
              value: 3,
            },
            {
              encounterId,
              patientId,
              field: VitalFieldNames.VitalHeight,
              value: 5,
            },
          ];
          await saveVital(obs, encounterId);
          const vitals = await getVitals(encounterId);
          expect(vitals).toBeDefined();
          const heightVitals = vitals[VitalFieldNames.VitalHeight];
          expect(heightVitals.length).toBe(1);
          heightVitals.forEach((vital) => {
            expect(vital.field).toBe(VitalFieldNames.VitalHeight);
            expect(vital.alertCriticality).toBeUndefined();
          });
          const weightVitals = vitals[VitalFieldNames.VitalWeight];
          expect(weightVitals.length).toBeGreaterThanOrEqual(1);
          weightVitals.forEach((vital) => {
            expect(vital.field).toBe(VitalFieldNames.VitalWeight);
            expect(vital.alertCriticality).toBeUndefined();
          });
        }
      );
      test.concurrent(
        'female patient older than 240 months presents no alert, even when ridiculously teeny-tiny',
        async () => {
          const patientAge = { units: 'months', value: 241 } as { units: 'months'; value: number };
          const { encounter: maybeEncounter, patient: maybePatient } = await makeTestResources({
            processId,
            oystehr,
            patientAge,
            patientSex: 'female',
          });
          expect(maybeEncounter?.id).toBeDefined();
          expect(maybePatient?.id).toBeDefined();
          assert(maybeEncounter?.id);
          assert(maybePatient?.id);

          const encounterId = maybeEncounter?.id;
          const patientId = maybePatient.id;

          const obs: VitalsObservationDTO[] = [
            {
              encounterId,
              patientId,
              field: VitalFieldNames.VitalWeight,
              value: 3,
            },
            {
              encounterId,
              patientId,
              field: VitalFieldNames.VitalHeight,
              value: 5,
            },
          ];
          await saveVital(obs, encounterId);
          const vitals = await getVitals(encounterId);
          expect(vitals).toBeDefined();
          const heightVitals = vitals[VitalFieldNames.VitalHeight];
          expect(heightVitals.length).toBeGreaterThanOrEqual(1);
          heightVitals.forEach((vital) => {
            expect(vital.field).toBe(VitalFieldNames.VitalHeight);
            expect(vital.alertCriticality).toBeUndefined();
          });
          const weightVitals = vitals[VitalFieldNames.VitalWeight];
          expect(weightVitals.length).toBeGreaterThanOrEqual(1);
          weightVitals.forEach((vital) => {
            expect(vital.field).toBe(VitalFieldNames.VitalWeight);
            expect(vital.alertCriticality).toBeUndefined();
          });
        }
      );
      test.concurrent('male patient within mid-90 percentiles for weight and height presents no alert', async () => {
        const patientAge = { units: 'months', value: 36 } as { units: 'months'; value: number };
        const { encounter: maybeEncounter, patient: maybePatient } = await makeTestResources({
          processId,
          oystehr,
          patientAge,
          patientSex: 'male',
        });
        expect(maybeEncounter?.id).toBeDefined();
        expect(maybePatient?.id).toBeDefined();
        assert(maybeEncounter?.id);
        assert(maybePatient?.id);

        const encounterId = maybeEncounter?.id;
        const patientId = maybePatient.id;

        const obs: VitalsObservationDTO[] = [
          {
            encounterId,
            patientId,
            field: VitalFieldNames.VitalWeight,
            value: 15,
          },
          {
            encounterId,
            patientId,
            field: VitalFieldNames.VitalHeight,
            value: 94,
          },
        ];
        await saveVital(obs, encounterId);
        const vitals = await getVitals(encounterId);
        expect(vitals).toBeDefined();
        const heightVitals = vitals[VitalFieldNames.VitalHeight];
        expect(heightVitals.length).toBe(1);
        heightVitals.forEach((vital) => {
          expect(vital.field).toBe(VitalFieldNames.VitalHeight);
          expect(vital.alertCriticality).toBeUndefined();
        });
        const weightVitals = vitals[VitalFieldNames.VitalWeight];
        expect(weightVitals.length).toBeGreaterThanOrEqual(1);
        weightVitals.forEach((vital) => {
          expect(vital.field).toBe(VitalFieldNames.VitalWeight);
          expect(vital.alertCriticality).toBeUndefined();
        });
      });
      test.concurrent('female patient within mid-90 percentiles for weight and height presents no alert', async () => {
        const patientAge = { units: 'months', value: 241 } as { units: 'months'; value: number };
        const { encounter: maybeEncounter, patient: maybePatient } = await makeTestResources({
          processId,
          oystehr,
          patientAge,
          patientSex: 'female',
        });
        expect(maybeEncounter?.id).toBeDefined();
        expect(maybePatient?.id).toBeDefined();
        assert(maybeEncounter?.id);
        assert(maybePatient?.id);

        const encounterId = maybeEncounter?.id;
        const patientId = maybePatient.id;

        const obs: VitalsObservationDTO[] = [
          {
            encounterId,
            patientId,
            field: VitalFieldNames.VitalWeight,
            value: 13,
          },
          {
            encounterId,
            patientId,
            field: VitalFieldNames.VitalHeight,
            value: 95,
          },
        ];
        await saveVital(obs, encounterId);
        const vitals = await getVitals(encounterId);
        expect(vitals).toBeDefined();
        const heightVitals = vitals[VitalFieldNames.VitalHeight];
        expect(heightVitals.length).toBeGreaterThanOrEqual(1);
        heightVitals.forEach((vital) => {
          expect(vital.field).toBe(VitalFieldNames.VitalHeight);
          expect(vital.alertCriticality).toBeUndefined();
        });
        const weightVitals = vitals[VitalFieldNames.VitalWeight];
        expect(weightVitals.length).toBeGreaterThanOrEqual(1);
        weightVitals.forEach((vital) => {
          expect(vital.field).toBe(VitalFieldNames.VitalWeight);
          expect(vital.alertCriticality).toBeUndefined();
        });
      });
      test.concurrent('male patient under 5th percentile for weight produces alert', async () => {
        const patientAge = { units: 'months', value: 36 } as { units: 'months'; value: number };
        const { encounter: maybeEncounter, patient: maybePatient } = await makeTestResources({
          processId,
          oystehr,
          patientAge,
          patientSex: 'male',
        });
        expect(maybeEncounter?.id).toBeDefined();
        expect(maybePatient?.id).toBeDefined();
        assert(maybeEncounter?.id);
        assert(maybePatient?.id);

        const encounterId = maybeEncounter?.id;
        const patientId = maybePatient.id;

        const obs: VitalsObservationDTO[] = [
          {
            encounterId,
            patientId,
            field: VitalFieldNames.VitalWeight,
            value: 11.99, //  35.5 = 11.98, 36.5  = 12.0996
          },
          {
            encounterId,
            patientId,
            field: VitalFieldNames.VitalHeight,
            value: 88.6, // 35.5 = 88.58, 36.5 = 89.20
          },
        ];
        await saveVital(obs, encounterId);
        const vitals = await getVitals(encounterId);
        expect(vitals).toBeDefined();
        const heightVitals = vitals[VitalFieldNames.VitalHeight];
        expect(heightVitals.length).toBeGreaterThanOrEqual(1);
        heightVitals.forEach((vital) => {
          expect(vital.field).toBe(VitalFieldNames.VitalHeight);
          expect(vital.alertCriticality).toBe('abnormal');
        });
        const weightVitals = vitals[VitalFieldNames.VitalWeight];
        expect(weightVitals.length).toBeGreaterThanOrEqual(1);
        weightVitals.forEach((vital) => {
          expect(vital.field).toBe(VitalFieldNames.VitalWeight);
          expect(vital.alertCriticality).toBe('abnormal');
        });
      });
      test.concurrent('female patient under 5th percentile for weight produces alert', async () => {
        const patientAge = { units: 'months', value: 36 } as { units: 'months'; value: number };
        const { encounter: maybeEncounter, patient: maybePatient } = await makeTestResources({
          processId,
          oystehr,
          patientAge,
          patientSex: 'female',
        });
        expect(maybeEncounter?.id).toBeDefined();
        expect(maybePatient?.id).toBeDefined();
        assert(maybeEncounter?.id);
        assert(maybePatient?.id);

        const encounterId = maybeEncounter?.id;
        const patientId = maybePatient.id;

        const obs: VitalsObservationDTO[] = [
          {
            encounterId,
            patientId,
            field: VitalFieldNames.VitalWeight,
            value: 11.55, //  35.5 = 11.54, 36.5  = 11.66
          },
          {
            encounterId,
            patientId,
            field: VitalFieldNames.VitalHeight,
            value: 87.27, // 35.5 = 87.26, 36.5 = 87.80
          },
        ];
        await saveVital(obs, encounterId);
        const vitals = await getVitals(encounterId);
        expect(vitals).toBeDefined();
        const heightVitals = vitals[VitalFieldNames.VitalHeight];
        expect(heightVitals.length).toBeGreaterThanOrEqual(1);
        heightVitals.forEach((vital) => {
          expect(vital.field).toBe(VitalFieldNames.VitalHeight);
          expect(vital.alertCriticality).toBe('abnormal');
        });
        const weightVitals = vitals[VitalFieldNames.VitalWeight];
        expect(weightVitals.length).toBeGreaterThanOrEqual(1);
        weightVitals.forEach((vital) => {
          expect(vital.field).toBe(VitalFieldNames.VitalWeight);
          expect(vital.alertCriticality).toBe('abnormal');
        });
      });
      test.concurrent('male patient over 95th percentile for weight produces alert', async () => {
        const patientAge = { units: 'months', value: 36 } as { units: 'months'; value: number };
        const { encounter: maybeEncounter, patient: maybePatient } = await makeTestResources({
          processId,
          oystehr,
          patientAge,
          patientSex: 'male',
        });
        expect(maybeEncounter?.id).toBeDefined();
        expect(maybePatient?.id).toBeDefined();
        assert(maybeEncounter?.id);
        assert(maybePatient?.id);

        const encounterId = maybeEncounter?.id;
        const patientId = maybePatient.id;

        const obs: VitalsObservationDTO[] = [
          {
            encounterId,
            patientId,
            field: VitalFieldNames.VitalWeight,
            value: 17.65, // 36.5  = 17.51, 37.5 = 17.72
          },
          {
            encounterId,
            patientId,
            field: VitalFieldNames.VitalHeight,
            value: 102, // 36.5 = 101.93, 37.5 = 102.59
          },
        ];
        await saveVital(obs, encounterId);
        const vitals = await getVitals(encounterId);
        expect(vitals).toBeDefined();
        const heightVitals = vitals[VitalFieldNames.VitalHeight];
        expect(heightVitals.length).toBeGreaterThanOrEqual(1);
        heightVitals.forEach((vital) => {
          expect(vital.field).toBe(VitalFieldNames.VitalHeight);
          expect(vital.alertCriticality).toBe('abnormal');
        });
        const weightVitals = vitals[VitalFieldNames.VitalWeight];
        expect(weightVitals.length).toBeGreaterThanOrEqual(1);
        weightVitals.forEach((vital) => {
          expect(vital.field).toBe(VitalFieldNames.VitalWeight);
          expect(vital.alertCriticality).toBe('abnormal');
        });
      });
      test.concurrent('male patient over 95th percentile for weight produces alert', async () => {
        const patientAge = { units: 'months', value: 36 } as { units: 'months'; value: number };
        const { encounter: maybeEncounter, patient: maybePatient } = await makeTestResources({
          processId,
          oystehr,
          patientAge,
          patientSex: 'female',
        });
        expect(maybeEncounter?.id).toBeDefined();
        expect(maybePatient?.id).toBeDefined();
        assert(maybeEncounter?.id);
        assert(maybePatient?.id);

        const encounterId = maybeEncounter?.id;
        const patientId = maybePatient.id;

        const obs: VitalsObservationDTO[] = [
          {
            encounterId,
            patientId,
            field: VitalFieldNames.VitalWeight,
            value: 17.4, // 36.5  = 17.36, 37.5 = 17.6
          },
          {
            encounterId,
            patientId,
            field: VitalFieldNames.VitalHeight,
            value: 100.9, // 36.5 = 100.83, 37.5 = 101.47
          },
        ];
        await saveVital(obs, encounterId);
        const vitals = await getVitals(encounterId);
        expect(vitals).toBeDefined();
        const heightVitals = vitals[VitalFieldNames.VitalHeight];
        expect(heightVitals.length).toBeGreaterThanOrEqual(1);
        heightVitals.forEach((vital) => {
          expect(vital.field).toBe(VitalFieldNames.VitalHeight);
          expect(vital.alertCriticality).toBe('abnormal');
        });
        const weightVitals = vitals[VitalFieldNames.VitalWeight];
        expect(weightVitals.length).toBeGreaterThanOrEqual(1);
        weightVitals.forEach((vital) => {
          expect(vital.field).toBe(VitalFieldNames.VitalWeight);
          expect(vital.alertCriticality).toBe('abnormal');
        });
      });
    },
    { timeout: DEFAULT_SUITE_TIMEOUT }
  );
});
