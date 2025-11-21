import { assert } from 'node:console';
import Oystehr, { BatchInputPostRequest, M2mListItem } from '@oystehr/sdk';
import fastSeedData from 'ehr-ui/tests/e2e-utils/seed-data/seed-ehr-appointment-data.json' assert { type: 'json' };
import {
  Appointment,
  ClinicalImpression,
  Consent,
  DocumentReference,
  Encounter,
  FhirResource,
  List,
  Patient,
  Person,
  Practitioner,
  QuestionnaireResponse,
  RelatedPerson,
  ServiceRequest,
  Slot,
} from 'fhir/r4b';
import { DateTime } from 'luxon';
import { cleanAppointmentGraph, M2MClientMockType, RoleType } from 'utils';
import { inject } from 'vitest';
import inPersonIntakeQuestionnaire from '../../../../config/oystehr/in-person-intake-questionnaire.json' assert { type: 'json' };
import { AUTH0_CLIENT_TESTS, AUTH0_SECRET_TESTS } from '../../.env/local.json';
import { getAuth0Token } from '../../src/shared';
import { SECRETS } from '../data/secrets';

/**
 * Constants for integration test setup
 */
export const INTEGRATION_TEST_PROCESS_ID_SYSTEM = 'INTEGRATION_TEST_PROCESS_ID_SYSTEM';

/**
 * Interface for the base appointment data result
 */
export interface InsertFullAppointmentDataBaseResult {
  patient: Patient;
  relatedPerson: RelatedPerson;
  appointment: Appointment;
  encounter: Encounter;
  questionnaireResponse: QuestionnaireResponse;
}

/**
 * Interface for the integration test setup result
 */
export interface IntegrationTestSetupResult {
  oystehr: Oystehr;
  oystehrTestUserM2M: Oystehr;
  token: string;
  processId: string;
  cleanup: () => Promise<void>;
}

/**
 * Creates a unique process ID for the test run
 * @param testFileName - The name of the test file (e.g., 'get-chart-data.test.ts')
 * @returns A unique process ID string
 */
export const createProcessId = (testFileName: string): string => {
  return `${testFileName}-${DateTime.now().toMillis()}`;
};

/**
 * Adds a process ID meta tag to a FHIR resource for tracking and cleanup
 * @param resource - The FHIR resource to tag
 * @param processId - The process ID to tag the resource with
 * @returns The resource with the added meta tag
 */
export const addProcessIdMetaTagToResource = (resource: FhirResource, processId: string): FhirResource => {
  const existingMeta = resource.meta || { tag: [] };
  const existingTags = existingMeta.tag ?? [];
  resource.meta = {
    ...existingMeta,
    tag: [
      ...existingTags,
      {
        system: INTEGRATION_TEST_PROCESS_ID_SYSTEM,
        code: processId,
      },
    ],
  };
  return resource;
};

/**
 * Gets the process meta tag structure for querying
 * @param processId - The process ID
 * @returns Meta tag object for the process ID
 */
export const getProcessMetaTag = (processId: string): Appointment['meta'] => {
  return {
    tag: [
      {
        system: INTEGRATION_TEST_PROCESS_ID_SYSTEM,
        code: processId,
      },
    ],
  };
};

/**
 * Inserts a full set of appointment data into the FHIR server
 * Creates a Location and Schedule first, then uses those IDs to create the rest of the resources
 * @param oystehr - The Oystehr client instance
 * @param processId - The process ID for tagging resources
 * @returns The created Patient, RelatedPerson, Appointment, Encounter, and QuestionnaireResponse
 */
export const insertInPersonAppointmentBase = async (
  oystehr: Oystehr,
  processId: string
): Promise<InsertFullAppointmentDataBaseResult> => {
  // Make Location
  const locationSpec = addProcessIdMetaTagToResource(
    {
      resourceType: 'Location',
    },
    processId
  );
  const location = await oystehr.fhir.create(locationSpec);

  // Make Schedule
  const scheduleSpec = addProcessIdMetaTagToResource(
    {
      resourceType: 'Schedule',
      actor: [{ reference: `Location/${location.id}` }],
    },
    processId
  );
  const schedule = await oystehr.fhir.create(scheduleSpec);

  // Assumes there is only a single Q resource in this file!
  const questionnaireKey = Object.keys(inPersonIntakeQuestionnaire.fhirResources)[0] as any;
  const fhirResourcesAny = inPersonIntakeQuestionnaire.fhirResources as any;

  let seedDataString = JSON.stringify(fastSeedData);
  seedDataString = seedDataString.replace(/\{\{locationId\}\}/g, location.id!);
  seedDataString = seedDataString.replace(/\{\{scheduleId\}\}/g, schedule.id!);
  seedDataString = seedDataString.replace(
    /\{\{questionnaireUrl\}\}/g,
    `${fhirResourcesAny[questionnaireKey].resource.url}|${fhirResourcesAny[questionnaireKey].resource.version}`
  );
  seedDataString = seedDataString.replace(/\{\{date\}\}/g, DateTime.now().toUTC().toFormat('yyyy-MM-dd'));

  const hydratedFastSeedJSON = JSON.parse(seedDataString);

  const createdResources =
    (
      await oystehr.fhir.transaction<
        | Patient
        | RelatedPerson
        | Person
        | Appointment
        | Encounter
        | Slot
        | List
        | Consent
        | DocumentReference
        | QuestionnaireResponse
        | ServiceRequest
        | ClinicalImpression
      >({
        requests: hydratedFastSeedJSON.entry.map((entry: any): BatchInputPostRequest<FhirResource> => {
          if (entry.request.method !== 'POST') {
            throw new Error('Only POST method is supported in fast mode');
          }
          let resource: FhirResource = entry.resource;
          if (resource.resourceType === 'Appointment') {
            resource = addProcessIdMetaTagToResource(resource, processId);
          }
          return {
            method: entry.request.method,
            url: entry.request.url,
            fullUrl: entry.fullUrl,
            resource: entry.resource,
          };
        }),
      })
    ).entry
      ?.map((entry) => entry.resource)
      .filter((entry) => entry !== undefined) ?? [];

  return {
    patient: createdResources.find((resource) => resource!.resourceType === 'Patient') as Patient,
    relatedPerson: createdResources.find((resource) => resource!.resourceType === 'RelatedPerson') as RelatedPerson,
    appointment: createdResources.find((resource) => resource!.resourceType === 'Appointment') as Appointment,
    encounter: createdResources.find((resource) => resource!.resourceType === 'Encounter') as Encounter,
    questionnaireResponse: createdResources.find(
      (resource) => resource!.resourceType === 'QuestionnaireResponse'
    ) as QuestionnaireResponse,
  };
};

/**
 * Cleans up all resources created during the test
 * @param oystehr - The Oystehr client instance
 * @param processId - The process ID used to tag resources
 */
export const cleanupResources = async (oystehr: Oystehr, processId: string): Promise<void> => {
  const metaTagCoding = getProcessMetaTag(processId);
  if (metaTagCoding?.tag?.[0]) {
    await cleanAppointmentGraph(metaTagCoding.tag[0], oystehr);
  }
};

/**
 * Sets up all necessary clients and data for integration tests
 * This function should be called in the beforeAll hook of integration tests
 * @param testFileName - The name of the test file (e.g., 'get-chart-data.test.ts')
 * @returns An object containing all setup data and cleanup function
 */
export const setupIntegrationTest = async (
  testFileName: string,
  m2mClientMockType: M2MClientMockType
): Promise<IntegrationTestSetupResult> => {
  const { AUTH0_ENDPOINT, AUTH0_AUDIENCE, FHIR_API, PROJECT_ID } = SECRETS;

  // Get authentication token
  const token = await getAuth0Token({
    AUTH0_ENDPOINT: AUTH0_ENDPOINT,
    AUTH0_CLIENT: AUTH0_CLIENT_TESTS,
    AUTH0_SECRET: AUTH0_SECRET_TESTS,
    AUTH0_AUDIENCE: AUTH0_AUDIENCE,
  });

  // Get the zambda execution URL from vitest inject
  const EXECUTE_ZAMBDA_URL = inject('EXECUTE_ZAMBDA_URL');
  if (!EXECUTE_ZAMBDA_URL) {
    throw new Error('EXECUTE_ZAMBDA_URL is not defined in vitest inject');
  }

  // Create Oystehr client for FHIR operations
  const oystehrAdmin = new Oystehr({
    accessToken: token,
    fhirApiUrl: FHIR_API,
    projectId: PROJECT_ID,
  });

  // We need to find or create the M2M client who will pretend to be a real EHR user.
  const m2mListSearchResultData = (
    await oystehrAdmin.m2m.listV2({
      name: testFileName,
    })
  ).data;

  let testUserM2M: M2mListItem;

  if (m2mListSearchResultData.length > 0) {
    console.log('found existing M2M client for tests');
    testUserM2M = await oystehrAdmin.m2m.get({
      id: m2mListSearchResultData[0].id,
    });
    assert(testUserM2M.description === m2mClientMockType, 'Found Test User M2M client should have correct mock type');
  } else {
    console.log('creating new M2M client for tests');
    const projectRoles = await oystehrAdmin.role.list();

    if (m2mClientMockType === M2MClientMockType.patient) {
      const patientRoleId = projectRoles.find((role) => role.name === 'Patient')?.id;
      expect(patientRoleId).toBeDefined();
      const patientForM2M = await oystehrAdmin.fhir.create<Patient>({
        resourceType: 'Patient',
        name: [{ given: ['M2M'], family: 'Client' }],
        birthDate: '1978-01-01',
        telecom: [{ system: 'phone', value: '+11231231234', use: 'mobile' }],
      });

      testUserM2M = await oystehrAdmin.m2m.create({
        name: testFileName,
        description: M2MClientMockType.patient,
        profile: `Patient/${patientForM2M.id}`,
        roles: [patientRoleId!],
      });
    } else {
      const providerRoleId = projectRoles.find((role) => role.name === RoleType.Provider)?.id;
      expect(providerRoleId).toBeDefined();
      const practitionerForM2M = await oystehrAdmin.fhir.create<Practitioner>({
        resourceType: 'Practitioner',
        name: [{ given: ['M2M'], family: 'Client' }],
        birthDate: '1978-01-01',
        telecom: [{ system: 'phone', value: '+11231231234', use: 'mobile' }],
      });

      testUserM2M = await oystehrAdmin.m2m.create({
        name: testFileName,
        description: M2MClientMockType.provider,
        profile: `Practitioner/${practitionerForM2M.id}`,
        roles: [providerRoleId!],
      });
    }
  }

  const testUserM2MClientId = testUserM2M.clientId;
  const testUserM2MClientSecret = (
    await oystehrAdmin.m2m.rotateSecret({
      id: testUserM2M.id,
    })
  ).secret;

  const testUserM2MToken = await getAuth0Token({
    AUTH0_ENDPOINT: AUTH0_ENDPOINT,
    AUTH0_CLIENT: testUserM2MClientId,
    AUTH0_SECRET: testUserM2MClientSecret,
    AUTH0_AUDIENCE: AUTH0_AUDIENCE,
  });

  const oystehrTestUserM2M = new Oystehr({
    accessToken: testUserM2MToken,
    fhirApiUrl: FHIR_API,
    projectApiUrl: EXECUTE_ZAMBDA_URL,
    projectId: PROJECT_ID,
  });

  // Create unique process ID for this test run
  const processId = createProcessId(testFileName);

  // Create cleanup function
  const cleanup = async (): Promise<void> => {
    if (!oystehrAdmin) {
      throw new Error('oystehr is null! could not clean up!');
    }
    await cleanupResources(oystehrAdmin, processId);
  };

  return {
    oystehr: oystehrAdmin,
    oystehrTestUserM2M: oystehrTestUserM2M,
    token,
    processId,
    cleanup,
  };
};
