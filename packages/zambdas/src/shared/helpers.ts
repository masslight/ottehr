import Oystehr, { BatchInputRequest, OystehrConfig } from '@oystehr/sdk';
import { captureException } from '@sentry/aws-serverless';
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
  Schedule,
} from 'fhir/r4b';
import { DateTime } from 'luxon';
import {
  BILLING_RESOURCE_TAG,
  EncounterVirtualServiceExtension,
  findQuestionnaireResponseItemLinkId,
  getSecret,
  getTimezone,
  INVALID_INPUT_ERROR,
  pickFirstValueFromAnswerItem,
  PRIVATE_EXTENSION_BASE_URL,
  PUBLIC_EXTENSION_BASE_URL,
  Secrets,
  SecretsKeys,
  TELEMED_VIDEO_ROOM_CODE,
  TIMEZONES,
} from 'utils';
import { ZambdaInput } from './types';
import { safeJsonParse } from './validation';

export const fhirApiUrlFromAuth0Audience = (auth0Audience: string): string => {
  switch (auth0Audience) {
    case 'https://dev.api.zapehr.com':
      return 'https://dev.fhir-api.zapehr.com';
    case 'https://dev2.api.zapehr.com':
      return 'https://dev2.fhir-api.zapehr.com';
    case 'https://testing.api.zapehr.com':
      return 'https://testing.fhir-api.zapehr.com';
    case 'https://staging.api.zapehr.com':
      return 'https://staging.fhir-api.zapehr.com';
    case 'https://api.zapehr.com':
      return 'https://fhir-api.zapehr.com';
    default:
      throw `Unexpected auth0 audience value, could not map to a projectApiUrl. auth0Audience was: ${auth0Audience}`;
  }
};

// todo remove code duplication with configure-secrets
export const projectApiUrlFromAuth0Audience = (auth0Audience: string): string => {
  switch (auth0Audience) {
    case 'https://dev.api.zapehr.com':
      return 'https://dev.project-api.zapehr.com/v1';
    case 'https://dev2.api.zapehr.com':
      return 'https://dev2.project-api.zapehr.com/v1';
    case 'https://testing.api.zapehr.com':
      return 'https://testing.project-api.zapehr.com/v1';
    case 'https://staging.api.zapehr.com':
      return 'https://staging.project-api.zapehr.com/v1';
    case 'https://api.zapehr.com':
      return 'https://project-api.zapehr.com/v1';
    default:
      throw `Unexpected auth0 audience value, could not map to a projectApiUrl. auth0Audience was: ${auth0Audience}`;
  }
};

export function createClinicalOystehrClient(
  token: string | undefined,
  secrets: Secrets | null,
  overrides?: Partial<OystehrConfig>
): Oystehr {
  return new Oystehr({
    accessToken: token,
    services: {
      fhirApiUrl: fhirApiUrlFromAuth0Audience(getSecret(SecretsKeys.AUTH0_AUDIENCE, secrets)),
      projectApiUrl: projectApiUrlFromAuth0Audience(getSecret(SecretsKeys.AUTH0_AUDIENCE, secrets)),
    },
    ...overrides,
    ignoreTags: [...(overrides?.ignoreTags ?? []), BILLING_RESOURCE_TAG],
  });
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
    // eslint-disable-next-line @typescript-eslint/no-require-imports
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

export const RCM_TAG_SYSTEM = `${PRIVATE_EXTENSION_BASE_URL}/rcm`;

export const rcmMeta = (
  type: 'fee-schedule' | 'charge-master' | 'invoice-config' | 'scheduled-outreach-config'
): Meta => ({
  tag: [
    { system: RCM_TAG_SYSTEM, code: 'rcm' },
    { system: RCM_TAG_SYSTEM, code: type },
  ],
});

export function assertDefined<T>(value: T, name: string): NonNullable<T> {
  if (value == null) {
    throw new Error(`"${name}" is undefined`);
  }
  return value;
}

export const validateString = (value: any, propertyName: string): string => {
  if (typeof value !== 'string') {
    throw INVALID_INPUT_ERROR(`"${propertyName}" property must be a string`);
  }
  return value;
};

export function validateJsonBody(input: ZambdaInput): any {
  if (!input.body) {
    throw INVALID_INPUT_ERROR('Request body is required');
  }
  try {
    return safeJsonParse(input.body);
  } catch {
    throw INVALID_INPUT_ERROR('Invalid JSON in request body');
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
  } catch (e) {
    console.log('Location other-offices extension is formatted incorrectly');
    captureException(e);
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

export function resolveTimezone(schedule?: Schedule, location?: Location, fallback: string = TIMEZONES[0]): string {
  if (schedule) {
    return getTimezone(schedule);
  }
  if (location) {
    return getTimezone(location);
  }
  return fallback;
}
