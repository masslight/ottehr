import Oystehr, { BatchInputRequest, OystehrConfig } from '@oystehr/sdk';
import { Operation } from 'fast-json-patch';
import {
  Appointment,
  Attachment,
  Encounter,
  FhirResource,
  HealthcareService,
  Location,
  LocationHoursOfOperation,
  Meta,
  Practitioner,
  QuestionnaireResponse,
  RelatedPerson,
  Resource,
} from 'fhir/r4b';
import { DateTime } from 'luxon';
import {
  AvailableLocationInformation,
  EncounterVirtualServiceExtension,
  findQuestionnaireResponseItemLinkId,
  getScheduleDetails,
  getSecret,
  HOURS_OF_OPERATION_FORMAT,
  OVERRIDE_DATE_FORMAT,
  pickFirstValueFromAnswerItem,
  PRIVATE_EXTENSION_BASE_URL,
  PUBLIC_EXTENSION_BASE_URL,
  ScheduleType,
  Secrets,
  SecretsKeys,
  SLUG_SYSTEM,
  TELEMED_VIDEO_ROOM_CODE,
} from 'utils';
import { ZambdaInput } from './types';

export function createOystehrClient(token: string, secrets: Secrets | null): Oystehr {
  const FHIR_API = getSecret(SecretsKeys.FHIR_API, secrets).replace(/\/r4/g, '');
  const PROJECT_API = getSecret(SecretsKeys.PROJECT_API, secrets);
  const CLIENT_CONFIG: OystehrConfig = {
    accessToken: token,
    fhirApiUrl: FHIR_API,
    projectApiUrl: PROJECT_API,
  };
  return new Oystehr(CLIENT_CONFIG);
}

export interface SMSModel {
  // eventually we won't need both of these but it might be useful to have the smsNumber extracted out as a handy key anyway
  relatedPersonParticipant: string;
  smsNumber: string;
  hasUnreadMessages: boolean;
}

// returns a map from a patient reference to all related persons linked to that patient
export const getRelatedPersonsFromResourceList = (resources: Resource[]): Record<string, RelatedPerson[]> => {
  const mapToReturn: Record<string, RelatedPerson[]> = {};
  return (resources.filter((res) => res.resourceType === 'RelatedPerson') as RelatedPerson[]).reduce(
    (accum, current) => {
      const patientref = current.patient.reference;
      if (!patientref) {
        return accum;
      }
      if (accum[patientref] === undefined) {
        accum[patientref] = [current];
      } else {
        accum[patientref].push(current);
      }
      return accum;
    },
    mapToReturn
  );
};

export const getVideoRoomResourceExtension = (resource: Resource): EncounterVirtualServiceExtension | null => {
  let resourcePrefix: string;
  let castedResource;
  if (resource.resourceType === 'Appointment') {
    castedResource = resource as Appointment;
    resourcePrefix = 'appointment';
  } else if (resource.resourceType === 'Encounter') {
    castedResource = resource as Encounter;
    resourcePrefix = 'encounter';
  } else {
    return null;
  }

  for (let index = 0; index < (castedResource.extension?.length ?? 0); index++) {
    const extension = castedResource.extension![index];
    if (extension.url !== `${PUBLIC_EXTENSION_BASE_URL}/${resourcePrefix}-virtual-service-pre-release`) {
      continue;
    }
    for (let j = 0; j < (extension?.extension?.length ?? 0); j++) {
      const internalExtension = extension.extension![j];
      if (internalExtension.url === 'channelType' && internalExtension.valueCoding?.code === TELEMED_VIDEO_ROOM_CODE) {
        return extension as EncounterVirtualServiceExtension;
      }
    }
  }
  return null;
};

export const getMinutesDifference = (startDateTime: string, endDateTime: string): number =>
  DateTime.fromISO(endDateTime).diff(DateTime.fromISO(startDateTime), 'minutes').minutes;

export const getCurrentTimeDifference = (startDateTime: string): number =>
  DateTime.now().diff(DateTime.fromISO(startDateTime), 'minutes').minutes;

export interface GetPatchBinaryInput {
  resourceId: string;
  resourceType: string;
  patchOperations: Operation[];
}

export function getPatchBinary<F extends FhirResource>(input: GetPatchBinaryInput): BatchInputRequest<F> {
  const { resourceId, resourceType, patchOperations } = input;
  return {
    method: 'PATCH',
    url: `/${resourceType}/${resourceId}`,
    resource: {
      resourceType: 'Binary',
      // data is handled due to bug with non latin1 characters
      data: btoa(unescape(encodeURIComponent(JSON.stringify(patchOperations)))),
      contentType: 'application/json-patch+json',
    },
  };
}

export function logTime(): void {
  if (process.env.IS_OFFLINE === 'true') {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    require('console-stamp')(console, 'HH:MM:ss.l');
  }
}

/*
{
  "resourceType": "Communication",
  "status": "in-progress",
  "medium": [
    {
      "coding": [
        {
          "system": "http://terminology.hl7.org/CodeSystem/v3-ParticipationMode",
          "code": "SMSWRIT"
        }
      ]
    }
  ],
  "sent": "2023-11-19T18:27:51.387+00:00",
  "payload": [
    {
      "contentString": "Your appointment is confirmed. We look forward to seeing you January 18, 2023 at 5:00PM EDT. To reschedule or cancel visit https://app.notarealpractice.com/visit/4xDzrJKXDOY"
    }
  ],
  "recipient": [
    {
      "reference": "Patient/51940f7e-7311-4006-b9aa-83bbc0c5b62c"
    }
  ],
  "note": [
    {
      "time": "2023-11-19T18:27:51.387+00:00",
      "text": "Message sent using ZapEHR SMS"
    },
    {
      "time": "2023-11-19T18:27:51.387+00:00",
      "text": "Message sent to number: +12345678900"
    }
  ],
  "id": "d96634a9-082d-4e98-93d2-f514cde691fd",
  "meta": {
    "versionId": "1478e1d4-d4e2-49f0-a99c-8fae79e09584",
    "lastUpdated": "2023-11-19T18:27:52.121Z"
  }
}


*/

export function isValidPhoneNumber(phone: string): boolean {
  const phoneRegex = /^\(?([0-9]{3})\)?[-. ]?([0-9]{3})[-. ]?([0-9]{4})$/;
  return phoneRegex.test(phone);
}

export function isValidNPI(npi: string): boolean {
  const npiRegex = /^\d{10}$/;
  return npiRegex.test(npi);
}

export const fillMeta = (code: string, system: string): Meta => ({
  tag: [
    {
      code: code,
      system: `${PRIVATE_EXTENSION_BASE_URL}/${system}`,
    },
  ],
});

export function assertDefined<T>(value: T, name: string): NonNullable<T> {
  if (value == null) {
    throw `"${name}" is undefined`;
  }
  return value;
}

export const validateString = (value: any, propertyName: string): string => {
  if (typeof value !== 'string') {
    throw new Error(`"${propertyName}" property must be a string`);
  }
  return value;
};

export function validateJsonBody(input: ZambdaInput): any {
  if (!input.body) {
    throw new Error('No request body provided');
  }
  try {
    return JSON.parse(input.body);
  } catch (_error) {
    throw new Error('Invalid JSON in request body');
  }
}

export function getParticipantFromAppointment(appointment: Appointment, participant: string): string {
  const participantTemp = appointment.participant
    .find((currentParticipant: any) => currentParticipant.actor?.reference?.startsWith(participant))
    ?.actor?.reference?.replace(`${participant}/`, '');

  if (!participantTemp) {
    throw new Error('Participant not found in list of appointment participants');
  }

  return participantTemp;
}

export function checkValidBookingTime(slotTime: string): boolean {
  const slotDate = DateTime.fromISO(slotTime);

  const currentDate = DateTime.now().setZone('UTC');

  return slotDate > currentDate;
}

export function getBucketAndObjectFromZ3URL(z3URL: string, projectAPI: string): { bucket: string; object: string } {
  const updatedPhotoIdFrontUrl = z3URL.replace(`${projectAPI}/z3/object/`, '');
  const photoIdFrontItems = updatedPhotoIdFrontUrl.split('/');
  const bucket = photoIdFrontItems[0];
  const object = photoIdFrontItems.slice(1).join('/');
  return { bucket, object };
}

export function getOtherOfficesForLocation(location: Location): { display: string; url: string }[] {
  const rawExtensionValue = location?.extension?.find(
    (extensionTemp) => extensionTemp.url === 'https://fhir.zapehr.com/r4/StructureDefinitions/other-offices'
  )?.valueString;
  if (!rawExtensionValue) {
    console.log("Location doesn't have other-offices extension");
    return [];
  }

  let parsedExtValue: { display: string; url: string }[] = [];
  try {
    parsedExtValue = JSON.parse(rawExtensionValue);
  } catch (_) {
    console.log('Location other-offices extension is formatted incorrectly');
    return [];
  }

  return parsedExtValue;
}

// todo 1.8: this needs to take a schedule (or be async and go get a schedule), have a better name
// also check that this data is truly needed everywhere it is used
export function getLocationInformation(
  oystehr: Oystehr,
  scheduleResource: Location | Practitioner | HealthcareService,
  currentDate: DateTime = DateTime.now()
): AvailableLocationInformation {
  const slug = scheduleResource.identifier?.find((identifierTemp) => identifierTemp.system === SLUG_SYSTEM)?.value;
  const timezone = scheduleResource.extension?.find(
    (extensionTemp) => extensionTemp.url === 'http://hl7.org/fhir/StructureDefinition/timezone'
  )?.valueString;

  const schedule = getScheduleDetails(scheduleResource);
  const scheduleOverrides = schedule?.scheduleOverrides || {};

  let scheduleType: ScheduleType;
  switch (scheduleResource?.resourceType) {
    case 'Location':
      scheduleType = ScheduleType['location'];
      break;
    case 'HealthcareService':
      scheduleType = ScheduleType['group'];
      break;
    case 'Practitioner':
      scheduleType = ScheduleType['provider'];
      break;
  }

  // Modify hours of operation returned based on schedule overrides
  let hoursOfOperation: LocationHoursOfOperation[] | undefined = undefined;
  if (scheduleResource.resourceType === 'Location') {
    hoursOfOperation = scheduleResource.hoursOfOperation;
    currentDate = currentDate.setZone(timezone);
    const overrideDate = Object.keys(scheduleOverrides).find((date) => {
      return currentDate.toFormat(OVERRIDE_DATE_FORMAT) === date;
    });
    if (overrideDate) {
      const dayOfWeek = currentDate.toFormat('EEE').toLowerCase();
      const override = scheduleOverrides[overrideDate];
      const dayIndex = hoursOfOperation?.findIndex((hour) => (hour.daysOfWeek as string[])?.includes(dayOfWeek));
      if (hoursOfOperation && typeof dayIndex !== 'undefined' && dayIndex >= 0) {
        hoursOfOperation[dayIndex].openingTime = DateTime.fromFormat(override.open.toString(), 'h')
          .set({
            year: currentDate.year,
            month: currentDate.month,
            day: currentDate.day,
          })
          .toFormat(HOURS_OF_OPERATION_FORMAT);
        hoursOfOperation[dayIndex].closingTime = DateTime.fromFormat(override.close.toString(), 'h')
          .set({
            year: currentDate.year,
            month: currentDate.month,
            day: currentDate.day,
          })
          .toFormat(HOURS_OF_OPERATION_FORMAT);
      }
    }
  }

  return {
    id: scheduleResource.id,
    slug: slug,
    name: getName(oystehr, scheduleResource),
    description: undefined,
    address: undefined,
    telecom: scheduleResource.telecom,
    hoursOfOperation: hoursOfOperation,
    timezone: timezone,
    closures: schedule?.closures ?? [],
    otherOffices: [], // todo
    scheduleType,
  };
}

function getName(oystehrClient: Oystehr, item: Location | Practitioner | HealthcareService): string {
  if (!item.name) {
    return 'Unknown';
  }
  if (item.resourceType === 'Location') {
    return item.name;
  }
  if (item.resourceType === 'HealthcareService') {
    return item.name;
  }
  return oystehrClient.fhir.formatHumanName(item.name[0]);
}

export function getEncounterStatusHistoryIdx(encounter: Encounter, status: string): number {
  if (encounter.statusHistory) {
    return encounter.statusHistory.findIndex((history) => history.status === status && !history.period.end);
  } else {
    throw new Error('Encounter status history not found');
  }
}

export function checkPaperworkComplete(questionnaireResponse: QuestionnaireResponse): boolean {
  if (questionnaireResponse?.status === 'completed' || questionnaireResponse?.status === 'amended') {
    let photoIdFront: Attachment | undefined;
    const photoIdFrontItem = findQuestionnaireResponseItemLinkId('photo-id-front', questionnaireResponse?.item ?? []);
    if (photoIdFrontItem) {
      photoIdFront = pickFirstValueFromAnswerItem(photoIdFrontItem, 'attachment');
    }
    if (photoIdFront) {
      return true;
    }
  }
  return false;
}
