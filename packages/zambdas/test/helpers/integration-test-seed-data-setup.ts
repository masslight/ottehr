import Oystehr, { BatchInputPostRequest } from '@oystehr/sdk';
import {
  Account,
  Appointment,
  Consent,
  DocumentReference,
  Encounter,
  FhirResource,
  Location,
  Patient,
  QuestionnaireResponse,
  RelatedPerson,
} from 'fhir/r4b';
import { DateTime } from 'luxon';
import { M2MClientMockType, PATIENT_BILLING_ACCOUNT_TYPE } from 'utils';
import { cleanAppointmentGraph } from 'utils/lib/utils/e2eCleanup';
import { inject } from 'vitest';
import { createBillingClient } from '../../src/billing/shared';
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
  oystehrBilling: Oystehr;
  oystehrTestUserM2M: Oystehr;
  testUserM2MToken: string;
  testUserM2MProfile: string;
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
 * Creates a minimal, config-independent in-person appointment graph for integration tests.
 *
 * This intentionally does NOT replay the EHR e2e seed bundle. That bundle is generated per
 * instance (its QuestionnaireResponse, Consent, etc. mirror each instance's intake-paperwork
 * configuration), so sharing one canned copy across differently-configured instances was unsafe.
 * Instead we author only the resources the integration tests actually exercise:
 *   - Patient + Encounter  → get-chart-data (asserts an empty chart) and radiology
 *   - a non-user RelatedPerson, QuestionnaireResponse, Consent, DocumentReference and Account
 *     → merge-patients asserts each of these is re-pointed to the surviving patient
 * The Encounter carries `patient-info-confirmed = false` (get-chart-data surfaces it as
 * `patientInfoConfirmed`), and nothing here references an intake questionnaire URL, so the graph
 * is identical on every instance regardless of its ottehr-config overlay.
 *
 * Only the Appointment is tagged; cleanAppointmentGraph() walks the graph outward from it.
 * @param oystehr - The Oystehr client instance
 * @param processId - The process ID for tagging resources (drives cleanup)
 */
export const insertInPersonAppointmentBase = async (
  oystehr: Oystehr,
  processId: string
): Promise<InsertFullAppointmentDataBaseResult> => {
  // Location is referenced by the Appointment and Encounter; create it first so the transaction
  // below can point at a concrete id. (Locations are never auto-deleted by cleanAppointmentGraph,
  // matching the previous behavior.)
  const location = await oystehr.fhir.create<Location>(
    addProcessIdMetaTagToResource(
      { resourceType: 'Location', status: 'active', name: 'Integration Test Location' },
      processId
    ) as Location
  );

  console.log(`[insertInPersonAppointmentBase] created Location/${location.id}`);

  const patientRef = 'urn:uuid:patient';
  const appointmentRef = 'urn:uuid:appointment';
  const encounterRef = 'urn:uuid:encounter';
  const start = DateTime.now().toUTC();

  const patient: Patient = {
    resourceType: 'Patient',
    active: true,
    name: [{ use: 'official', given: ['Jon'], family: 'Snow' }],
    gender: 'male',
    birthDate: '2002-07-07',
    telecom: [
      { system: 'phone', value: '+12120250519' },
      { system: 'email', value: 'john.doe@example.com' },
    ],
  };

  // A non-"user" RelatedPerson: merge-patients looks for a relationship whose codes are all
  // something other than `user-relatedperson` and asserts it transfers to the surviving patient.
  const relatedPerson: RelatedPerson = {
    resourceType: 'RelatedPerson',
    patient: { reference: patientRef },
    relationship: [
      {
        coding: [{ system: 'http://terminology.hl7.org/CodeSystem/v2-0131', code: 'C', display: 'Emergency Contact' }],
      },
    ],
    name: [{ given: ['Catelyn'], family: 'Stark' }],
    telecom: [{ system: 'phone', value: '+12120250520' }],
  };

  const appointment = addProcessIdMetaTagToResource(
    {
      resourceType: 'Appointment',
      status: 'booked',
      start: start.toISO()!,
      end: start.plus({ minutes: 15 }).toISO()!,
      appointmentType: { text: 'prebook' },
      participant: [
        { actor: { reference: patientRef }, status: 'accepted' },
        { actor: { reference: `Location/${location.id}` }, status: 'accepted' },
      ],
    } as Appointment,
    processId
  ) as Appointment;

  const encounter: Encounter = {
    resourceType: 'Encounter',
    status: 'planned',
    class: { system: 'http://terminology.hl7.org/CodeSystem/v3-ActCode', code: 'AMB', display: 'ambulatory' },
    subject: { reference: patientRef },
    appointment: [{ reference: appointmentRef }],
    location: [{ location: { reference: `Location/${location.id}` } }],
    // get-chart-data surfaces this extension as `patientInfoConfirmed`
    extension: [{ url: 'patient-info-confirmed', valueBoolean: false }],
  };

  const questionnaireResponse: QuestionnaireResponse = {
    resourceType: 'QuestionnaireResponse',
    status: 'completed',
    subject: { reference: patientRef },
    encounter: { reference: encounterRef },
  };

  const consent: Consent = {
    resourceType: 'Consent',
    status: 'active',
    dateTime: start.toISO()!,
    patient: { reference: patientRef },
    scope: {
      coding: [{ system: 'http://terminology.hl7.org/CodeSystem/consentscope', code: 'patient-privacy' }],
    },
    category: [
      { coding: [{ system: 'http://terminology.hl7.org/CodeSystem/consentcategorycodes', code: 'hipaa-ack' }] },
    ],
    policy: [{ uri: 'https://ottehr.com' }],
  };

  const documentReference: DocumentReference = {
    resourceType: 'DocumentReference',
    status: 'current',
    subject: { reference: patientRef },
    date: start.toISO()!,
    content: [
      {
        attachment: {
          contentType: 'application/pdf',
          url: 'https://example.com/integration-test-document.pdf',
          title: 'Integration test document',
        },
      },
    ],
    context: { related: [{ reference: appointmentRef }] },
  };

  // Typed as a patient billing account (PBILLACCT) so merge-patients' account-consolidation
  // assertions have an account of the expected type to consolidate onto the surviving patient.
  const account: Account = {
    resourceType: 'Account',
    status: 'active',
    type: PATIENT_BILLING_ACCOUNT_TYPE,
    name: 'Integration Test Account',
    subject: [{ reference: patientRef }],
  };

  const requests: BatchInputPostRequest<FhirResource>[] = [
    { method: 'POST', url: '/Patient', fullUrl: patientRef, resource: patient },
    { method: 'POST', url: '/RelatedPerson', fullUrl: 'urn:uuid:related-person', resource: relatedPerson },
    { method: 'POST', url: '/Appointment', fullUrl: appointmentRef, resource: appointment },
    { method: 'POST', url: '/Encounter', fullUrl: encounterRef, resource: encounter },
    {
      method: 'POST',
      url: '/QuestionnaireResponse',
      fullUrl: 'urn:uuid:questionnaire-response',
      resource: questionnaireResponse,
    },
    { method: 'POST', url: '/Consent', fullUrl: 'urn:uuid:consent', resource: consent },
    { method: 'POST', url: '/DocumentReference', fullUrl: 'urn:uuid:document-reference', resource: documentReference },
    { method: 'POST', url: '/Account', fullUrl: 'urn:uuid:account', resource: account },
  ];

  const createdResources =
    (
      await oystehr.fhir.transaction<
        | Patient
        | RelatedPerson
        | Appointment
        | Encounter
        | QuestionnaireResponse
        | Consent
        | DocumentReference
        | Account
      >({ requests })
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
  const { FHIR_API, PROJECT_ID } = SECRETS;

  // The admin token and the two shared M2M client tokens (one provider, one
  // patient) are provisioned once for the whole suite in the global setup
  // (test/helpers/integration-global-setup.ts) and handed to every test via
  // vitest inject. We deliberately do NOT mint a per-test M2M client here:
  // that previously created one persistent client + profile per test file, and
  // having many test files concurrently rotate-and-mint clients is both wasteful
  // and racy.
  const token = inject('ADMIN_TOKEN');
  const EXECUTE_ZAMBDA_URL = inject('EXECUTE_ZAMBDA_URL');
  if (!EXECUTE_ZAMBDA_URL) {
    throw new Error('EXECUTE_ZAMBDA_URL is not defined in vitest inject');
  }

  const testUserM2MToken =
    m2mClientMockType === M2MClientMockType.patient ? inject('M2M_PATIENT_TOKEN') : inject('M2M_PROVIDER_TOKEN');
  // IMPORTANT: testUserM2MProfile is the SHARED caller identity (one Practitioner
  // for all provider tests, one Patient for all patient tests). Treat it as
  // read-only: reference it (assign to an encounter, filter by it, set it as
  // orderedProvider, pass as patientID) but NEVER update/patch/delete the profile
  // resource or destructively hang state off it — that would corrupt every other
  // test running in parallel. If a test needs a Practitioner/Patient as a mutable
  // data subject, create its own throwaway one (tagged with processId).
  const testUserM2MProfile =
    m2mClientMockType === M2MClientMockType.patient ? inject('M2M_PATIENT_PROFILE') : inject('M2M_PROVIDER_PROFILE');

  // Create Oystehr client for FHIR operations (admin)
  const oystehrAdmin = new Oystehr({
    accessToken: token,
    fhirApiUrl: FHIR_API,
    projectId: PROJECT_ID,
  });

  // Create Oystehr client for billing operations
  const oystehrBilling = createBillingClient(token, SECRETS, {
    projectId: PROJECT_ID,
    services: { fhirApiUrl: FHIR_API, projectApiUrl: EXECUTE_ZAMBDA_URL, zambdaApiUrl: EXECUTE_ZAMBDA_URL },
  });

  const oystehrTestUserM2M = new Oystehr({
    accessToken: testUserM2MToken,
    fhirApiUrl: FHIR_API,
    projectApiUrl: EXECUTE_ZAMBDA_URL,
    services: {
      zambdaApiUrl: EXECUTE_ZAMBDA_URL,
    },
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
    oystehrBilling,
    oystehrTestUserM2M: oystehrTestUserM2M,
    testUserM2MToken,
    testUserM2MProfile,
    token,
    processId,
    cleanup,
  };
};
