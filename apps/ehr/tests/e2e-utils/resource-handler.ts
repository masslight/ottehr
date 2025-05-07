import Oystehr from '@oystehr/sdk';
import { Address, Appointment, Encounter, Patient, Practitioner, QuestionnaireResponse } from 'fhir/r4b';
import { readFileSync } from 'fs';
import { DateTime } from 'luxon';
import { dirname, join } from 'path';
import { cleanAppointment } from 'test-utils';
import { fileURLToPath } from 'url';
import {
  CreateAppointmentResponse,
  createSamplePrebookAppointments,
  createSampleTelemedAppointments,
  FHIR_APPOINTMENT_INTAKE_HARVESTING_COMPLETED_TAG,
  FHIR_APPOINTMENT_PREPROCESSED_TAG,
  formatPhoneNumber,
  GetPaperworkAnswers,
  RelationshipOption,
} from 'utils';
import { getAuth0Token } from './auth/getAuth0Token';
import { fetchWithOystAuth } from './helpers/tests-utils';
import {
  inviteTestEmployeeUser,
  removeUser,
  TEST_EMPLOYEE_1,
  TEST_EMPLOYEE_2,
  TestEmployee,
} from './resource/employees';
import { getInHouseMedicationsResources } from './resource/in-house-medications';

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

const EightDigitsString = DateTime.now().toFormat('yyyyMMdd');

export const PATIENT_FIRST_NAME = 'Test_John_Random' + EightDigitsString;
export const PATIENT_LAST_NAME = 'Test_Doe_Random' + EightDigitsString; // don't use real random values in parallel related tests
export const PATIENT_GENDER = 'Male';

export const PATIENT_BIRTHDAY = '2002-07-07';
export const PATIENT_BIRTH_DATE_SHORT = '07/07/2002';
export const PATIENT_BIRTH_DATE_LONG = 'July 07, 2002';

export const PATIENT_PHONE_NUMBER = '21' + EightDigitsString;
export const PATIENT_EMAIL = `john.doe.${EightDigitsString}3@example.com`;
export const PATIENT_CITY = 'New York';
export const PATIENT_LINE = `${EightDigitsString} Test Line`;
export const PATIENT_STATE = 'NY';
export const PATIENT_POSTALCODE = '06001';
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
  #apiClient!: Oystehr;
  #authToken!: string;
  #resources!: CreateAppointmentResponse['resources'] & { relatedPerson: { id: string; resourceType: string } };
  #createAppointmentZambdaId: string;
  #flow: 'telemed' | 'in-person';
  #initPromise: Promise<void>;
  #paperworkAnswers?: GetPaperworkAnswers;

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

  public get apiClient(): Oystehr {
    return this.#apiClient;
  }

  constructor(flow: 'telemed' | 'in-person' = 'in-person', paperworkAnswers?: GetPaperworkAnswers) {
    this.#flow = flow;
    this.#paperworkAnswers = paperworkAnswers;

    this.#initPromise = this.initApi();

    if (flow === 'telemed' || flow === 'in-person') {
      this.#createAppointmentZambdaId = 'create-appointment';
    } else {
      throw new Error('❌ Invalid flow name');
    }
  }

  private async initApi(): Promise<void> {
    if (this.#apiClient && this.#authToken) {
      return;
    }
    this.#authToken = await getAuth0Token();
    this.#apiClient = new Oystehr({
      accessToken: this.#authToken,
      fhirApiUrl: process.env.FHIR_API,
      projectApiUrl: process.env.PROJECT_API_ZAMBDA_URL,
    });
  }

  private async createAppointment(inputParams?: CreateTestAppointmentInput): Promise<CreateAppointmentResponse> {
    await this.#initPromise;

    console.log('create appointment params', JSON.stringify(inputParams, null, 2));

    try {
      const address: Address = {
        city: inputParams?.city ?? PATIENT_CITY,
        line: [inputParams?.line ?? PATIENT_LINE],
        state: inputParams?.state ?? PATIENT_STATE,
        postalCode: inputParams?.postalCode ?? PATIENT_POSTALCODE,
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

      console.log('patientData', patientData);

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

      console.log('resource handler flow', this.#flow);

      // Create appointment and related resources using zambda
      const appointmentData =
        this.#flow === 'in-person'
          ? await createSamplePrebookAppointments({
              oystehr: this.#apiClient,
              authToken: getAccessToken(),
              phoneNumber: formatPhoneNumber(PATIENT_PHONE_NUMBER)!,
              createAppointmentZambdaId: this.#createAppointmentZambdaId,
              zambdaUrl: process.env.PROJECT_API_ZAMBDA_URL,
              selectedLocationId: inputParams?.selectedLocationId ?? process.env.LOCATION_ID,
              demoData: patientData,
              projectId: process.env.PROJECT_ID!,
              paperworkAnswers: this.#paperworkAnswers,
            })
          : await createSampleTelemedAppointments({
              oystehr: this.#apiClient,
              authToken: getAccessToken(),
              phoneNumber: formatPhoneNumber(PATIENT_PHONE_NUMBER)!,
              createAppointmentZambdaId: this.#createAppointmentZambdaId,
              islocal: process.env.APP_IS_LOCAL === 'true',
              zambdaUrl: process.env.PROJECT_API_ZAMBDA_URL,
              locationState: inputParams?.telemedLocationState ?? process.env.STATE_ONE, // todo: check why state is used here
              demoData: patientData,
              projectId: process.env.PROJECT_ID!,
              paperworkAnswers: this.#paperworkAnswers,
            });
      if (!appointmentData?.resources) {
        throw new Error('Appointment not created');
      }

      appointmentData.resources;

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
      // add relatedPerson to resources to make posiible cleanup it, endpoint returns only id
      relatedPerson: {
        id: response.relatedPersonId,
        resourceType: 'RelatedPerson',
      },
    };
  }

  public async cleanupResources(): Promise<void> {
    // TODO: here we should change appointment id to encounter id when we'll fix this bug in frontend,
    // because for this moment frontend creates order with appointment id in place of encounter one
    if (this.#resources.appointment) {
      const inHouseMedicationsResources = await getInHouseMedicationsResources(
        this.#apiClient,
        'encounter',
        this.#resources.appointment.id!
      );

      await Promise.allSettled([
        ...inHouseMedicationsResources.map((resource) => {
          if (resource.id && resource.resourceType) {
            return this.#apiClient.fhir
              .delete({ id: resource.id, resourceType: resource.resourceType })
              .then(() => {
                console.log(`🗑️ deleted ${resource.resourceType} ${resource.id}`);
              })
              .catch((error) => {
                console.error(`❌ 🗑️ ${resource.resourceType} not deleted ${resource.id}`, error);
              });
          } else {
            console.error(`❌ 🫣 resource not found: ${resource.resourceType} ${resource.id}`);
            return Promise.resolve();
          }
        }),
        this.cleanAppointment(this.#resources.appointment.id!),
      ]);
    }
  }

  async waitTillAppointmentPreprocessed(id: string): Promise<void> {
    try {
      await this.initApi();

      for (let i = 0; i < 10; i++) {
        const appointment = (
          await this.#apiClient.fhir.search({
            resourceType: 'Appointment',
            params: [
              {
                name: '_id',
                value: id,
              },
            ],
          })
        ).unbundle()[0] as Appointment;

        const tags = appointment.meta?.tag || [];
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
    try {
      await this.initApi();

      for (let i = 0; i < 10; i++) {
        const appointment = (
          await this.#apiClient.fhir.search({
            resourceType: 'Appointment',
            params: [
              {
                name: '_id',
                value: appointmentId,
              },
            ],
          })
        ).unbundle()[0] as Appointment;

        const tags = appointment.meta?.tag || [];
        const isHarvestingDone = tags.some(
          (tag) => tag?.code === FHIR_APPOINTMENT_INTAKE_HARVESTING_COMPLETED_TAG.code
        );
        if (isHarvestingDone) {
          return;
        }

        await new Promise((resolve) => setTimeout(resolve, 3000));
      }

      throw new Error("Appointment wasn't harvested by sub-intake-harvest module");
    } catch (e) {
      console.error('Error during waitTillHarvestingDone', e);
      throw e;
    }
  }

  async setEmployees(): Promise<void> {
    try {
      await this.#initPromise;
      const [employee1, employee2] = await Promise.all([
        inviteTestEmployeeUser(TEST_EMPLOYEE_1, this.#apiClient, this.#authToken),
        inviteTestEmployeeUser(TEST_EMPLOYEE_2, this.#apiClient, this.#authToken),
      ]);

      this.testEmployee1 = employee1!;
      this.testEmployee2 = employee2!;
    } catch (error) {
      console.error('❌ New providers were not invited', error);
    }
  }

  async deleteEmployees(): Promise<void> {
    try {
      if (process.env.AUTH0_CLIENT_TESTS && process.env.AUTH0_SECRET_TESTS) {
        await Promise.all([
          removeUser(this.testEmployee1.id, this.testEmployee1.profile.id!, this.#apiClient, this.#authToken),
          removeUser(this.testEmployee2.id, this.testEmployee2.profile.id!, this.#apiClient, this.#authToken),
        ]);
      } else throw new Error('No "AUTH0_CLIENT_TESTS" or "AUTH0_SECRET_TESTS" secret provided');
    } catch (e) {
      console.error('❌ Failed to delete users: ', e);
    }
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

  async cleanupAppointmentsForPatient(patientId: string): Promise<void> {
    const appointments = (
      await this.#apiClient.fhir.search({
        resourceType: 'Appointment',
        params: [
          {
            name: 'actor',
            value: 'Patient/' + patientId,
          },
        ],
      })
    ).unbundle();
    for (const appointment of appointments) {
      await cleanAppointment(appointment.id!, process.env.ENV!);
    }
  }

  async cleanAppointment(appointmentId: string): Promise<boolean> {
    return cleanAppointment(appointmentId, process.env.ENV!);
  }

  async patientIdByAppointmentId(appointmentId: string): Promise<string> {
    const appointment = await this.#apiClient.fhir.get<Appointment>({
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
    await this.#initPromise;
    const users = await fetchWithOystAuth<
      {
        id: string;
        name: string;
        email: string;
        profile: string;
      }[]
    >('GET', 'https://project-api.zapehr.com/v1/user', this.#authToken);

    const user = users?.find((user) => user.email === process.env.TEXT_USERNAME);
    if (!user) throw new Error('Failed to find authorized user');
    const practitioner = (await this.#apiClient.fhir.get({
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
