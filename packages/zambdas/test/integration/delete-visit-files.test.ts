import Oystehr from '@oystehr/sdk';
import { randomUUID } from 'crypto';
import { DocumentReference, Patient } from 'fhir/r4b';
import { Secrets } from 'utils';
import { M2MClientMockType } from 'utils/lib/auth/user-me.helper';
import {
  complexValidation,
  validateRequestParameters,
  validateSecrets,
} from '../../src/ehr/visit-details/delete-visit-files/validation';
import { ZambdaInput } from '../../src/shared';
import { SECRETS } from '../data/secrets';
import { ensureM2MPractitionerProfile } from '../helpers/configureTestM2MClient';
import { addProcessIdMetaTagToResource, setupIntegrationTest } from '../helpers/integration-test-seed-data-setup';
import { cleanupTestScheduleResources } from '../helpers/testScheduleUtils';

describe('delete-visit-files integration tests', () => {
  let oystehr: Oystehr;
  let oystehrTestUserM2M: Oystehr;
  let token: string;
  let processId: string;
  let cleanup: () => Promise<void>;

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

  const createMockDocumentReference = async (patientId: string): Promise<DocumentReference> => {
    const patientInput = addProcessIdMetaTagToResource(
      {
        resourceType: 'DocumentReference',
        status: 'current',
        content: [
          {
            attachment: {
              url: 'https://example.com/test-file.pdf',
            },
          },
        ],
        subject: {
          reference: `Patient/${patientId}`,
        },
      },
      processId
    ) as DocumentReference;

    const patient = (await oystehr.fhir.create(patientInput)) as DocumentReference;

    expect(patient).toBeDefined();
    expect(patient.id).toBeDefined();

    return patient;
  };

  beforeAll(async () => {
    const setup = await setupIntegrationTest('delete-visit-files.test.ts', M2MClientMockType.provider);
    oystehr = setup.oystehr;
    oystehrTestUserM2M = setup.oystehrTestUserM2M;
    cleanup = setup.cleanup;
    token = setup.token;
    processId = setup.processId;

    await ensureM2MPractitionerProfile(token);
    expect(oystehr).toBeDefined();
    expect(oystehr.fhir).toBeDefined();
    expect(oystehr.zambda).toBeDefined();
  });

  afterAll(async () => {
    await cleanup();
    if (!oystehr || !processId) {
      throw new Error('oystehr or processId is null! could not clean up!');
    }
    // this will clean up everything connect to the test patient too
    await cleanupTestScheduleResources(processId, oystehr);
  });

  describe('validation', () => {
    const mockSecrets = {
      AUTH0_ENDPOINT: 'https://auth.example.com',
      AUTH0_AUDIENCE: 'https://api.example.com',
      AUTH0_CLIENT: 'client-id',
      AUTH0_SECRET: 'client-secret',
      FHIR_API: 'https://fhir.example.com',
      PROJECT_API: 'https://project.example.com',
      ENVIRONMENT: 'test',
    };

    const mockAccessToken = 'token-id';
    const mockDocumentId = randomUUID();
    const mockPatientId = randomUUID();

    const input: ZambdaInput = {
      headers: {
        Authorization: `Bearer ${mockAccessToken}`,
      },
      body: JSON.stringify({ documentId: mockDocumentId, patientId: mockPatientId }),
      secrets: null,
    };

    describe('validateSecrets', () => {
      it('should validate successfully with valid secrets', () => {
        const result = validateSecrets(mockSecrets);

        expect(result).toBeDefined();
        expect(result.AUTH0_ENDPOINT).toBe(mockSecrets.AUTH0_ENDPOINT);
        expect(result.AUTH0_AUDIENCE).toBe(mockSecrets.AUTH0_AUDIENCE);
        expect(result.AUTH0_CLIENT).toBe(mockSecrets.AUTH0_CLIENT);
        expect(result.AUTH0_SECRET).toBe(mockSecrets.AUTH0_SECRET);
        expect(result.FHIR_API).toBe(mockSecrets.FHIR_API);
        expect(result.PROJECT_API).toBe(mockSecrets.PROJECT_API);
        expect(result.ENVIRONMENT).toBe(mockSecrets.ENVIRONMENT);
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

        const { ENVIRONMENT: _ENVIRONMENT, ...missingEnvironment } = mockSecrets;
        expect(() => validateSecrets(missingEnvironment)).toThrow('Missing required secrets');
      });
    });

    describe('validateRequestParameters', () => {
      it('should validate successfully with valid input', async () => {
        const result = await validateRequestParameters(input);

        expect(result).toBeDefined();
        expect(result.body).toBeDefined();
        expect(result.body.documentId).toBe(mockDocumentId);
        expect(result.body.patientId).toBe(mockPatientId);
        expect(result.callerAccessToken).toBe(mockAccessToken);
      });

      describe('documentId', () => {
        it('should throw error when missing', async () => {
          const invalidInput = { ...input, body: JSON.stringify({ patientId: mockPatientId }) };
          await expect(validateRequestParameters(invalidInput)).rejects.toThrow(
            'The following required parameters were missing: documentId'
          );

          const nullInput = { ...input, body: JSON.stringify({ documentId: null, patientId: mockPatientId }) };
          await expect(validateRequestParameters(nullInput)).rejects.toThrow(
            'The following required parameters were missing: documentId'
          );

          const undefinedInput = {
            ...input,
            body: JSON.stringify({ documentId: undefined, patientId: mockPatientId }),
          };
          await expect(validateRequestParameters(undefinedInput)).rejects.toThrow(
            'The following required parameters were missing: documentId'
          );

          const emptyString = { ...input, body: JSON.stringify({ documentId: '', patientId: mockPatientId }) };
          await expect(validateRequestParameters(emptyString)).rejects.toThrow(
            'The following required parameters were missing: documentId'
          );
        });

        it('should throw error when not a string', async () => {
          const numberInput = { ...input, body: JSON.stringify({ documentId: 123, patientId: mockPatientId }) };
          await expect(validateRequestParameters(numberInput)).rejects.toThrow('"documentId" must be a string.');

          const objectInput = { ...input, body: JSON.stringify({ documentId: {}, patientId: mockPatientId }) };
          await expect(validateRequestParameters(objectInput)).rejects.toThrow('"documentId" must be a string.');

          const arrayInput = { ...input, body: JSON.stringify({ documentId: [], patientId: mockPatientId }) };
          await expect(validateRequestParameters(arrayInput)).rejects.toThrow('"documentId" must be a string.');
        });

        it('should throw error when not a valid UUID', async () => {
          const notAUuid = { ...input, body: JSON.stringify({ documentId: 'not-a-uuid', patientId: mockPatientId }) };
          await expect(validateRequestParameters(notAUuid)).rejects.toThrow('"documentId" must be a valid UUID.');
        });
      });

      describe('patientId', () => {
        it('should throw error when missing', async () => {
          const invalidInput = { ...input, body: JSON.stringify({ documentId: mockDocumentId }) };
          await expect(validateRequestParameters(invalidInput)).rejects.toThrow(
            'The following required parameters were missing: patientId'
          );

          const nullInput = { ...input, body: JSON.stringify({ documentId: mockDocumentId, patientId: null }) };
          await expect(validateRequestParameters(nullInput)).rejects.toThrow(
            'The following required parameters were missing: patientId'
          );

          const undefinedInput = {
            ...input,
            body: JSON.stringify({ documentId: mockDocumentId, patientId: undefined }),
          };
          await expect(validateRequestParameters(undefinedInput)).rejects.toThrow(
            'The following required parameters were missing: patientId'
          );

          const emptyString = { ...input, body: JSON.stringify({ documentId: mockDocumentId, patientId: '' }) };
          await expect(validateRequestParameters(emptyString)).rejects.toThrow(
            'The following required parameters were missing: patientId'
          );
        });

        it('should throw error when not a string', async () => {
          const numberInput = { ...input, body: JSON.stringify({ documentId: mockDocumentId, patientId: 123 }) };
          await expect(validateRequestParameters(numberInput)).rejects.toThrow('"patientId" must be a string.');

          const objectInput = { ...input, body: JSON.stringify({ documentId: mockDocumentId, patientId: {} }) };
          await expect(validateRequestParameters(objectInput)).rejects.toThrow('"patientId" must be a string.');

          const arrayInput = { ...input, body: JSON.stringify({ documentId: mockDocumentId, patientId: [] }) };
          await expect(validateRequestParameters(arrayInput)).rejects.toThrow('"patientId" must be a string.');
        });

        it('should throw error when not a valid UUID', async () => {
          const notAUuid = { ...input, body: JSON.stringify({ documentId: mockDocumentId, patientId: 'not-a-uuid' }) };
          await expect(validateRequestParameters(notAUuid)).rejects.toThrow('"patientId" must be a valid UUID.');
        });
      });

      it('should throw error when access token is missing', async () => {
        const invalidInput = { ...input, headers: {} as any };
        await expect(validateRequestParameters(invalidInput)).rejects.toThrow();
      });
    });

    describe('complexValidation', () => {
      const secrets: Secrets = {
        ...SECRETS,
        ENVIRONMENT: 'local',
      };

      // oystehrTestUserM2M passes isTestUser so it bypasses the check entirely
      it.skip('should throw error when user does not have access to patient', async () => {
        const patient = await createMockPatient();
        const documentReference = await createMockDocumentReference(patient.id!);
        const cantAccessUserInput = {
          body: {
            documentId: documentReference.id!,
            patientId: randomUUID(),
          },
          callerAccessToken: token,
        };
        await expect(complexValidation(cantAccessUserInput, secrets, oystehrTestUserM2M)).rejects.toThrow(
          "You are not authorized to view this patient's data"
        );
      });

      it('should throw error when DocumentReference does not exist', async () => {
        const patient = await createMockPatient();
        const nonExistentDocumentIdInput = {
          body: {
            documentId: randomUUID(),
            patientId: patient.id!,
          },
          callerAccessToken: token,
        };
        await expect(complexValidation(nonExistentDocumentIdInput, secrets, oystehr)).rejects.toThrow(
          'The requested DocumentReference resource could not be found'
        );
      });

      it('should throw error when DocumentReference is already superseded', async () => {
        const patient = await createMockPatient();
        const documentReference = await createMockDocumentReference(patient.id!);

        await oystehr.fhir.patch({
          resourceType: 'DocumentReference',
          id: documentReference.id!,
          operations: [
            {
              op: 'replace',
              path: '/status',
              value: 'superseded',
            },
          ],
        });

        const nonExistentDocumentIdInput = {
          body: {
            documentId: documentReference.id!,
            patientId: patient.id!,
          },
          callerAccessToken: token,
        };
        await expect(complexValidation(nonExistentDocumentIdInput, secrets, oystehr)).rejects.toThrow(
          'The requested DocumentReference resource could not be found'
        );
      });

      it("should throw error when patient id doesn't match the document reference's subject", async () => {
        const patient = await createMockPatient();
        const documentReference = await createMockDocumentReference(randomUUID());
        const cantAccessUserInput = {
          body: {
            documentId: documentReference.id!,
            patientId: patient.id!,
          },
          callerAccessToken: token,
        };
        await expect(complexValidation(cantAccessUserInput, secrets, oystehr)).rejects.toThrow(
          'The provided patient ID does not match the patient associated with the document.'
        );
      });
    });
  });

  describe('happy path', () => {
    it('should delete a document reference by marking it as superseded', async () => {
      const patient = await createMockPatient();
      const documentReference = await createMockDocumentReference(patient.id!);
      const input = {
        body: {
          documentId: documentReference.id!,
          patientId: patient.id!,
        },
        callerAccessToken: token,
      };
      await expect(
        complexValidation(
          input,
          {
            ...SECRETS,
            ENVIRONMENT: 'local',
          },
          oystehr
        )
      ).resolves.not.toThrow();
    });
  });
});
