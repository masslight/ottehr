import Oystehr from '@oystehr/sdk';
import { Patient, Appointment, Encounter, QuestionnaireResponse, Address } from 'fhir/r4b';
import { getAuth0Token } from './auth/getAuth0Token';
import {
  inviteTestEmployeeUser,
  removeUser,
  TEST_EMPLOYEE_1,
  TEST_EMPLOYEE_2,
  TestEmployee,
} from './resource/employees';
import { randomUUID } from 'crypto';
import {
  CreateAppointmentResponse,
  CreateAppointmentUCTelemedResponse,
  createSampleAppointments,
  createSampleTelemedAppointments,
  formatPhoneNumber,
} from 'utils';
import { join } from 'path';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

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

export const PATIENT_FIRST_NAME = 'Test_John';
export const PATIENT_LAST_NAME = 'Test_Doe_Random'; // don't use real random values in parallel related tests
export const PATIENT_GENDER = 'male';

export const PATIENT_BIRTHDAY = '2002-07-07';
export const PATIENT_BIRTH_DATE_SHORT = '07/07/2002';
export const PATIENT_BIRTH_DATE_LONG = 'July 07, 2002';

export const PATIENT_PHONE_NUMBER = '2144985545';
export const PATIENT_EMAIL = 'john.doe3@example.com';
export const PATIENT_CITY = 'New York';
export const PATIENT_LINE = '10 Test Line';
export const PATIENT_STATE = 'NY';
export const PATIENT_POSTALCODE = '06001';
export const PATIENT_REASON_FOR_VISIT = 'Fever';

export class ResourceHandler {
  private apiClient!: Oystehr;
  private authToken!: string;
  private resources!: CreateAppointmentResponse['resources'] & { relatedPerson: { id: string; resourceType: string } };
  private zambdaId: string;
  private flow: 'telemed' | 'in-person';

  public testEmployee1!: TestEmployee;
  public testEmployee2!: TestEmployee;

  constructor(flow: 'telemed' | 'in-person' = 'in-person') {
    this.flow = flow;

    if (flow === 'in-person') {
      this.zambdaId = process.env.CREATE_APPOINTMENT_ZAMBDA_ID!;
      return;
    }

    if (flow === 'telemed') {
      this.zambdaId = process.env.CREATE_TELEMED_APPOINTMENT_ZAMBDA_ID!;
      return;
    }

    throw new Error('❌ Invalid flow name');
  }

  private async initApi(): Promise<void> {
    if (this.apiClient && this.authToken) {
      return;
    }
    this.authToken = await getAuth0Token();
    this.apiClient = new Oystehr({
      accessToken: this.authToken,
      fhirApiUrl: process.env.FHIR_API,
      projectApiUrl: process.env.AUTH0_AUDIENCE,
    });
  }

  private async createAppointment(): Promise<CreateAppointmentResponse | CreateAppointmentUCTelemedResponse> {
    await this.initApi();

    try {
      const address: Address = {
        city: PATIENT_CITY,
        line: [PATIENT_LINE],
        state: PATIENT_STATE,
        postalCode: PATIENT_POSTALCODE,
      };

      // Create appointment and related resources using zambda
      const appointmentData =
        this.flow === 'in-person'
          ? await createSampleAppointments(
              this.apiClient,
              getAccessToken(),
              formatPhoneNumber(PATIENT_PHONE_NUMBER)!,
              this.zambdaId,
              process.env.APP_IS_LOCAL === 'true',
              process.env.PROJECT_API_ZAMBDA_URL!,
              process.env.LOCATION_ID!,
              {
                firstNames: [PATIENT_FIRST_NAME],
                lastNames: [PATIENT_LAST_NAME],
                numberOfAppointments: 1,
                reasonsForVisit: [PATIENT_REASON_FOR_VISIT],
                phoneNumbers: [PATIENT_PHONE_NUMBER],
                emails: [PATIENT_EMAIL],
                gender: PATIENT_GENDER,
                birthDate: PATIENT_BIRTHDAY,
                address: [address],
              }
            )
          : await createSampleTelemedAppointments(
              this.apiClient,
              getAccessToken(),
              formatPhoneNumber(PATIENT_PHONE_NUMBER)!,
              this.zambdaId,
              process.env.APP_IS_LOCAL === 'true',
              process.env.PROJECT_API_ZAMBDA_URL!,
              process.env.STATE_ONE!, //LOCATION_ID!, // do we oficially have STATE env variable?
              {
                firstNames: [PATIENT_FIRST_NAME],
                lastNames: [PATIENT_LAST_NAME],
                numberOfAppointments: 1,
                reasonsForVisit: [PATIENT_REASON_FOR_VISIT],
                phoneNumbers: [PATIENT_PHONE_NUMBER],
                emails: [PATIENT_EMAIL],
                gender: PATIENT_GENDER,
                birthDate: PATIENT_BIRTHDAY,
                address: [address],
              }
            );

      console.log({ appointmentData });

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

      return appointmentData;
    } catch (error) {
      console.error('❌ Failed to create resources:', error);
      throw error;
    }
  }

  public async setResources(): Promise<void> {
    const response = await this.createAppointment();

    this.resources = {
      ...response.resources,
      // add relatedPerson to resources to make posiible cleanup it, endpoint returns only id
      relatedPerson: {
        id: response.relatedPersonId,
        resourceType: 'RelatedPerson',
      },
    };
  }

  public async cleanupResources(): Promise<void> {
    await Promise.allSettled(
      Object.values(this.resources ?? {}).map((resource) => {
        if (resource.id && resource.resourceType) {
          return this.apiClient.fhir
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
      })
    );
  }

  async setEmployees(): Promise<void> {
    try {
      await this.initApi();
      const [employee1, employee2] = await Promise.all([
        inviteTestEmployeeUser(TEST_EMPLOYEE_1, this.apiClient, this.authToken),
        inviteTestEmployeeUser(TEST_EMPLOYEE_2, this.apiClient, this.authToken),
      ]);
      this.testEmployee1 = employee1!;
      this.testEmployee2 = employee2!;
    } catch (error) {
      console.error('❌ New providers were not invited', error);
    }
  }

  async deleteEmployees(): Promise<void> {
    try {
      await Promise.all([
        removeUser(this.testEmployee1.id, this.testEmployee1.profile.id!, this.apiClient, this.authToken),
        removeUser(this.testEmployee2.id, this.testEmployee2.profile.id!, this.apiClient, this.authToken),
      ]);
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
    const resourse = Object.values(this.resources).find((resource) => resource.resourceType === resourceType) as T;

    if (!resourse) {
      throw new Error(`Resource ${resourceType} not found in the resources`);
    }

    return resourse;
  }

  async cleanupNewPatientData(lastName: string): Promise<void> {
    try {
      await this.initApi();
      const patients = (
        await this.apiClient.fhir.search({
          resourceType: 'Patient',
          params: [
            {
              name: 'name',
              value: lastName,
            },
          ],
        })
      ).unbundle();
      for (const patient of patients) {
        await this.cleanupAppointments(patient.id!);
        await this.apiClient.fhir.delete({ resourceType: patient.resourceType, id: patient.id! }).catch();
      }
    } catch (e) {
      console.error('Error during cleanupNewPatientData', e);
    }
  }

  async cleanupAppointments(patientId: string): Promise<void> {
    const appointments = (
      await this.apiClient.fhir.search({
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
      await this.apiClient.fhir.delete({ resourceType: appointment.resourceType, id: appointment.id! }).catch();
    }
  }
}
