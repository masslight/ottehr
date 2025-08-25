import Oystehr, { BatchInputPostRequest } from '@oystehr/sdk';
import {
  Address,
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
  Schedule,
  ServiceRequest,
  Slot,
} from 'fhir/r4b';
import { readFileSync } from 'fs';
import { DateTime } from 'luxon';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import {
  cleanAppointmentGraph,
  CreateAppointmentResponse,
  createFetchClientWithOystAuth,
  createSampleAppointments,
  E2E_TEST_RESOURCE_PROCESS_ID_SYSTEM,
  FHIR_APPOINTMENT_INTAKE_HARVESTING_COMPLETED_TAG,
  FHIR_APPOINTMENT_PREPROCESSED_TAG,
  formatPhoneNumber,
  GetPaperworkAnswers,
  RelationshipOption,
  ServiceMode,
} from 'utils';
import inPersonIntakeQuestionnaire from '../../../../packages/utils/lib/deployed-resources/questionnaires/in-person-intake-questionnaire.json' assert { type: 'json' };
import { getAuth0Token } from './auth/getAuth0Token';
import {
  inviteTestEmployeeUser,
  removeUser,
  TEST_EMPLOYEE_1,
  TEST_EMPLOYEE_2,
  TestEmployee,
} from './resource/employees';
import fastSeedData from './seed-data/seed-ehr-appointment-data.json' assert { type: 'json' };

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export function getAccessToken(): string {
  const userJsonPath = join(__dirname, '../../playwright/user.json');
  const userData = JSON.parse(readFileSync(userJsonPath, 'utf-8'));

  const authData = userData.origins[0].localStorage.find((item: { name: string }) =>
    item.name.includes('api.zapehr.com')
  );

  if (!authData) {
    throw new Error('Auth data not found');
  }

  const token = JSON.parse(authData.value).body.access_token;
  return token;
}

const EightDigitsString = '20250519';

export const PATIENT_FIRST_NAME = 'Jon';
export const PATIENT_LAST_NAME = 'Snow';
export const PATIENT_GENDER = 'Male';

export const PATIENT_BIRTHDAY = '2002-07-07';
export const PATIENT_BIRTH_DATE_SHORT = '07/07/2002';
export const PATIENT_BIRTH_DATE_LONG = 'July 07, 2002';

export const PATIENT_PHONE_NUMBER = '21' + EightDigitsString;
export const PATIENT_EMAIL = `john.doe.${EightDigitsString}3@example.com`;
export const PATIENT_CITY = 'New York';
export const PATIENT_LINE = `${EightDigitsString} Test Line`;
export const PATIENT_LINE_2 = 'Apt 4B';
export const PATIENT_STATE = 'NY';
export const PATIENT_POSTAL_CODE = '06001';
export const PATIENT_REASON_FOR_VISIT = 'Fever';

export const PATIENT_INSURANCE_MEMBER_ID = '123123';
export const PATIENT_INSURANCE_POLICY_HOLDER_FIRST_NAME = 'John';
export const PATIENT_INSURANCE_POLICY_HOLDER_LAST_NAME = 'Doe';
export const PATIENT_INSURANCE_POLICY_HOLDER_MIDDLE_NAME = 'Michael';
export const PATIENT_INSURANCE_POLICY_HOLDER_DATE_OF_BIRTH = '1990-01-01';
export const PATIENT_INSURANCE_POLICY_HOLDER_BIRTH_SEX = 'Male';
export const PATIENT_INSURANCE_POLICY_HOLDER_ADDRESS_AS_PATIENT = false;
export const PATIENT_INSURANCE_POLICY_HOLDER_ADDRESS = '123 Main St';
export const PATIENT_INSURANCE_POLICY_HOLDER_ADDRESS_ADDITIONAL_LINE = 'Apt 1';
export const PATIENT_INSURANCE_POLICY_HOLDER_CITY = 'San Sebastian';
export const PATIENT_INSURANCE_POLICY_HOLDER_STATE = 'CA';
export const PATIENT_INSURANCE_POLICY_HOLDER_ZIP = '92000';
export const PATIENT_INSURANCE_POLICY_HOLDER_RELATIONSHIP_TO_INSURED: RelationshipOption = 'Parent';

export const PATIENT_INSURANCE_MEMBER_ID_2 = '234234';
export const PATIENT_INSURANCE_POLICY_HOLDER_2_FIRST_NAME = 'Jane';
export const PATIENT_INSURANCE_POLICY_HOLDER_2_LAST_NAME = 'Doe';
export const PATIENT_INSURANCE_POLICY_HOLDER_2_MIDDLE_NAME = 'Michael';
export const PATIENT_INSURANCE_POLICY_HOLDER_2_DATE_OF_BIRTH = '1991-01-01';
export const PATIENT_INSURANCE_POLICY_HOLDER_2_BIRTH_SEX = 'Female';
export const PATIENT_INSURANCE_POLICY_HOLDER_2_ADDRESS_AS_PATIENT = false;
export const PATIENT_INSURANCE_POLICY_HOLDER_2_ADDRESS = '123 Main St';
export const PATIENT_INSURANCE_POLICY_HOLDER_2_ADDRESS_ADDITIONAL_LINE = 'Apt 1';
export const PATIENT_INSURANCE_POLICY_HOLDER_2_CITY = 'New York';
export const PATIENT_INSURANCE_POLICY_HOLDER_2_STATE = 'NY';
export const PATIENT_INSURANCE_POLICY_HOLDER_2_ZIP = '06001';
export const PATIENT_INSURANCE_POLICY_HOLDER_2_RELATIONSHIP_TO_INSURED: RelationshipOption = 'Parent';

export type CreateTestAppointmentInput = {
  firstName?: string;
  lastName?: string;
  gender?: string;
  birthDate?: string;
  phoneNumber?: string;
  email?: string;
  city?: string;
  line?: string;
  state?: string;
  postalCode?: string;
  reasonsForVisit?: string;
  telemedLocationState?: string;
  selectedLocationId?: string;
};

export class ResourceHandler {
  #apiClient!: Promise<Oystehr>;
  #authToken!: Promise<string>;
  #resources!: CreateAppointmentResponse['resources'] & { relatedPerson: { id: string; resourceType: string } };
  #createAppointmentZambdaId: string;
  #flow: 'telemed' | 'in-person';
  #paperworkAnswers?: GetPaperworkAnswers;
  #processId?: string;

  public testEmployee1!: TestEmployee;
  public testEmployee2!: TestEmployee;

  public static async getOystehr(): Promise<Oystehr> {
    const authToken = await getAuth0Token();
    const oystehr = new Oystehr({
      accessToken: authToken,
      fhirApiUrl: process.env.FHIR_API,
      projectApiUrl: process.env.PROJECT_API_ZAMBDA_URL,
    });
    return oystehr;
  }

  constructor(processId: string, flow: 'telemed' | 'in-person' = 'in-person', paperworkAnswers?: GetPaperworkAnswers) {
    this.#flow = flow;
    this.#paperworkAnswers = paperworkAnswers;
    this.#processId = processId;
    this.#createAppointmentZambdaId = 'create-appointment';
    this.#authToken = getAuth0Token();

    this.#apiClient = this.#authToken.then((authToken) => {
      return new Oystehr({
        accessToken: authToken,
        fhirApiUrl: process.env.FHIR_API,
        projectApiUrl: process.env.PROJECT_API_ZAMBDA_URL,
      });
    });
  }

  private async createAppointment(inputParams?: CreateTestAppointmentInput): Promise<CreateAppointmentResponse> {
    try {
      const address: Address = {
        city: inputParams?.city ?? PATIENT_CITY,
        line: [inputParams?.line ?? PATIENT_LINE],
        state: inputParams?.state ?? PATIENT_STATE,
        postalCode: inputParams?.postalCode ?? PATIENT_POSTAL_CODE,
      };

      const patientData = {
        firstNames: [inputParams?.firstName ?? PATIENT_FIRST_NAME],
        lastNames: [inputParams?.lastName ?? PATIENT_LAST_NAME],
        numberOfAppointments: 1,
        reasonsForVisit: [inputParams?.reasonsForVisit ?? PATIENT_REASON_FOR_VISIT],
        phoneNumbers: [inputParams?.phoneNumber ?? PATIENT_PHONE_NUMBER],
        emails: [inputParams?.email ?? PATIENT_EMAIL],
        gender: inputParams?.gender ?? PATIENT_GENDER.toLowerCase(),
        birthDate: inputParams?.birthDate ?? PATIENT_BIRTHDAY,
        address: [address],
      };

      if (!process.env.PROJECT_API_ZAMBDA_URL) {
        throw new Error('PROJECT_API_ZAMBDA_URL is not set');
      }

      if (!process.env.LOCATION_ID) {
        throw new Error('LOCATION_ID is not set');
      }

      if (!process.env.STATE_ONE) {
        throw new Error('STATE_ONE is not set');
      }

      if (!process.env.PROJECT_ID) {
        throw new Error('PROJECT_ID is not set');
      }

      // Create appointment and related resources using zambda
      const appointmentData = await createSampleAppointments({
        oystehr: await this.apiClient,
        authToken: getAccessToken(),
        phoneNumber: formatPhoneNumber(PATIENT_PHONE_NUMBER)!,
        createAppointmentZambdaId: this.#createAppointmentZambdaId,
        zambdaUrl: process.env.PROJECT_API_ZAMBDA_URL,
        serviceMode: this.#flow === 'telemed' ? ServiceMode.virtual : ServiceMode['in-person'],
        selectedLocationId: inputParams?.selectedLocationId ?? process.env.LOCATION_ID,
        locationState: inputParams?.telemedLocationState ?? process.env.STATE_ONE, // todo: check why state is used here
        demoData: patientData,
        projectId: process.env.PROJECT_ID!,
        paperworkAnswers: this.#paperworkAnswers,
        appointmentMetadata: getProcessMetaTag(this.#processId!),
      });
      if (!appointmentData?.resources) {
        throw new Error('Appointment not created');
      }

      Object.values(appointmentData.resources).forEach((resource) => {
        console.log(`✅ created ${resource.resourceType}: ${resource.id}`);
      });

      if (appointmentData.relatedPersonId) {
        console.log(`✅ created relatedPerson: ${appointmentData.relatedPersonId}`);
      }

      return appointmentData as CreateAppointmentResponse;
    } catch (error) {
      console.error('❌ Failed to create resources:', error);
      throw error;
    }
  }

  public async setResources(params?: CreateTestAppointmentInput): Promise<void> {
    const response = await this.createAppointment(params);
    this.#resources = {
      ...response.resources,
      // add relatedPerson to resources to make possible to clean it up; endpoint returns only id
      relatedPerson: {
        id: response.relatedPersonId,
        resourceType: 'RelatedPerson',
      },
    };
  }

  public async setResourcesFast(_params?: CreateTestAppointmentInput): Promise<void> {
    if (process.env.LOCATION_ID == null) {
      throw new Error('LOCATION_ID is not set');
    }

    const apiClient = await this.apiClient;

    const schedule = (
      await apiClient.fhir.search<Schedule>({
        resourceType: 'Schedule',
        params: [
          {
            name: 'actor',
            value: `Location/${process.env.LOCATION_ID}`,
          },
        ],
      })
    ).unbundle()[0] as Schedule;

    let seedDataString = JSON.stringify(fastSeedData);
    seedDataString = seedDataString.replace(/\{\{locationId\}\}/g, process.env.LOCATION_ID);
    seedDataString = seedDataString.replace(/\{\{scheduleId\}\}/g, schedule.id!);
    seedDataString = seedDataString.replace(
      /\{\{questionnaireUrl\}\}/g,
      `${inPersonIntakeQuestionnaire.resource.url}|${inPersonIntakeQuestionnaire.resource.version}`
    );
    seedDataString = seedDataString.replace(/\{\{date\}\}/g, DateTime.now().toUTC().toFormat('yyyy-MM-dd'));

    // TODO do something about the DocumentReference attachments? For the moment all of these tests point to the exact same files. Maybe that's great. Or maybe we should upload images each time?

    const hydratedFastSeedJSON = JSON.parse(seedDataString);

    const createdResources =
      (
        await apiClient.fhir.transaction<
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
              resource = addProcessIdMetaTagToResource(resource, this.#processId!);
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
    this.#resources = {
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
  }

  public async cleanupResources(): Promise<void> {
    // TODO: here we should change appointment id to encounter id when we'll fix this bug in frontend,
    // because for this moment frontend creates order with appointment id in place of encounter one
    const metaTagCoding = getProcessMetaTag(this.#processId!);
    if (metaTagCoding?.tag?.[0]) {
      await cleanAppointmentGraph(metaTagCoding.tag[0], await this.apiClient);
    }
  }

  async waitTillAppointmentPreprocessed(id: string): Promise<void> {
    const apiClient = await this.apiClient;

    try {
      for (let i = 0; i < 10; i++) {
        const appointment = (
          await apiClient.fhir.search({
            resourceType: 'Appointment',
            params: [
              {
                name: '_id',
                value: id,
              },
            ],
          })
        ).unbundle()[0] as Appointment;

        const tags = appointment?.meta?.tag || [];
        const isProcessed = tags.some((tag) => tag?.code === FHIR_APPOINTMENT_PREPROCESSED_TAG.code);
        if (isProcessed) {
          return;
        }

        await new Promise((resolve) => setTimeout(resolve, 3000));
      }

      throw new Error("Appointment wasn't preprocessed");
    } catch (e) {
      console.error('Error during waitTillAppointmentPreprocessed', e);
      throw e;
    }
  }

  async waitTillHarvestingDone(appointmentId: string): Promise<void> {
    const apiClient = await this.apiClient;

    try {
      for (let i = 0; i < 10; i++) {
        const appointment = (
          await apiClient.fhir.search({
            resourceType: 'Appointment',
            params: [
              {
                name: '_id',
                value: appointmentId,
              },
            ],
          })
        ).unbundle()[0] as Appointment;

        const tags = appointment?.meta?.tag || [];
        const isHarvestingDone = tags.some(
          (tag) => tag?.code === FHIR_APPOINTMENT_INTAKE_HARVESTING_COMPLETED_TAG.code
        );
        if (isHarvestingDone) {
          return;
        }

        await new Promise((resolve) => setTimeout(resolve, 6000));
      }

      throw new Error("Appointment wasn't harvested by sub-intake-harvest module");
    } catch (e) {
      console.error('Error during waitTillHarvestingDone', e);
      throw e;
    }
  }

  async setEmployees(): Promise<void> {
    const apiClient = await this.apiClient;
    const authToken = await this.#authToken;

    try {
      const [employee1, employee2] = await Promise.all([
        inviteTestEmployeeUser(TEST_EMPLOYEE_1, apiClient, authToken),
        inviteTestEmployeeUser(TEST_EMPLOYEE_2, apiClient, authToken),
      ]);

      this.testEmployee1 = employee1!;
      this.testEmployee2 = employee2!;
    } catch (error) {
      console.error('❌ New providers were not invited', error);
    }
  }

  async deleteEmployees(): Promise<void> {
    const apiClient = await this.apiClient;
    const authToken = await this.#authToken;

    try {
      if (process.env.AUTH0_CLIENT_TESTS && process.env.AUTH0_SECRET_TESTS) {
        await Promise.all([
          removeUser(this.testEmployee1.id, this.testEmployee1.profile.id!, apiClient, authToken),
          removeUser(this.testEmployee2.id, this.testEmployee2.profile.id!, apiClient, authToken),
        ]);
      } else throw new Error('No "AUTH0_CLIENT_TESTS" or "AUTH0_SECRET_TESTS" secret provided');
    } catch (e) {
      console.error('❌ Failed to delete users: ', e);
    }
  }

  public get apiClient(): Promise<Oystehr> {
    return this.#apiClient;
  }

  public get patient(): Patient {
    return this.findResourceByType('Patient');
  }

  public get appointment(): Appointment {
    return this.findResourceByType('Appointment');
  }

  public get encounter(): Encounter {
    return this.findResourceByType('Encounter');
  }

  public get questionnaireResponse(): QuestionnaireResponse {
    return this.findResourceByType('QuestionnaireResponse');
  }

  private findResourceByType<T>(resourceType: string): T {
    const resource = Object.values(this.#resources).find((resource) => resource.resourceType === resourceType) as T;

    if (!resource) {
      throw new Error(`Resource ${resourceType} not found in the resources`);
    }

    return resource;
  }

  async patientIdByAppointmentId(appointmentId: string): Promise<string> {
    const apiClient = await this.apiClient;
    const appointment = await apiClient.fhir.get<Appointment>({
      resourceType: 'Appointment',
      id: appointmentId,
    });
    const patientId = appointment.participant
      .find((participant) => participant.actor?.reference?.startsWith('Patient/'))
      ?.actor?.reference?.split('/')[1];
    if (patientId == null) {
      throw new Error(`Patient for appointment ${appointmentId} not found`);
    }
    return patientId;
  }

  async getTestsUserAndPractitioner(): Promise<{
    id: string;
    name: string;
    email: string;
    practitioner: Practitioner;
  }> {
    const apiClient = await this.apiClient;
    const oystehrProjectId = process.env.PROJECT_ID;
    if (!oystehrProjectId) throw new Error('secret PROJECT_ID is not set');
    const { oystFetch } = createFetchClientWithOystAuth({
      authToken: await this.#authToken,
      projectId: oystehrProjectId,
    });
    const users = await oystFetch<
      {
        id: string;
        name: string;
        email: string;
        profile: string;
      }[]
    >('GET', 'https://project-api.zapehr.com/v1/user');

    const user = users?.find((user) => user.email === process.env.TEXT_USERNAME);
    if (!user) throw new Error('Failed to find authorized user');
    const practitioner = (await apiClient.fhir.get({
      resourceType: 'Practitioner',
      id: user.profile.replace('Practitioner/', ''),
    })) as Practitioner;
    return {
      id: user.id,
      name: user.name,
      email: user.email,
      practitioner,
    };
  }
}

const addProcessIdMetaTagToResource = (resource: FhirResource, processId: string): FhirResource => {
  const existingMeta = resource.meta || { tag: [] };
  const existingTags = existingMeta.tag ?? [];
  resource.meta = {
    ...existingMeta,
    tag: [
      ...existingTags,
      {
        system: E2E_TEST_RESOURCE_PROCESS_ID_SYSTEM,
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
        system: E2E_TEST_RESOURCE_PROCESS_ID_SYSTEM,
        code: processId,
      },
    ],
  };
};
