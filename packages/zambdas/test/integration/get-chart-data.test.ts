import Oystehr, { BatchInputPostRequest } from '@oystehr/sdk';
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
  QuestionnaireResponse,
  RelatedPerson,
  ServiceRequest,
  Slot,
} from 'fhir/r4b';
import { DateTime } from 'luxon';
import { cleanAppointmentGraph, GetChartDataRequest, GetChartDataResponse } from 'utils';
import { inject } from 'vitest';
// Alex boldly imported this file from another package. R
import fastSeedData from '../../../../apps/ehr/tests/e2e-utils/seed-data/seed-ehr-appointment-data.json' assert { type: 'json' };
import inPersonIntakeQuestionnaire from '../../../../config/oystehr/in-person-intake-questionnaire.json' assert { type: 'json' };
import { AUTH0_CLIENT_TESTS, AUTH0_SECRET_TESTS } from '../../.env/local.json';
import { getAuth0Token } from '../../src/shared';
import { SECRETS } from '../data/secrets';

interface InsertFullAppointmentDataBaseResult {
  patient: Patient;
  relatedPerson: { id: string; resourceType: 'RelatedPerson' };
  appointment: Appointment;
  encounter: Encounter;
  questionnaire: QuestionnaireResponse;
}

const INTEGRATION_TEST_PROCESS_ID_SYSTEM = 'INTEGRATION_TEST_PROCESS_ID_SYSTEM';
const PROCESS_ID = `get-chart-data.test.ts-${DateTime.now().toMillis()}`;
let baseResources: InsertFullAppointmentDataBaseResult;

describe('get-chart-data integration tests', () => {
  let oystehrLocalZambdas: Oystehr;
  let oystehr: Oystehr;
  let token = null;

  const addProcessIdMetaTagToResource = (resource: FhirResource, processId: string): FhirResource => {
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

  const getProcessMetaTag = (processId: string): Appointment['meta'] => {
    return {
      tag: [
        {
          system: INTEGRATION_TEST_PROCESS_ID_SYSTEM,
          code: processId,
        },
      ],
    };
  };

  // This function inserts a full set of appointment data into the FHIR server
  // It creates a Location and Schedule first, then uses those IDs to create the rest of the resources
  // It returns the created Patient, RelatedPerson, Appointment, Encounter, and QuestionnaireResponse

  const insertFullAppointmentBase = async (oystehr: Oystehr): Promise<InsertFullAppointmentDataBaseResult> => {
    // Make Location
    const locationSpec = addProcessIdMetaTagToResource(
      {
        resourceType: 'Location',
      },
      PROCESS_ID
    );
    const location = await oystehr.fhir.create(locationSpec);

    // Make Schedule
    const scheduleSpec = addProcessIdMetaTagToResource(
      {
        resourceType: 'Schedule',
        actor: [{ reference: `Location/${location.id}` }],
      },
      PROCESS_ID
    );
    const schedule = await oystehr.fhir.create(scheduleSpec);

    let seedDataString = JSON.stringify(fastSeedData);
    seedDataString = seedDataString.replace(/\{\{locationId\}\}/g, location.id!);
    seedDataString = seedDataString.replace(/\{\{scheduleId\}\}/g, schedule.id!);
    seedDataString = seedDataString.replace(
      /\{\{questionnaireUrl\}\}/g,
      `${inPersonIntakeQuestionnaire.fhirResources['questionnaire-in-person-previsit'].resource.url}|${inPersonIntakeQuestionnaire.fhirResources['questionnaire-in-person-previsit'].resource.version}`
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
              resource = addProcessIdMetaTagToResource(resource, PROCESS_ID);
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
      relatedPerson: {
        id: (createdResources.find((resource) => resource!.resourceType === 'RelatedPerson') as RelatedPerson).id!,
        resourceType: 'RelatedPerson',
      },
      appointment: createdResources.find((resource) => resource!.resourceType === 'Appointment') as Appointment,
      encounter: createdResources.find((resource) => resource!.resourceType === 'Encounter') as Encounter,
      questionnaire: createdResources.find(
        (resource) => resource!.resourceType === 'QuestionnaireResponse'
      ) as QuestionnaireResponse,
    };
  };

  beforeAll(async () => {
    const { AUTH0_ENDPOINT, AUTH0_AUDIENCE, FHIR_API, PROJECT_ID } = SECRETS;
    token = await getAuth0Token({
      AUTH0_ENDPOINT: AUTH0_ENDPOINT,
      AUTH0_CLIENT: AUTH0_CLIENT_TESTS,
      AUTH0_SECRET: AUTH0_SECRET_TESTS,
      AUTH0_AUDIENCE: AUTH0_AUDIENCE,
    });

    const EXECUTE_ZAMBDA_URL = inject('EXECUTE_ZAMBDA_URL');
    expect(EXECUTE_ZAMBDA_URL).toBeDefined();
    oystehr = new Oystehr({
      accessToken: token,
      fhirApiUrl: FHIR_API,
      projectId: PROJECT_ID,
    });

    oystehrLocalZambdas = new Oystehr({
      accessToken: token,
      fhirApiUrl: FHIR_API,
      projectApiUrl: EXECUTE_ZAMBDA_URL,
      projectId: PROJECT_ID,
    });

    baseResources = await insertFullAppointmentBase(oystehr);
  });

  afterAll(async () => {
    if (!oystehr) {
      throw new Error('oystehr is null! could not clean up!');
    }
    await cleanupResources(oystehr);
  });

  const cleanupResources = async (oystehr: Oystehr): Promise<void> => {
    const metaTagCoding = getProcessMetaTag(PROCESS_ID);
    if (metaTagCoding?.tag?.[0]) {
      await cleanAppointmentGraph(metaTagCoding.tag[0], oystehr);
    }
    console.log('Cleaned up test resources');
  };

  describe('get-chart-data happy paths', () => {
    it('should get chart data with no params -- success', async () => {
      const getChartDataInput: GetChartDataRequest = {
        encounterId: baseResources.encounter.id!,
      };
      let getChartDataOutput: any;
      try {
        getChartDataOutput = (
          await oystehrLocalZambdas.zambda.execute({
            id: 'GET-CHART-DATA',
            ...getChartDataInput,
          })
        ).output as GetChartDataResponse;
      } catch (error) {
        console.error('Error executing zambda:', error);
        getChartDataOutput = error as Error;
      }
      console.log('Get Chart Data Output:', JSON.stringify(getChartDataOutput, null, 2));
      expect(getChartDataOutput).toBeDefined();
      expect(getChartDataOutput).toHaveProperty('patientId');
      expect(getChartDataOutput).toHaveProperty('conditions');
      expect(getChartDataOutput).toHaveProperty('medications');
      expect(getChartDataOutput).toHaveProperty('allergies');
      expect(getChartDataOutput).toHaveProperty('surgicalHistory');
      expect(getChartDataOutput).toHaveProperty('examObservations');
      expect(getChartDataOutput).toHaveProperty('cptCodes');
      expect(getChartDataOutput).toHaveProperty('instructions');
      expect(getChartDataOutput).toHaveProperty('diagnosis');
      expect(getChartDataOutput).toHaveProperty('schoolWorkNotes');
      expect(getChartDataOutput).toHaveProperty('observations');
      expect(getChartDataOutput).toHaveProperty('practitioners');
      expect(getChartDataOutput).toHaveProperty('aiPotentialDiagnosis');
      expect(getChartDataOutput).toHaveProperty('aiChat');
      expect(getChartDataOutput).toHaveProperty('patientInfoConfirmed');
    });
  });
});
