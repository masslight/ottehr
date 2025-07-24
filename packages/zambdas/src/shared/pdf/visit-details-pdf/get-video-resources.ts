import Oystehr from '@oystehr/sdk';
import {
  Account,
  Appointment,
  ChargeItem,
  Coverage,
  DocumentReference,
  Encounter,
  List,
  Location,
  Patient,
  Practitioner,
  QuestionnaireResponse,
  Resource,
  Schedule,
} from 'fhir/r4b';
import { getTimezone, isNonPaperworkQuestionnaireResponse, TIMEZONES } from 'utils';
import { getVideoRoomResourceExtension } from '../../helpers';
import { FullAppointmentResourcePackage } from './types';

export const getAppointmentAndRelatedResources = async (
  oystehr: Oystehr,
  appointmentId: string,
  inPerson?: boolean
): Promise<FullAppointmentResourcePackage | undefined> => {
  //
  // Attempting to get three items: Encounter, Appointment and charge Item
  // FHIR API Query looks something like this:
  // Encounter?appointment=Appointment/d2d0f76d-5bc5-4d99-a5b4-8e16ebfe7e47
  //          &_include=Encounter:appointment
  //          &_revinclude=ChargeItem:context
  //          &_include=Encounter:subject
  //          &_revinclude:iterate=Account:patient
  //
  // Given an appointment ID, find an Encounter for this appointment, a Charge Item for which the Encounter
  // is its context, a patient that's the subject of the encounter, and the Account for this patient
  //

  const items: Array<
    | Appointment
    | Encounter
    | ChargeItem
    | Patient
    | Account
    | Location
    | QuestionnaireResponse
    | Practitioner
    | DocumentReference
    | List
    | Coverage
    | Schedule
  > = (
    await oystehr.fhir.search<
      | Appointment
      | Encounter
      | ChargeItem
      | Patient
      | Account
      | Location
      | QuestionnaireResponse
      | Practitioner
      | DocumentReference
      | List
      | Coverage
      | Schedule
    >({
      resourceType: 'Encounter',
      params: [
        {
          name: 'appointment',
          value: `Appointment/${appointmentId}`,
        },
        {
          name: '_include',
          value: 'Encounter:appointment',
        },
        {
          name: '_revinclude',
          value: 'ChargeItem:context',
        },
        {
          name: '_include',
          value: 'Encounter:subject',
        },
        {
          name: '_include:iterate',
          value: 'Appointment:location',
        },
        {
          name: '_revinclude:iterate',
          value: 'Schedule:actor:Location',
        },
        { name: '_revinclude:iterate', value: 'Schedule:actor:Practitioner' },
        {
          name: '_include:iterate',
          value: 'Encounter:participant:Practitioner',
        },
        {
          name: '_revinclude:iterate',
          value: 'Account:patient',
        },
        {
          name: '_revinclude:iterate',
          value: 'QuestionnaireResponse:encounter',
        },
        {
          name: '_revinclude:iterate',
          value: 'DocumentReference:encounter',
        },
        {
          name: '_revinclude:iterate',
          value: 'Coverage:beneficiary',
        },
        {
          name: '_revinclude:iterate',
          value: 'List:patient',
        },
      ],
    })
  )
    .unbundle()
    .filter((resource) => isNonPaperworkQuestionnaireResponse(resource) === false);

  // TODO: rewrite all casts cause potentially all those resources can be undefined
  const appointment: Appointment | undefined = items.find((item: Resource) => {
    return item.resourceType === 'Appointment';
  }) as Appointment;
  if (!appointment) return undefined;

  const encounter: Encounter | undefined = items.find((item: Resource) => {
    return item.resourceType === 'Encounter' && (inPerson || getVideoRoomResourceExtension(item));
  }) as Encounter;
  if (!encounter) return undefined;

  const chargeItem: ChargeItem | undefined = items.find((item: Resource) => {
    return item.resourceType === 'ChargeItem';
  }) as ChargeItem;

  const patient: Patient | undefined = items.find((item: Resource) => {
    return item.resourceType === 'Patient';
  }) as Patient;

  const account: Account | undefined = items.find((item: Resource) => {
    return item.resourceType === 'Account';
  }) as Account;

  const location: Location | undefined = items.find((item: Resource) => {
    return item.resourceType === 'Location';
  }) as Location;

  const questionnaireResponse: QuestionnaireResponse | undefined = items?.find(
    (item: Resource) => item.resourceType === 'QuestionnaireResponse'
  ) as QuestionnaireResponse;

  const practitioners: Practitioner[] | undefined = items.filter((item: Resource) => {
    return item.resourceType === 'Practitioner';
  }) as Practitioner[];

  const documentReferences: DocumentReference[] | undefined = items.filter((item: Resource) => {
    return item.resourceType === 'DocumentReference';
  }) as DocumentReference[];

  const coverage: Coverage | undefined = items?.find((item: Resource) => {
    return item.resourceType === 'Coverage';
  }) as Coverage;

  const schedule: Schedule | undefined = items?.find((item: Resource) => {
    return item.resourceType === 'Schedule';
  }) as Schedule;

  const listResources = items.filter((item) => item.resourceType === 'List') as List[];

  let timezone: string;
  if (schedule) {
    timezone = getTimezone(schedule);
  } else if (location) {
    timezone = getTimezone(location);
  } else {
    timezone = TIMEZONES[0];
  }

  return {
    appointment,
    encounter,
    chargeItem,
    patient,
    account,
    location,
    questionnaireResponse,
    practitioners,
    documentReferences,
    coverage,
    listResources,
    timezone,
  };
};
