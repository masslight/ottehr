import {
  Appointment,
  DocumentReference,
  Encounter,
  FhirResource,
  Patient,
  Person,
  QuestionnaireResponse,
  RelatedPerson,
  Location,
  Practitioner,
} from 'fhir/r4b';
import { createPatient, PatientParams } from '../resource/patient';
import { createRelatedPerson } from '../resource/related-person';
import { DateTime } from 'luxon';
import { AppointmentParams, createTelemedAppointment } from '../resource/appointment';
import { createTelemedEncounter } from '../resource/encounter';
import { createDocumentReference } from '../resource/insurance-document';
import { ResourceHandlerAbstract } from './resource-handler-abstract';
import { allLicensesForPractitioner, getTelemedLocation, stateCodeToFullName } from '../temp-imports-from-utils';
import {
  PATIENT_BIRTHDAY,
  PATIENT_CITY,
  PATIENT_EMAIL,
  PATIENT_LINE,
  PATIENT_PHONE_NUMBER,
  PATIENT_POSTALCODE,
  PATIENT_STATE,
} from '../resource-handler';
import { fetchWithOystAuth } from '../helpers/tests-utils';
import { createQuestionnaireResponse } from '../resource/questionnaire-response';

interface PatientPackage {
  patient: Patient;
  relatedPerson: RelatedPerson;
  person: Person;
}

interface AppointmentPackage {
  appointment: Appointment;
  documentReference: DocumentReference;
  questionnaireResponse: QuestionnaireResponse;
}

interface LocationPackage {
  location: Location;
  state: string;
  fullName: string;
}

/**
 * TODO: We should use Zambdas for resource handling. The file
 * apps/ehr/test/e2e-utils/resource-handler.ts implements base
 * telemed/in-person create appointment logic using Zambdas.
 * We should migrate other cases to Zambdas as well.
 */
export class TelemedFlowResourceHandler extends ResourceHandlerAbstract {
  public myLocationPackage!: LocationPackage;
  public otherLocationPackage!: LocationPackage;
  public patientPackage!: PatientPackage;
  public myAppointment!: AppointmentPackage;
  public otherAppointment!: AppointmentPackage;

  async setResources(): Promise<void> {
    await this.initApi();

    console.log('fetching my user');
    const me = await this.getMyUserAndPractitioner();

    console.log('Getting my practitioner location from qualifications, and one that are not there');
    const myPractitionerLicenses = allLicensesForPractitioner(me.practitioner);
    const myState = myPractitionerLicenses.find((license) => license.active)?.state;
    const otherState = 'WV';
    if (!myState || !otherState)
      throw new Error('My practitioner has no active qualification states, or has all states in qualification');

    const myLocation = await getTelemedLocation(this.apiClient, myState);
    const otherLocation = await getTelemedLocation(this.apiClient, otherState);
    if (!myLocation || !otherLocation) throw new Error('Telemed Locations were not found');
    this.myLocationPackage = {
      location: myLocation,
      state: myState,
      fullName: stateCodeToFullName[myState],
    };
    this.otherLocationPackage = {
      location: otherLocation,
      state: otherState,
      fullName: stateCodeToFullName[otherState],
    };

    this.patientPackage = await this.createPatientPackage({
      firstName: 'E2E_tests_telemed_flow',
      lastName: 'Test_Last',
      gender: 'male',
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
    });

    const americanDate = DateTime.local().setZone('America/New_York');
    const americanDayStart = americanDate.startOf('day');
    const americanDayEnd = americanDate.endOf('day');

    this.myAppointment = await this.createAppointmentPackage(this.patientPackage.patient, {
      startTime: americanDayStart.toISO() as string,
      endTime: americanDayEnd.endOf('day').toISO() as string,
      patientId: this.patientPackage.patient.id!,
      description: 'fever',
      status: 'arrived',
      locationId: this.myLocationPackage.location.id!,
    });
    console.log('my location', this.myLocationPackage.state);
    console.log('my appointment: ', this.myAppointment.appointment.id);

    this.otherAppointment = await this.createAppointmentPackage(this.patientPackage.patient, {
      startTime: americanDayStart.toISO() as string,
      endTime: americanDayEnd.endOf('day').toISO() as string,
      patientId: this.patientPackage.patient.id!,
      description: 'fever',
      status: 'arrived',
      locationId: this.otherLocationPackage.location.id!,
    });
    console.log('other appointment: ', this.otherAppointment.appointment.id);
    console.log('other location', this.otherLocationPackage.state);
  }

  async createPatientPackage(patientParams: PatientParams): Promise<PatientPackage> {
    const res = createPatient(patientParams) as FhirResource;
    console.log('patient to create: ', JSON.stringify(res));
    const patient = (await this.createResource(res)) as Patient;

    const relatedPerson = (await this.createResource(
      createRelatedPerson({
        patientId: patient.id!,
      })
    )) as RelatedPerson;

    const person = (await this.createResource({
      resourceType: 'Person',
      telecom: relatedPerson.telecom,
      link: [
        {
          target: {
            reference: 'RelatedPerson/' + relatedPerson.id,
          },
        },
      ],
    })) as Person;

    return {
      patient,
      relatedPerson,
      person,
    };
  }

  async createAppointmentPackage(patient: Patient, appointmentParams: AppointmentParams): Promise<AppointmentPackage> {
    const appointment = (await this.createResource(createTelemedAppointment(appointmentParams))) as Appointment;

    const encounter = (await this.createResource(
      createTelemedEncounter({
        patientId: this.patientPackage.patient.id!,
        appointmentId: appointment.id,
        startTime: appointmentParams.startTime,
      })
    )) as Encounter;

    const documentReference = (await this.createResource(
      createDocumentReference({
        appointmentId: appointment.id!,
        patientId: patient.id!,
      })
    )) as DocumentReference;

    const questionnaireResponse = (await this.createResource(
      createQuestionnaireResponse({
        patientId: patient.id!,
        encounterId: encounter.id!,
        firstName: patient?.name?.[0]?.given?.[0] ?? 'no-first-name',
        lastName: patient?.name?.[0]?.family ?? 'no-last-name',
        birthDate: patient.birthDate
          ? {
              day: DateTime.fromISO(patient.birthDate).toFormat('dd'),
              month: DateTime.fromISO(patient.birthDate).toFormat('MM'),
              year: DateTime.fromISO(patient.birthDate).toFormat('yyyy'),
            }
          : { day: '11', month: '11', year: '2024' },
      })
    )) as QuestionnaireResponse;

    return {
      appointment,
      documentReference,
      questionnaireResponse,
    };
  }

  async getMyUserAndPractitioner(): Promise<{
    id: string;
    name: string;
    email: string;
    practitioner: Practitioner;
  }> {
    const users = await fetchWithOystAuth<
      {
        id: string;
        name: string;
        email: string;
        profile: string;
      }[]
    >('GET', 'https://project-api.zapehr.com/v1/user', this.accessToken);

    const myUser = users?.find((user) => user.email === process.env.TEXT_USERNAME);
    if (!myUser) throw new Error('Failed to find my user');
    const practitioner = (await this.apiClient.fhir.get({
      resourceType: 'Practitioner',
      id: myUser.profile.replace('Practitioner/', ''),
    })) as Practitioner;
    return {
      id: myUser.id,
      name: myUser.name,
      email: myUser.email,
      practitioner,
    };
  }
}
