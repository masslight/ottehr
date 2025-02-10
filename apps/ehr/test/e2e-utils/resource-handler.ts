import Oystehr from '@oystehr/sdk';
import {
  Patient,
  Appointment,
  Encounter,
  RelatedPerson,
  DocumentReference,
  QuestionnaireResponse,
  Person,
  InsurancePlan,
} from 'fhir/r4';
import { FhirResource } from '@oystehr/sdk/dist/cjs/resources/types/fhir';
import { DateTime } from 'luxon';
import { createAppointment } from './resource/appointment';
import { createPatient } from './resource/patient';
import { createEncounter } from './resource/encounter';
import { getAuth0Token } from './auth/getAuth0Token';
import { createRelatedPerson } from './resource/related-person';
import { createDocumentReference } from './resource/insurance-document';
import { createQuestionnaireResponse } from './resource/questionnaire-response';
import {
  inviteTestEmployeeUser,
  removeUser,
  TEST_EMPLOYEE_1,
  TEST_EMPLOYEE_2,
  TestEmployee,
} from './resource/employees';
import { randomUUID } from 'crypto';
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
export const INSURANCE_NAME = 'Test insurance' + randomUUID();

export class ResourceHandler {
  private apiClient!: Oystehr;
  private authToken!: string;
  public patient!: Patient;
  public appointment!: Appointment;
  public encounter!: Encounter;
  public relatedPerson!: RelatedPerson;
  public person!: Person;
  public documentReference!: DocumentReference;
  public questionnaireResponse!: QuestionnaireResponse;
  public testEmployee1!: TestEmployee;
  public testEmployee2!: TestEmployee;
  public insurancePlan!: InsurancePlan;

  async initApi(): Promise<void> {
    this.authToken = await getAuth0Token();
    this.apiClient = new Oystehr({
      accessToken: this.authToken,
      fhirApiUrl: process.env.FHIR_API,
      projectApiUrl: process.env.AUTH0_AUDIENCE,
    });
  }

  async setResources(): Promise<void> {
    await this.initApi();

    if (!this.patient) {
      try {
        this.patient = (await this.apiClient.fhir.create(
          createPatient({
            firstName: PATIENT_FIRST_NAME,
            lastName: PATIENT_LAST_NAME,
            gender: PATIENT_GENDER,
            birthDate: PATIENT_BIRTHDAY,
            telecom: [
              {
                system: 'email',
                value: PATIENT_EMAIL,
              },
              {
                system: 'phone',
                value: '+1' + PATIENT_PHONE_NUMBER,
              },
            ],
            relationship: 'Parent/Guardian',
            city: PATIENT_CITY,
            line: PATIENT_LINE,
            state: PATIENT_STATE,
            postalCode: PATIENT_POSTALCODE,
          }) as FhirResource
        )) as Patient;
        console.log(`👏 patient created`, this.patient.id);
      } catch (error) {
        console.error('❌ Patient not created', error);
      }
    }

    if (!this.relatedPerson && this.patient.id) {
      try {
        this.relatedPerson = (await this.apiClient.fhir.create(
          createRelatedPerson({
            patientId: this.patient.id,
          })
        )) as RelatedPerson;
        console.log(`👏 related person created`, this.relatedPerson.id);
      } catch (error) {
        console.error('❌ Related person not created', error);
      }
    }

    if (!this.person && this.relatedPerson.id) {
      try {
        this.person = await this.apiClient.fhir.create({
          resourceType: 'Person',
          telecom: this.relatedPerson.telecom,
          link: [
            {
              target: {
                reference: 'RelatedPerson/' + this.relatedPerson.id,
              },
            },
          ],
        });
        console.log(`👏 person created`, this.person.id);
      } catch (error) {
        console.error('❌ Person not created', error);
      }
    }

    const americanDate = DateTime.local().setZone('America/New_York');
    const americanDayStart = americanDate.startOf('day');
    const americanDayEnd = americanDate.endOf('day');

    if (!this.appointment && this.patient.id) {
      try {
        this.appointment = (await this.apiClient.fhir.create(
          createAppointment({
            startTime: americanDayStart.toISO() as string,
            endTime: americanDayEnd.endOf('day').toISO() as string,
            patientId: this.patient.id,
            description: 'Test Appointment',
          })
        )) as Appointment;
        console.log(`👏 appointment created`, this.appointment.id);
      } catch (error) {
        console.error('❌ Appointment not created', error);
      }
    }

    if (!this.encounter && this.appointment.id && this.patient.id) {
      try {
        this.encounter = (await this.apiClient.fhir.create(
          createEncounter({
            patientId: this.patient.id,
            appointmentId: this.appointment.id,
            startTime: americanDayStart.toISO() as string,
          })
        )) as Encounter;

        console.log(`👏 encounter created`, this.encounter.id);
      } catch (error) {
        console.error('❌ Encounter not created', error);
      }
    }

    if (!this.documentReference && this.appointment.id && this.patient.id) {
      this.documentReference = (await this.apiClient.fhir.create(
        createDocumentReference({
          appointmentId: this.appointment.id,
          patientId: this.patient.id,
        })
      )) as DocumentReference;

      if (typeof this.encounter?.id === 'string') {
        console.log(`👏 documentReference created`, this.documentReference.id);
      } else {
        throw new Error('❌ documentReference not created');
      }
    }

    if (!this.questionnaireResponse && this.appointment.id && this.patient.id && this.encounter.id) {
      try {
        this.questionnaireResponse = (await this.apiClient.fhir.create(
          createQuestionnaireResponse({
            patientId: this.patient.id,
            encounterId: this.encounter.id,
            firstName: this.patient?.name?.[0]?.given?.[0] ?? 'no-first-name',
            lastName: this.patient?.name?.[0]?.family ?? 'no-last-name',
            birthDate: this.patient.birthDate
              ? {
                  day: DateTime.fromISO(this.patient.birthDate).toFormat('dd'),
                  month: DateTime.fromISO(this.patient.birthDate).toFormat('MM'),
                  year: DateTime.fromISO(this.patient.birthDate).toFormat('yyyy'),
                }
              : { day: '11', month: '11', year: '2024' },
          })
        )) as QuestionnaireResponse;

        console.log(`👏 questionnaireResponse created`, this.questionnaireResponse.id);
      } catch (error) {
        console.error('❌ QuestionnaireResponse not created', error);
      }
    }

    if (!this.insurancePlan) {
      try {
        this.insurancePlan = await this.apiClient.fhir.create({
          resourceType: 'InsurancePlan',
          name: INSURANCE_NAME,
          meta: {
            tag: [
              {
                code: 'insurance-payer-plan',
              },
            ],
          },
          status: 'active',
          extension: [
            {
              url: 'https://extensions.fhir.zapehr.com/insurance-requirements',
              extension: [
                {
                  url: 'requiresSubscriberId',
                  valueBoolean: true,
                },
                {
                  url: 'requiresSubscriberName',
                  valueBoolean: false,
                },
                {
                  url: 'requiresRelationshipToSubscriber',
                  valueBoolean: true,
                },
                {
                  url: 'requiresInsuranceName',
                  valueBoolean: true,
                },
                {
                  url: 'requiresInsuranceCardImage',
                  valueBoolean: true,
                },
                {
                  url: 'requiresSubscriberDOB',
                  valueBoolean: false,
                },
                {
                  url: 'requiresFacilityNPI',
                  valueBoolean: false,
                },
                {
                  url: 'requiresStateUID',
                  valueBoolean: false,
                },
                {
                  url: 'enabledEligibilityCheck',
                  valueBoolean: true,
                },
              ],
            },
          ],
        });
        console.log(`👏 insurance plan created`, this.insurancePlan.id, this.insurancePlan.name);
      } catch (error) {
        console.error('❌ insurance plan not created', error);
      }
    }
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
      console.error('❌ New providers were not invited', error, JSON.stringify(error));
    }
  }

  async deleteEmployees(): Promise<void> {
    try {
      // await tryToFindAndRemoveTestUsers(this.apiClient, this.authToken);
      await Promise.all([
        removeUser(this.testEmployee1.id, this.testEmployee1.profile.id!, this.apiClient, this.authToken),
        removeUser(this.testEmployee2.id, this.testEmployee2.profile.id!, this.apiClient, this.authToken),
      ]);
    } catch (e) {
      console.error('❌ Failed to delete users: ', e, JSON.stringify(e));
    }
  }

  async cleanupResources(): Promise<void> {
    if (this.patient?.id) {
      await this.apiClient.fhir.delete({ id: this.patient.id, resourceType: 'Patient' });
      console.log(`✅ patient deleted ${this.patient.id}`);
    }

    if (this.patient?.id) {
      await this.cleanupAppointments(this.patient.id);
      console.log(`✅ appointments deleted`);

      if (this.encounter?.id) {
        await this.apiClient.fhir.delete({ id: this.encounter.id, resourceType: 'Encounter' });
        console.log(`✅ encounter deleted ${this.encounter.id}`);
      }

      if (this.documentReference?.id) {
        await this.apiClient.fhir.delete({ id: this.documentReference.id, resourceType: 'DocumentReference' });
        console.log(`✅ document-reference deleted ${this.documentReference.id}`);
      }

      if (this.questionnaireResponse?.id) {
        await this.apiClient.fhir.delete({ id: this.questionnaireResponse.id, resourceType: 'QuestionnaireResponse' });
        console.log(`✅ questionnaire response deleted ${this.questionnaireResponse.id}`);
      }

      if (this.relatedPerson?.id) {
        await this.apiClient.fhir.delete({ id: this.relatedPerson.id, resourceType: 'RelatedPerson' });
        console.log(`✅ related person deleted ${this.relatedPerson.id}`);
      }

      if (this.person?.id) {
        await this.apiClient.fhir.delete({ id: this.person.id, resourceType: 'Person' });
        console.log(`✅ person deleted ${this.person.id}`);
      }

      if (this.insurancePlan?.id) {
        await this.apiClient.fhir.delete({ id: this.insurancePlan.id, resourceType: 'InsurancePlan' });
        console.log(`✅ insurance plan deleted ${this.insurancePlan.id}`);
      }
    }
  }

  async cleanupNewPatientData(lastName: string): Promise<void> {
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
