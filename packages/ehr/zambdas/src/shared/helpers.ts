import Oystehr, { BatchInputRequest, OystehrConfig } from '@oystehr/sdk';
import { Operation } from 'fast-json-patch';
import { Appointment, Encounter, FhirResource, Meta, RelatedPerson, Resource } from 'fhir/r4b';
import { DateTime } from 'luxon';
import {
  EncounterVirtualServiceExtension,
  PRIVATE_EXTENSION_BASE_URL,
  PUBLIC_EXTENSION_BASE_URL,
  TELEMED_VIDEO_ROOM_CODE,
} from 'utils';
import { getSecret, Secrets, SecretsKeys } from 'zambda-utils';
import { getAuth0Token } from './getAuth0Token';

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

export async function checkOrCreateM2MClientToken(token: string, secrets: Secrets | null): Promise<string> {
  if (!token) {
    console.log('getting m2m token for service calls...');
    return await getAuth0Token(secrets);
  } else {
    console.log('already have a token, no need to update');
  }
  return token;
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
