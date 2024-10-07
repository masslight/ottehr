import { BatchInputRequest, FhirClient } from '@zapehr/sdk';
import { Operation } from 'fast-json-patch';
import { Coding, Patient, Person, Practitioner, RelatedPerson, Resource, Appointment } from 'fhir/r4';
import { FHIR_EXTENSION } from './constants';
export * from './chat';

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
