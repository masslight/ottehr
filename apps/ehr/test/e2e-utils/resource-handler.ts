import Oystehr from '@oystehr/sdk';
import {
  Patient,
  Appointment,
  Encounter,
  RelatedPerson,
  DocumentReference,
  QuestionnaireResponse,
  Person,
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

export class ResourceHandler {
  private apiClient!: Oystehr;
  public patient!: Patient;
  public appointment!: Appointment;
  public encounter!: Encounter;
  public relatedPerson!: RelatedPerson;
  public person!: Person;
  public documentReference!: DocumentReference;
  public questionnaireResponse!: QuestionnaireResponse;

  async initApi(): Promise<void> {
    this.apiClient = new Oystehr({
      accessToken: await getAuth0Token(),
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
            firstName: 'Test_John',
            lastName: 'Test_Doe',
            gender: 'male',
            birthDate: '2024-01-01',
            email: 'john.doe@example.com',
            relationship: 'Parent/Guardian',
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
  }

  async cleanupResources(): Promise<void> {
    if (this.patient?.id) {
      await this.apiClient.fhir.delete({ id: this.patient.id, resourceType: 'Patient' });
      console.log(`✅ patient deleted ${this.patient.id}`);
    }

    if (this.appointment?.id) {
      await this.apiClient.fhir.delete({ id: this.appointment.id, resourceType: 'Appointment' });
      console.log(`✅ appointment deleted ${this.appointment.id}`);
    }

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
  }
}
