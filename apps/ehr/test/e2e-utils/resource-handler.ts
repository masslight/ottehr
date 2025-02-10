import Oystehr from '@oystehr/sdk';
import { Patient, Appointment, Encounter, QuestionnaireResponse, Address } from 'fhir/r4';
import { getAuth0Token } from './auth/getAuth0Token';
import {
  inviteTestEmployeeUser,
  removeUser,
  TEST_EMPLOYEE_1,
  TEST_EMPLOYEE_2,
  TestEmployee,
} from './resource/employees';
import { randomUUID } from 'crypto';
import { CreateAppointmentResponse, createSampleAppointments, formatPhoneNumber } from 'utils';
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
export const PATIENT_LAST_NAME = 'Test_Doe' + randomUUID();
export const PATIENT_GENDER = 'male';
export const PATIENT_BIRTHDAY = '2024-01-01';
export const PATIENT_PHONE_NUMBER = '2144985555';
export const PATIENT_EMAIL = 'john.doe@example.com';
export const PATIENT_CITY = 'New York';
export const PATIENT_LINE = '10 Cooper Square';
export const PATIENT_STATE = 'NY';
export const PATIENT_POSTALCODE = '06001';

export class ResourceHandler {
  private apiClient!: Oystehr;
  private authToken!: string;
  private resources!: CreateAppointmentResponse['resources'];
  private zambdaId: string;

  public testEmployee1!: TestEmployee;
  public testEmployee2!: TestEmployee;

  constructor(zambdaName: string = process.env.CREATE_APPOINTMENT_ZAMBDA_ID!) {
    this.zambdaId = zambdaName;
  }

  public async initApi(): Promise<void> {
    this.authToken = await getAuth0Token();
    this.apiClient = new Oystehr({
      accessToken: this.authToken,
      fhirApiUrl: process.env.FHIR_API,
      projectApiUrl: process.env.AUTH0_AUDIENCE,
    });
  }

  public async setResources(): Promise<void> {
    await this.initApi();

    try {
      const address: Address = {
        city: PATIENT_CITY,
        line: [PATIENT_LINE],
        state: PATIENT_STATE,
        postalCode: PATIENT_POSTALCODE,
      };

      // Create appointment and related resources using zambda
      const appointmentData = await createSampleAppointments(
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
          reasonsForVisit: ['Fever'],
          phoneNumbers: [PATIENT_PHONE_NUMBER],
          emails: [PATIENT_EMAIL],
          gender: PATIENT_GENDER,
          birthDate: PATIENT_BIRTHDAY,
          address: [address],
        }
      );

      if (!appointmentData) {
        throw new Error('Appointment not created');
      }

      this.resources = appointmentData.resources;

      Object.values(this.resources).forEach((resource) => {
        console.log(`✅ created ${resource.resourceType}: ${resource.id}`);
      });
    } catch (error) {
      console.error('❌ Failed to create resources:', error);
      throw error;
    }
  }

  async cleanupResources(): Promise<void> {
    await Promise.allSettled(
      Object.values(this.resources).map((resource) => {
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

  public get patient(): Patient | undefined {
    return this.findResourceByType('Patient');
  }

  public get appointment(): Appointment | undefined {
    return this.findResourceByType('Appointment');
  }

  public get encounter(): Encounter | undefined {
    return this.findResourceByType('Encounter');
  }

  public get questionnaireResponse(): QuestionnaireResponse | undefined {
    return this.findResourceByType('QuestionnaireResponse');
  }

  private findResourceByType<T>(resourceType: string): T | undefined {
    return Object.values(this.resources).find((resource) => resource.resourceType === resourceType) as T;
  }
}
