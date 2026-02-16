import Oystehr from '@oystehr/sdk';
import { CandidApi, CandidApiClient } from 'candidhealth';
import { APIResponse } from 'candidhealth/core';
import { randomUUID } from 'crypto';
import { Appointment, Encounter, Patient } from 'fhir/r4b';
import { DateTime } from 'luxon';
import { GetPatientBalancesZambdaOutput } from 'utils';
import { afterAll, beforeAll, describe, expect, inject, it } from 'vitest';
import { AUTH0_CLIENT_TESTS, AUTH0_SECRET_TESTS } from '../../.env/local.json';
import { performEffect } from '../../src/ehr/get-patient-balances';
import { validateInput, validateSecrets } from '../../src/ehr/get-patient-balances/validateRequestParameters';
import { CANDID_ENCOUNTER_ID_IDENTIFIER_SYSTEM, getAuth0Token, ZambdaInput } from '../../src/shared';
import { SECRETS } from '../data/secrets';
import { ensureM2MPractitionerProfile } from '../helpers/configureTestM2MClient';
import { addProcessIdMetaTagToResource } from '../helpers/integration-test-seed-data-setup';
import { cleanupTestScheduleResources } from '../helpers/testScheduleUtils';

function createMockCandidApiClient(
  encounterResponses: Map<string, { claimId: string }> = new Map(),
  claimResponses: Map<string, { patientBalanceCents: number }> = new Map()
): CandidApiClient {
  return {
    encounters: {
      v4: {
        get: async (
          encounterId: CandidApi.EncounterId
        ): Promise<APIResponse<CandidApi.encounters.v4.Encounter, CandidApi.encounters.v4.get.Error._Unknown>> => {
          const encounterData = encounterResponses.get(encounterId);
          if (!encounterData) {
            return {
              ok: false,
              error: {
                errorName: 'NotFound',
                content: {},
                _visit: () => {},
              } as unknown as CandidApi.encounters.v4.get.Error._Unknown,
              rawResponse: {} as Response,
            };
          }
          return {
            ok: true,
            body: {
              encounterId,
              claims: [{ claimId: encounterData.claimId }],
            } as CandidApi.encounters.v4.Encounter,
            rawResponse: {} as Response,
          };
        },
      },
    },
    patientAr: {
      v1: {
        itemize: async (
          claimId: CandidApi.ClaimId
        ): Promise<
          APIResponse<CandidApi.patientAr.v1.InvoiceItemizationResponse, CandidApi.patientAr.v1.itemize.Error>
        > => {
          const claimData = claimResponses.get(claimId);
          if (!claimData) {
            return {
              ok: false,
              error: {
                _type: 'entityNotFoundError',
              } as unknown as CandidApi.patientAr.v1.itemize.Error,
              rawResponse: {} as Response,
            };
          }
          return {
            ok: true,
            body: {
              claimId,
              patientBalanceCents: claimData.patientBalanceCents,
            } as CandidApi.patientAr.v1.InvoiceItemizationResponse,
            rawResponse: {} as Response,
          };
        },
      },
    },
  } as CandidApiClient;
}

describe('get-patient-balances integration tests', () => {
  let oystehr: Oystehr;
  let token: string;
  let processId: string;

  const getPatientBalances = async (
    patientId: string,
    candidApiClient: CandidApiClient
  ): Promise<GetPatientBalancesZambdaOutput> => {
    const validatedInput = {
      body: { patientId },
      callerAccessToken: token,
    };
    return performEffect(validatedInput, oystehr, candidApiClient);
  };

  const createMockPatient = async (): Promise<Patient> => {
    const patientInput = addProcessIdMetaTagToResource(
      {
        resourceType: 'Patient',
        name: [{ given: ['First'], family: 'Last' }],
        birthDate: '2000-01-01',
        gender: 'male',
        telecom: [
          {
            system: 'email',
            value: '+15555555555',
          },
        ],
      },
      processId
    ) as Patient;

    const patient = (await oystehr.fhir.create(patientInput)) as Patient;

    expect(patient).toBeDefined();
    expect(patient.id).toBeDefined();

    return patient;
  };

  const createMockAppointment = async ({
    patientId,
    processId,
  }: {
    patientId: string;
    processId: string;
  }): Promise<Appointment> => {
    const now = DateTime.now();
    const appointmentInput = addProcessIdMetaTagToResource(
      {
        resourceType: 'Appointment',
        status: 'booked',
        start: now.toISO(),
        end: now.plus({ hours: 1 }).toISO(),
        participant: [
          {
            actor: {
              reference: `Patient/${patientId}`,
            },
            status: 'accepted',
          },
        ],
      },
      processId
    ) as Appointment;

    const appointment = (await oystehr.fhir.create(appointmentInput)) as Appointment;

    expect(appointment).toBeDefined();
    expect(appointment.id).toBeDefined();

    return appointment;
  };

  const createMockEncounter = async ({
    patientId,
    appointmentId,
    processId,
    candidId,
  }: {
    patientId: string;
    appointmentId: string;
    processId: string;
    candidId: string;
  }): Promise<Encounter> => {
    const encounterInput = addProcessIdMetaTagToResource(
      {
        resourceType: 'Encounter',
        status: 'finished',
        subject: {
          reference: `Patient/${patientId}`,
        },
        appointment: [
          {
            reference: `Appointment/${appointmentId}`,
          },
        ],
        class: {
          system: 'http://terminology.hl7.org/CodeSystem/v3-ActCode',
          code: 'AMB',
        },
        identifier: [
          {
            system: CANDID_ENCOUNTER_ID_IDENTIFIER_SYSTEM,
            value: candidId,
          },
        ],
      },
      processId
    ) as Encounter;

    const encounter = (await oystehr.fhir.create(encounterInput)) as Encounter;

    expect(encounter).toBeDefined();
    expect(encounter.id).toBeDefined();

    return encounter;
  };

  beforeAll(async () => {
    processId = randomUUID();
    const { AUTH0_ENDPOINT, AUTH0_AUDIENCE, FHIR_API, PROJECT_ID } = SECRETS;
    const EXECUTE_ZAMBDA_URL = inject('EXECUTE_ZAMBDA_URL');
    expect(EXECUTE_ZAMBDA_URL).toBeDefined();
    token = await getAuth0Token({
      AUTH0_ENDPOINT: AUTH0_ENDPOINT,
      AUTH0_CLIENT: AUTH0_CLIENT_TESTS,
      AUTH0_SECRET: AUTH0_SECRET_TESTS,
      AUTH0_AUDIENCE: AUTH0_AUDIENCE,
    });

    oystehr = new Oystehr({
      accessToken: token,
      fhirApiUrl: FHIR_API,
      projectApiUrl: EXECUTE_ZAMBDA_URL,
      projectId: PROJECT_ID,
    });

    await ensureM2MPractitionerProfile(token);

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

  describe('validation', () => {
    describe('validateSecrets', () => {
      const mockSecrets = {
        AUTH0_ENDPOINT: 'https://auth.example.com',
        AUTH0_AUDIENCE: 'https://api.example.com',
        AUTH0_CLIENT: 'client-id',
        AUTH0_SECRET: 'client-secret',
        FHIR_API: 'https://fhir.example.com',
        PROJECT_API: 'https://project.example.com',
        CANDID_CLIENT_ID: 'candid-client-id',
        CANDID_CLIENT_SECRET: 'candid-client-secret',
        CANDID_ENV: 'production',
      };

      it('should validate successfully with valid secrets', () => {
        const result = validateSecrets(mockSecrets);

        expect(result).toBeDefined();
        expect(result.AUTH0_ENDPOINT).toBe(mockSecrets.AUTH0_ENDPOINT);
        expect(result.AUTH0_AUDIENCE).toBe(mockSecrets.AUTH0_AUDIENCE);
        expect(result.AUTH0_CLIENT).toBe(mockSecrets.AUTH0_CLIENT);
        expect(result.AUTH0_SECRET).toBe(mockSecrets.AUTH0_SECRET);
        expect(result.FHIR_API).toBe(mockSecrets.FHIR_API);
        expect(result.PROJECT_API).toBe(mockSecrets.PROJECT_API);
        expect(result.CANDID_CLIENT_ID).toBe(mockSecrets.CANDID_CLIENT_ID);
        expect(result.CANDID_CLIENT_SECRET).toBe(mockSecrets.CANDID_CLIENT_SECRET);
        expect(result.CANDID_ENV).toBe(mockSecrets.CANDID_ENV);
      });

      it('should throw error when secrets parameter is missing', () => {
        expect(() => validateSecrets(null)).toThrow('Secrets are required');
      });

      it('should throw error when any required secret is missing', () => {
        const { AUTH0_ENDPOINT: _AUTH0_ENDPOINT, ...missingAuth0Endpoint } = mockSecrets;
        expect(() => validateSecrets(missingAuth0Endpoint)).toThrow('Missing required secrets');

        const { AUTH0_AUDIENCE: _AUTH0_AUDIENCE, ...missingAuth0Audience } = mockSecrets;
        expect(() => validateSecrets(missingAuth0Audience)).toThrow('Missing required secrets');

        const { AUTH0_CLIENT: _AUTH0_CLIENT, ...missingAuth0Client } = mockSecrets;
        expect(() => validateSecrets(missingAuth0Client)).toThrow('Missing required secrets');

        const { AUTH0_SECRET: _AUTH0_SECRET, ...missingAuth0Secret } = mockSecrets;
        expect(() => validateSecrets(missingAuth0Secret)).toThrow('Missing required secrets');

        const { FHIR_API: _FHIR_API, ...missingFhirApi } = mockSecrets;
        expect(() => validateSecrets(missingFhirApi)).toThrow('Missing required secrets');

        const { PROJECT_API: _PROJECT_API, ...missingProjectApi } = mockSecrets;
        expect(() => validateSecrets(missingProjectApi)).toThrow('Missing required secrets');

        const { CANDID_CLIENT_ID: _CANDID_CLIENT_ID, ...missingCandidClientId } = mockSecrets;
        expect(() => validateSecrets(missingCandidClientId)).toThrow('Missing required secrets');

        const { CANDID_CLIENT_SECRET: _CANDID_CLIENT_SECRET, ...missingCandidClientSecret } = mockSecrets;
        expect(() => validateSecrets(missingCandidClientSecret)).toThrow('Missing required secrets');

        const { CANDID_ENV: _CANDID_ENV, ...missingCandidEnv } = mockSecrets;
        expect(() => validateSecrets(missingCandidEnv)).toThrow('Missing required secrets');
      });
    });

    describe('validateInput', () => {
      const mockPatientId = randomUUID();
      const mockAccessToken = 'token-id';

      const input: ZambdaInput = {
        headers: {
          Authorization: `Bearer ${mockAccessToken}`,
        },
        body: JSON.stringify({ patientId: mockPatientId }),
        secrets: null,
      };

      it('should validate successfully with valid input', async () => {
        const result = await validateInput(input);

        expect(result).toBeDefined();
        expect(result.body).toBeDefined();
        expect(result.body.patientId).toBe(mockPatientId);
        expect(result.callerAccessToken).toBe(mockAccessToken);
      });

      it('should throw error when patientId is missing', async () => {
        const invalidInput = { ...input, body: JSON.stringify({}) };
        await expect(validateInput(invalidInput)).rejects.toThrow('patientId is required');

        const nullInput = { ...input, body: JSON.stringify({ patientId: null }) };
        await expect(validateInput(nullInput)).rejects.toThrow('patientId is required');

        const undefinedInput = { ...input, body: JSON.stringify({ patientId: undefined }) };
        await expect(validateInput(undefinedInput)).rejects.toThrow('patientId is required');

        const emptyString = { ...input, body: JSON.stringify({ patientId: '' }) };
        await expect(validateInput(emptyString)).rejects.toThrow('patientId is required');
      });

      it('should throw error when patientId is not a string', async () => {
        const numberInput = { ...input, body: JSON.stringify({ patientId: 123 }) };
        await expect(validateInput(numberInput)).rejects.toThrow('patientId must be a string');

        const objectInput = { ...input, body: JSON.stringify({ patientId: {} }) };
        await expect(validateInput(objectInput)).rejects.toThrow('patientId must be a string');

        const arrayInput = { ...input, body: JSON.stringify({ patientId: [] }) };
        await expect(validateInput(arrayInput)).rejects.toThrow('patientId must be a string');
      });

      it('should throw error when patientId is not a valid UUID', async () => {
        const notAUuid = { ...input, body: JSON.stringify({ patientId: 'not-a-uuid' }) };
        await expect(validateInput(notAUuid)).rejects.toThrow('patientId must be a valid UUID');
      });

      it('should throw error when access token is missing', async () => {
        const invalidInput = { ...input, headers: {} as any };
        await expect(validateInput(invalidInput)).rejects.toThrow();
      });
    });
  });

  describe('happy paths', () => {
    it('should return empty balances for patient with no encounters', async () => {
      const patient = await createMockPatient();
      const mockCandidClient = createMockCandidApiClient();
      const response = await getPatientBalances(patient.id!, mockCandidClient);

      expect(response).toBeDefined();
      expect(response.encounters).toEqual([]);
      expect(response.totalBalanceCents).toBe(0);
    });

    it('should return balance for patient with an encounter', async () => {
      const patient = await createMockPatient();
      const appointment = await createMockAppointment({ patientId: patient.id!, processId });
      const candidEncounterId = randomUUID();
      const claimId = randomUUID();
      await createMockEncounter({
        patientId: patient.id!,
        appointmentId: appointment.id!,
        processId,
        candidId: candidEncounterId,
      });

      const mockCandidClient = createMockCandidApiClient(
        new Map([[candidEncounterId, { claimId }]]),
        new Map([[claimId, { patientBalanceCents: 5000 }]])
      );

      const response = await getPatientBalances(patient.id!, mockCandidClient);
      expect(response).toBeDefined();
      expect(response.totalBalanceCents).toBe(5000);
      expect(response.encounters).toBeDefined();
      expect(response.encounters.length).toBe(1);

      expect(response.encounters[0]).toBeDefined();
      expect(response.encounters[0]?.appointmentId).toBe(appointment.id);
      expect(response.encounters[0]?.patientBalanceCents).toBe(5000);
      expect(response.encounters[0]?.encounterDate).toBe(appointment.start);

      expect(response.totalBalanceCents).toBe(response.encounters[0]?.patientBalanceCents);
    });

    it('should return balances for patient with multiple encounters', async () => {
      const patient = await createMockPatient();
      const appointment = await createMockAppointment({ patientId: patient.id!, processId });
      const candidEncounterId = randomUUID();
      const claimId = randomUUID();
      await createMockEncounter({
        patientId: patient.id!,
        appointmentId: appointment.id!,
        processId,
        candidId: candidEncounterId,
      });
      const appointment2 = await createMockAppointment({ patientId: patient.id!, processId });
      const candidEncounterId2 = randomUUID();
      const claimId2 = randomUUID();
      await createMockEncounter({
        patientId: patient.id!,
        appointmentId: appointment2.id!,
        processId,
        candidId: candidEncounterId2,
      });

      const mockCandidClient = createMockCandidApiClient(
        new Map([
          [candidEncounterId, { claimId: claimId }],
          [candidEncounterId2, { claimId: claimId2 }],
        ]),
        new Map([
          [claimId, { patientBalanceCents: 5000 }],
          [claimId2, { patientBalanceCents: 3000 }],
        ])
      );

      const response = await getPatientBalances(patient.id!, mockCandidClient);
      expect(response).toBeDefined();
      expect(response.totalBalanceCents).toBe(8000);
      expect(response.encounters).toBeDefined();
      expect(response.encounters.length).toBe(2);

      const encounter1 = response.encounters.find((e) => e.appointmentId === appointment.id);
      expect(encounter1).toBeDefined();
      expect(encounter1?.appointmentId).toBe(appointment.id);
      expect(encounter1?.patientBalanceCents).toBe(5000);
      expect(encounter1?.encounterDate).toBe(appointment.start);

      const encounter2 = response.encounters.find((e) => e.appointmentId === appointment2.id);
      expect(encounter2).toBeDefined();
      expect(encounter2?.appointmentId).toBe(appointment2.id);
      expect(encounter2?.patientBalanceCents).toBe(3000);
      expect(encounter2?.encounterDate).toBe(appointment2.start);

      expect(response.totalBalanceCents).toBe(
        response.encounters[0]?.patientBalanceCents + response.encounters[1]?.patientBalanceCents
      );
    });
  });

  describe('unhappy paths', () => {
    it('should throw error when encounter is missing appointment reference', async () => {
      const patient = await createMockPatient();
      const candidEncounterId = randomUUID();
      const encounterInput = addProcessIdMetaTagToResource(
        {
          resourceType: 'Encounter',
          status: 'finished',
          subject: {
            reference: `Patient/${patient.id}`,
          },
          class: {
            system: 'http://terminology.hl7.org/CodeSystem/v3-ActCode',
            code: 'AMB',
          },
          identifier: [
            {
              system: CANDID_ENCOUNTER_ID_IDENTIFIER_SYSTEM,
              value: candidEncounterId,
            },
          ],
        },
        processId
      ) as Encounter;

      await oystehr.fhir.create(encounterInput);

      const mockCandidClient = createMockCandidApiClient();

      await expect(getPatientBalances(patient.id!, mockCandidClient)).rejects.toThrow(
        /Encounter is missing appointmentId, encounterDate, or candidId/
      );
    });

    it('should throw error when appointment is missing start date', async () => {
      const patient = await createMockPatient();
      const candidEncounterId = randomUUID();

      const appointmentInput = addProcessIdMetaTagToResource(
        {
          resourceType: 'Appointment',
          // proposed means an appointment doesn't have to have a start time
          status: 'proposed',
          participant: [
            {
              actor: {
                reference: `Patient/${patient.id}`,
              },
              status: 'accepted',
            },
          ],
        },
        processId
      ) as Appointment;

      const appointment = (await oystehr.fhir.create(appointmentInput)) as Appointment;

      const encounterInput = addProcessIdMetaTagToResource(
        {
          resourceType: 'Encounter',
          status: 'finished',
          subject: {
            reference: `Patient/${patient.id}`,
          },
          appointment: [
            {
              reference: `Appointment/${appointment.id}`,
            },
          ],
          class: {
            system: 'http://terminology.hl7.org/CodeSystem/v3-ActCode',
            code: 'AMB',
          },
          identifier: [
            {
              system: CANDID_ENCOUNTER_ID_IDENTIFIER_SYSTEM,
              value: candidEncounterId,
            },
          ],
        },
        processId
      ) as Encounter;

      await oystehr.fhir.create(encounterInput);

      const mockCandidClient = createMockCandidApiClient();

      await expect(getPatientBalances(patient.id!, mockCandidClient)).rejects.toThrow(
        /Encounter is missing appointmentId, encounterDate, or candidId/
      );
    });

    it('should throw error when Candid encounter API returns error', async () => {
      const patient = await createMockPatient();
      const appointment = await createMockAppointment({ patientId: patient.id!, processId });
      const candidEncounterId = randomUUID();
      await createMockEncounter({
        patientId: patient.id!,
        appointmentId: appointment.id!,
        processId,
        candidId: candidEncounterId,
      });

      // Mock client that returns error for encounter
      const mockCandidClient = createMockCandidApiClient();

      await expect(getPatientBalances(patient.id!, mockCandidClient)).rejects.toThrow(
        /Failed to fetch Candid encounter/
      );
    });

    it('should throw error when Candid encounter has multiple claims', async () => {
      const patient = await createMockPatient();
      const appointment = await createMockAppointment({ patientId: patient.id!, processId });
      const candidEncounterId = randomUUID();
      await createMockEncounter({
        patientId: patient.id!,
        appointmentId: appointment.id!,
        processId,
        candidId: candidEncounterId,
      });

      // Create mock client with multiple claims
      const mockCandidClient = {
        encounters: {
          v4: {
            get: async (encounterId: CandidApi.EncounterId) => {
              return {
                ok: true,
                body: {
                  encounterId,
                  claims: [{ claimId: randomUUID() }, { claimId: randomUUID() }],
                } as CandidApi.encounters.v4.Encounter,
                rawResponse: {} as Response,
              };
            },
          },
        },
        patientAr: {
          v1: {
            itemize: async () => ({
              ok: true,
              body: {} as CandidApi.patientAr.v1.InvoiceItemizationResponse,
              rawResponse: {} as Response,
            }),
          },
        },
      } as unknown as CandidApiClient;

      await expect(getPatientBalances(patient.id!, mockCandidClient)).rejects.toThrow(
        /Expected exactly one claim per encounter, but got 2/
      );
    });

    it('should throw error when Candid encounter has zero claims', async () => {
      const patient = await createMockPatient();
      const appointment = await createMockAppointment({ patientId: patient.id!, processId });
      const candidEncounterId = randomUUID();
      await createMockEncounter({
        patientId: patient.id!,
        appointmentId: appointment.id!,
        processId,
        candidId: candidEncounterId,
      });

      // Create mock client with zero claims
      const mockCandidClient = {
        encounters: {
          v4: {
            get: async (encounterId: CandidApi.EncounterId) => {
              return {
                ok: true,
                body: {
                  encounterId,
                  claims: [],
                } as unknown as CandidApi.encounters.v4.Encounter,
                rawResponse: {} as Response,
              };
            },
          },
        },
        patientAr: {
          v1: {
            itemize: async () => ({
              ok: true,
              body: {} as CandidApi.patientAr.v1.InvoiceItemizationResponse,
              rawResponse: {} as Response,
            }),
          },
        },
      } as unknown as CandidApiClient;

      await expect(getPatientBalances(patient.id!, mockCandidClient)).rejects.toThrow(
        /Expected exactly one claim per encounter, but got 0/
      );
    });

    it('should throw error when Candid claim API returns error', async () => {
      const patient = await createMockPatient();
      const appointment = await createMockAppointment({ patientId: patient.id!, processId });
      const candidEncounterId = randomUUID();
      const claimId = randomUUID();
      await createMockEncounter({
        patientId: patient.id!,
        appointmentId: appointment.id!,
        processId,
        candidId: candidEncounterId,
      });

      // Mock client where encounter succeeds but claim itemization fails
      const mockCandidClient = createMockCandidApiClient(
        new Map([[candidEncounterId, { claimId }]]),
        new Map() // Empty claim responses - will return error
      );

      await expect(getPatientBalances(patient.id!, mockCandidClient)).rejects.toThrow(/Failed to fetch Candid claim/);
    });

    it('should throw error when encounter has no Candid ID', async () => {
      const patient = await createMockPatient();
      const appointment = await createMockAppointment({ patientId: patient.id!, processId });

      // Create encounter without Candid ID
      const encounterInput = addProcessIdMetaTagToResource(
        {
          resourceType: 'Encounter',
          status: 'finished',
          subject: {
            reference: `Patient/${patient.id}`,
          },
          appointment: [
            {
              reference: `Appointment/${appointment.id}`,
            },
          ],
          class: {
            system: 'http://terminology.hl7.org/CodeSystem/v3-ActCode',
            code: 'AMB',
          },
        },
        processId
      ) as Encounter;

      await oystehr.fhir.create(encounterInput);

      const mockCandidClient = createMockCandidApiClient();

      await expect(getPatientBalances(patient.id!, mockCandidClient)).rejects.toThrow(
        /Encounter is missing appointmentId, encounterDate, or candidId/
      );
    });
  });
});
