import Oystehr, { BatchInputPostRequest } from '@oystehr/sdk';
import {
  Appointment,
  ClinicalImpression,
  Consent,
  DocumentReference,
  Encounter,
  FhirResource,
  List,
  MedicationStatement,
  Patient,
  Person,
  QuestionnaireResponse,
  RelatedPerson,
  ServiceRequest,
  Slot,
} from 'fhir/r4b';
import { DateTime } from 'luxon';
import {
  cleanAppointmentGraph,
  GetChartDataRequest,
  GetChartDataResponse,
  SaveChartDataRequest,
  SaveChartDataResponse,
} from 'utils';
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
  };

  describe('get-chart-data happy paths', () => {
    it('should get chart data with no params on base chart-- success', async () => {
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
      expect(getChartDataOutput instanceof Error).toBe(false);
      const typedGetChartDataOutput = getChartDataOutput as GetChartDataResponse;
      expect(typedGetChartDataOutput).toBeDefined();
      expect(typedGetChartDataOutput).toHaveProperty('patientId');
      expect(typedGetChartDataOutput.patientId).toEqual(baseResources.patient.id);
      expect(typedGetChartDataOutput).toHaveProperty('conditions');
      expect(typedGetChartDataOutput.conditions).toBeInstanceOf(Array);
      expect(typedGetChartDataOutput.conditions?.length).toEqual(0);
      expect(typedGetChartDataOutput).toHaveProperty('medications');
      expect(typedGetChartDataOutput.medications).toBeInstanceOf(Array);
      expect(typedGetChartDataOutput.medications?.length).toEqual(0);
      expect(typedGetChartDataOutput).toHaveProperty('allergies');
      expect(typedGetChartDataOutput.allergies).toBeInstanceOf(Array);
      expect(typedGetChartDataOutput.allergies?.length).toEqual(0);
      expect(typedGetChartDataOutput).toHaveProperty('surgicalHistory');
      expect(typedGetChartDataOutput.surgicalHistory).toBeInstanceOf(Array);
      expect(typedGetChartDataOutput.surgicalHistory?.length).toEqual(0);
      expect(typedGetChartDataOutput).toHaveProperty('examObservations');
      expect(typedGetChartDataOutput.examObservations).toBeInstanceOf(Array);
      expect(typedGetChartDataOutput.examObservations?.length).toBeGreaterThan(1);
      expect(typedGetChartDataOutput).toHaveProperty('cptCodes');
      expect(typedGetChartDataOutput.cptCodes).toBeInstanceOf(Array);
      expect(typedGetChartDataOutput.cptCodes?.length).toEqual(0);
      expect(typedGetChartDataOutput).toHaveProperty('instructions');
      expect(typedGetChartDataOutput.instructions).toBeInstanceOf(Array);
      expect(typedGetChartDataOutput.instructions?.length).toEqual(0);
      expect(typedGetChartDataOutput).toHaveProperty('diagnosis');
      expect(typedGetChartDataOutput.diagnosis).toBeInstanceOf(Array);
      expect(typedGetChartDataOutput.diagnosis?.length).toEqual(0);
      expect(typedGetChartDataOutput).toHaveProperty('schoolWorkNotes');
      expect(typedGetChartDataOutput.schoolWorkNotes).toBeInstanceOf(Array);
      expect(typedGetChartDataOutput.schoolWorkNotes?.length).toEqual(0);
      expect(typedGetChartDataOutput).toHaveProperty('observations');
      expect(typedGetChartDataOutput.observations).toBeInstanceOf(Array);
      expect(typedGetChartDataOutput.observations?.length).toEqual(0);
      expect(typedGetChartDataOutput).toHaveProperty('practitioners');
      expect(typedGetChartDataOutput.practitioners).toBeInstanceOf(Array);
      expect(typedGetChartDataOutput.practitioners?.length).toEqual(0);
      expect(typedGetChartDataOutput).toHaveProperty('aiPotentialDiagnosis');
      expect(typedGetChartDataOutput.aiPotentialDiagnosis).toBeInstanceOf(Array);
      expect(typedGetChartDataOutput.aiPotentialDiagnosis?.length).toEqual(0);
      expect(typedGetChartDataOutput).toHaveProperty('aiChat');
      expect(typedGetChartDataOutput.aiChat).toBeInstanceOf(Object);
      expect(typedGetChartDataOutput.aiChat?.documents).toBeInstanceOf(Array);
      expect(typedGetChartDataOutput.aiChat?.documents?.length).toEqual(0);
      expect(typedGetChartDataOutput.aiChat?.providers).toBeInstanceOf(Array);
      expect(typedGetChartDataOutput.aiChat?.providers?.length).toEqual(0);
      expect(typedGetChartDataOutput).toHaveProperty('patientInfoConfirmed');
      expect(typedGetChartDataOutput.patientInfoConfirmed).toEqual({
        value: true,
      });
    });
  });

  it('should validate shape of examObservations -- success', async () => {
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
    expect(getChartDataOutput instanceof Error).toBe(false);
    const typedGetChartDataOutput = getChartDataOutput as GetChartDataResponse;
    expect(typedGetChartDataOutput).toHaveProperty('examObservations');
    expect(typedGetChartDataOutput.examObservations).toBeInstanceOf(Array);
    expect(typedGetChartDataOutput.examObservations?.[0]).toMatchObject({
      resourceId: expect.any(String),
      field: expect.any(String),
      value: expect.any(Boolean),
    });
  });

  it('should validate save + get cycle for conditions -- success', async () => {
    const conditionDTO = {
      code: 'H54.8',
      display: 'Legal blindness, as defined in USA',
      current: true,
    };
    const saveChartInput: SaveChartDataRequest = {
      encounterId: baseResources.encounter.id!,
      conditions: [conditionDTO],
    };
    let saveChartOutput: any;
    try {
      saveChartOutput = (
        await oystehrLocalZambdas.zambda.execute({
          id: 'SAVE-CHART-DATA',
          ...saveChartInput,
        })
      ).output as SaveChartDataResponse;
    } catch (error) {
      console.error('Error executing zambda:', error);
      saveChartOutput = error as Error;
    }
    expect(saveChartOutput instanceof Error).toBe(false);
    const typedSaveChartOutput = saveChartOutput as SaveChartDataResponse;
    const newCondition = typedSaveChartOutput.chartData.conditions?.[0];
    expect(newCondition).toMatchObject({
      resourceId: expect.any(String),
      ...conditionDTO,
    });

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
    expect(getChartDataOutput instanceof Error).toBe(false);
    const typedGetChartDataOutput = getChartDataOutput as GetChartDataResponse;
    expect(typedGetChartDataOutput).toHaveProperty('conditions');
    expect(typedGetChartDataOutput.conditions).toBeInstanceOf(Array);
    expect(typedGetChartDataOutput.conditions?.[0]).toEqual(newCondition);
  });

  it('should validate save + get cycle for medications -- success', async () => {
    const medicationDTO = {
      name: 'Azithromycin Oral Suspension Reconstituted (200 MG/5ML)',
      id: '5675',
      type: 'scheduled' as 'scheduled' | 'as-needed' | 'prescribed-medication',
      intakeInfo: { date: '2025-10-16T11:00:00.000Z', dose: '2 l' },
      status: 'active' as Extract<MedicationStatement['status'], 'active' | 'completed'>,
    };
    const saveChartInput: SaveChartDataRequest = {
      encounterId: baseResources.encounter.id!,
      medications: [medicationDTO],
    };
    let saveChartOutput: any;
    try {
      saveChartOutput = (
        await oystehrLocalZambdas.zambda.execute({
          id: 'SAVE-CHART-DATA',
          ...saveChartInput,
        })
      ).output as SaveChartDataResponse;
    } catch (error) {
      console.error('Error executing zambda:', error);
      saveChartOutput = error as Error;
    }
    expect(saveChartOutput instanceof Error).toBe(false);
    const typedSaveChartOutput = saveChartOutput as SaveChartDataResponse;
    const newMedication = typedSaveChartOutput.chartData.medications?.[0];
    expect(newMedication).toMatchObject({
      resourceId: expect.any(String),
      ...medicationDTO,
    });

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
    expect(getChartDataOutput instanceof Error).toBe(false);
    const typedGetChartDataOutput = getChartDataOutput as GetChartDataResponse;
    expect(typedGetChartDataOutput).toHaveProperty('medications');
    expect(typedGetChartDataOutput.medications).toBeInstanceOf(Array);
    expect(typedGetChartDataOutput.medications?.[0]).toEqual(newMedication);
  });
});
