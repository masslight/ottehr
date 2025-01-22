import { AppClient, BatchInputRequest, ClientConfig, FhirClient } from '@zapehr/sdk';
import { Operation } from 'fast-json-patch';
import { Appointment, Encounter, Person, RelatedPerson, Resource } from 'fhir/r4';
import { DateTime } from 'luxon';
import {
  EncounterVirtualServiceExtension,
  PUBLIC_EXTENSION_BASE_URL,
  Secrets,
  TELEMED_VIDEO_ROOM_CODE,
  UCAppointmentInformation,
  VisitStatusHistoryEntry,
} from 'ehr-utils';
import { ENCOUNTER_VS_EXTENSION_CONVO_RELATIVE_URL, ENCOUNTER_VS_EXTENSION_URL } from './constants';
import { getAuth0Token as getM2MClientToken } from './getAuth0Token';
import { SecretsKeys, getSecret } from './secrets';

export function createFhirClient(token: string, secrets: Secrets | null): FhirClient {
  const FHIR_API = getSecret(SecretsKeys.FHIR_API, secrets).replace(/\/r4/g, '');
  const CLIENT_CONFIG: ClientConfig = {
    apiUrl: FHIR_API,
    accessToken: token,
  };
  return new FhirClient(CLIENT_CONFIG);
}

export function createAppClient(token: string, secrets: Secrets | null): AppClient {
  const PROJECT_API = getSecret(SecretsKeys.PROJECT_API, secrets);
  const CLIENT_CONFIG: ClientConfig = {
    apiUrl: PROJECT_API,
    accessToken: token,
  };
  return new AppClient(CLIENT_CONFIG);
}

export async function checkOrCreateM2MClientToken(token: string, secrets: Secrets | null): Promise<string> {
  if (!token) {
    console.log('getting m2m token for service calls...');
    return await getM2MClientToken(secrets);
  } else {
    console.log('already have a token, no need to update');
  }
  return token;
}

export const CancellationReasonCodes = {
  'Patient improved': 'patient-improved',
  'Wait time too long': 'wait-time',
  'Prefer another urgent care provider': 'prefer-another-provider',
  'Changing location': 'changing-location',
  'Changing to telemedicine': 'changing-telemedicine',
  'Financial responsibility concern': 'financial-concern',
  'Insurance issue': 'insurance-issue',
};

export async function updateApptAndEncounterStatus(
  fhirClient: FhirClient,
  appointmentId: string,
  appointmentStatus: string,
  encounterStatus: string,
): Promise<void> {
  let arrivedIdx = 0;
  await fhirClient.patchResource({
    resourceType: 'Appointment',
    resourceId: appointmentId ?? '',
    operations: [
      {
        op: 'replace',
        path: '/status',
        value: appointmentStatus,
      },
    ],
  });
  const res: Encounter[] = await fhirClient.searchResources({
    resourceType: 'Encounter',
    searchParams: [
      {
        name: 'appointment',
        value: `Appointment/${appointmentId}`,
      },
    ],
  });

  const encounter = res[0];

  if (encounter.statusHistory) {
    const arrivedHistory = encounter.statusHistory?.find((history) => history.status === 'arrived');
    arrivedIdx = arrivedHistory ? encounter.statusHistory.indexOf(arrivedHistory) : -1;
  } else {
    throw new Error('Encounter status history not found');
  }

  await fhirClient.patchResource({
    resourceType: 'Encounter',
    resourceId: encounter.id ?? '',
    operations: [
      {
        op: 'add',
        path: `/statusHistory/${arrivedIdx}/period/end`,
        value: DateTime.now().toISO(),
      },
      {
        op: 'replace',
        path: '/status',
        value: encounterStatus,
      },
      {
        op: 'add',
        path: `/statusHistory/${arrivedIdx + 1}`,
        value: {
          status: encounterStatus,
          period: {
            start: DateTime.now().toISO(),
          },
        },
      },
    ],
  });
}

const getTwilioConversationIdFromEncounter = (resource: Resource): string | undefined => {
  if (resource.resourceType !== 'Encounter') {
    return undefined;
  }
  const encounter = resource as Encounter;
  const extensions = encounter.extension ?? [];

  const vrExtension = extensions.find((ext) => {
    return ext.url === ENCOUNTER_VS_EXTENSION_URL;
  });

  if (!vrExtension) {
    return undefined;
  }
  const innerExtensions = vrExtension.extension ?? [];
  return innerExtensions.find((innerExt) => {
    return innerExt.url === ENCOUNTER_VS_EXTENSION_CONVO_RELATIVE_URL;
  })?.valueString;
};

export const isConversationEncounter = (resource: Resource): boolean => {
  if (resource.resourceType !== 'Encounter') {
    return false;
  }
  const encounter = resource as Encounter;
  return getTwilioConversationIdFromEncounter(encounter) !== undefined;
};

export interface SMSModel {
  // eventually we won't need both of these but it might be useful to have the smsNumber extracted out as a handy key anyway
  relatedPersonParticipant: string;
  smsNumber: string;
  hasUnreadMessages: boolean;
}

export const getPersonsFromResourceList = (resources: Resource[]): Person[] => {
  return resources.filter((res) => res.resourceType === 'Person') as Person[];
};

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
    mapToReturn,
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

export const getDurationOfStatus = (
  statusEntry: VisitStatusHistoryEntry,
  appointment: UCAppointmentInformation,
): number => {
  const { label, period } = statusEntry;
  const { start, visitStatusHistory } = appointment;

  if (label === 'pending') {
    if (period.end) {
      return getMinutesDifference(period.end, start);
    } else if (period.start) {
      return getCurrentTimeDifference(start);
    }
  }

  if (period.start && period.end) {
    return getMinutesDifference(period.start, period.end);
  } else if (period.start) {
    const stopCountingForStatus = ['canceled', 'no show', 'checked out'];

    if (stopCountingForStatus.includes(label)) {
      const prevStatusHistoryIdx = visitStatusHistory.length - 2;
      const prevEntry = visitStatusHistory[prevStatusHistoryIdx];
      return prevEntry ? getMinutesDifference(period.start, prevEntry.period.end || '') : 0;
    } else {
      return getCurrentTimeDifference(period.start);
    }
  } else {
    return 0;
  }
};

export interface GetPatchBinaryInput {
  resourceId: string;
  resourceType: string;
  patchOperations: Operation[];
}

export function getPatchBinary(input: GetPatchBinaryInput): BatchInputRequest {
  const { resourceId, resourceType, patchOperations } = input;
  return {
    method: 'PATCH',
    url: `/${resourceType}/${resourceId}`,
    resource: {
      resourceType: 'Binary',
      data: btoa(unescape(encodeURIComponent(JSON.stringify(patchOperations)))),
      contentType: 'application/json-patch+json',
    },
  };
}
