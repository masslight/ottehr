import Oystehr, { BatchInputRequest, OystehrConfig } from '@oystehr/sdk';
import { Operation } from 'fast-json-patch';
import {
  Appointment,
  Attachment,
  Encounter,
  FhirResource,
  Location,
  Meta,
  QuestionnaireResponse,
  RelatedPerson,
  Resource,
} from 'fhir/r4b';
import { DateTime } from 'luxon';
import {
  EncounterVirtualServiceExtension,
  findQuestionnaireResponseItemLinkId,
  getSecret,
  pickFirstValueFromAnswerItem,
  PRIVATE_EXTENSION_BASE_URL,
  PUBLIC_EXTENSION_BASE_URL,
  Secrets,
  SecretsKeys,
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
      const patientRef = current.patient.reference;
      if (!patientRef) {
        return accum;
      }
      if (accum[patientRef] === undefined) {
        accum[patientRef] = [current];
      } else {
        accum[patientRef].push(current);
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
