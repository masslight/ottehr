import { BatchInputRequest, FhirClient } from '@zapehr/sdk';
import { Operation } from 'fast-json-patch';
import { Coding, Patient, Person, Practitioner, RelatedPerson, Resource, Appointment, Extension } from 'fhir/r4';
import { FHIR_EXTENSION } from './constants';
export * from './chat';
import { OTTEHR_MODULE } from '../../../ehr-utils';
import { DateTime } from 'luxon';

export interface SingleAppointmentRow {
  id: string | undefined;
  type: string | undefined;
  office: string | undefined;
  dateTime: string | undefined;
  length: number;
}
export function getFirstName(individual: Patient | Practitioner | RelatedPerson | Person): string | undefined {
  return individual.name?.[0]?.given?.[0];
}

export function getLastName(individual: Patient | Practitioner | RelatedPerson | Person): string | undefined {
  return individual.name?.[0]?.family;
}

export const getFullestAvailableName = (
  individual: Patient | Practitioner | RelatedPerson | Person,
): string | undefined => {
  const firstName = getFirstName(individual);
  const lastName = getLastName(individual);
  if (firstName && lastName) {
    return `${firstName} ${lastName}`;
  } else if (firstName) {
    return firstName;
  } else if (lastName) {
    return lastName;
  }
  return undefined;
};

export function filterResources(allResources: Resource[], resourceType: string): Resource[] {
  return allResources.filter((res) => res.resourceType === resourceType && res.id);
}

export const getPatchOperationForNewMetaTag = (resource: Resource, newTag: Coding): Operation => {
  if (resource.meta == undefined) {
    return {
      op: 'add',
      path: '/meta',
      value: {
        tag: [
          {
            ...newTag,
          },
        ],
      },
    };
  } else if (resource.meta?.tag == undefined) {
    return {
      op: 'add',
      path: '/meta/tag',
      value: [
        {
          ...newTag,
        },
      ],
    };
  }
  const currentTags = resource.meta?.tag ?? [];
  const existingTagIdx = currentTags.findIndex((coding) => {
    return coding.system === newTag.system;
  });
  if (existingTagIdx >= 0) {
    return {
      op: 'replace',
      path: `/meta/tag/${existingTagIdx}/code`,
      value: newTag.code,
    };
  } else {
    return {
      op: 'add',
      path: '/meta/tag/-',
      value: newTag,
    };
  }
};

export const getPatchOperationToUpdateExtension = (
  resource: { extension?: Extension[] },
  newExtension: {
    url: Extension['url'];
    valueString?: Extension['valueString'];
    valueBoolean?: Extension['valueBoolean'];
  },
): Operation | undefined => {
  if (!resource.extension) {
    return {
      op: 'add',
      path: '/extension',
      value: [newExtension],
    };
  }

  const extension = resource.extension;
  let requiresUpdate = false;

  if (extension.length > 0) {
    const existingExtIndex = extension.findIndex((ext) => ext.url === newExtension.url);
    // check if formUser exists and needs to be updated and if so, update
    if (
      existingExtIndex >= 0 &&
      (extension[existingExtIndex].valueString !== newExtension.valueString ||
        extension[existingExtIndex].valueBoolean !== newExtension.valueBoolean)
    ) {
      extension[existingExtIndex] = newExtension;
      requiresUpdate = true;
    } else if (existingExtIndex < 0) {
      // if form user does not exist within the extension
      // push to patientExtension array
      extension.push(newExtension);
      requiresUpdate = true;
    }
  } else {
    // since no extensions exist, it must be added via patch operations
    extension.push(newExtension);
    requiresUpdate = true;
  }

  if (requiresUpdate) {
    return {
      op: 'replace',
      path: '/extension',
      value: extension,
    };
  }

  return undefined;
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

export async function getRelatedPersonsForPhoneNumber(
  phoneNumber: string,
  fhirClient: FhirClient,
): Promise<RelatedPerson[] | undefined> {
  const resources: RelatedPerson[] = await fhirClient.searchResources<RelatedPerson>({
    resourceType: 'RelatedPerson',
    searchParams: [
      {
        name: '_has:Person:relatedperson:telecom',
        value: phoneNumber,
      },
    ],
  });
  return resources;
}

export const getUnconfirmedDOBForAppointment = (appointment?: Appointment): string | undefined => {
  if (!appointment) return;
  return appointment.extension?.find((ext) => {
    return ext.url.replace('http:', 'https:') === FHIR_EXTENSION.Appointment.unconfirmedDateOfBirth.url;
  })?.valueString;
};

export const getUnconfirmedDOBIdx = (appointment?: Appointment): number | undefined => {
  if (!appointment) return;
  return appointment.extension?.findIndex((ext) => {
    return ext.url.replace('http:', 'https:') === FHIR_EXTENSION.Appointment.unconfirmedDateOfBirth.url;
  });
};

// TODO: move to types file
export interface LatestAppointment {
  id: string | undefined;
  type: string | undefined;
  dateTime: string | undefined;
  location?: {
    state?: string;
    city?: string;
  };
}

export async function getLatestAppointment(
  fhirClient: FhirClient,
  patientId: string,
): Promise<{ appointment: Appointment; includedResources: Resource[] } | null> {
  try {
    const resources = await fhirClient.searchResources<Resource>({
      resourceType: 'Appointment',
      searchParams: [
        { name: 'patient', value: patientId },
        { name: '_sort', value: '-date' },
        { name: '_count', value: '1' },
        { name: '_include', value: 'Appointment:location' },
        { name: '_include', value: 'Appointment:practitioner' }, // Optional: include practitioner info
        {
          name: '_tag',
          value: `${OTTEHR_MODULE.UC},${OTTEHR_MODULE.TM}`,
        },
      ],
    });

    const appointment = resources.find((r) => r.resourceType === 'Appointment') as Appointment;
    if (!appointment) {
      return null;
    }

    // All other included resources (Location, Practitioner, etc.)
    const includedResources = resources.filter((r) => r.resourceType !== 'Appointment');

    return {
      appointment,
      includedResources,
    };
  } catch (error) {
    console.error('Error fetching latest appointment:', error);
    return null;
  }
}
