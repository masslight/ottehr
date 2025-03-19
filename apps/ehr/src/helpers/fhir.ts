import { BatchInputRequest } from '@oystehr/sdk';
import { Operation } from 'fast-json-patch';
import { FhirResource } from 'fhir/r4b';

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
      data: btoa(unescape(encodeURIComponent(JSON.stringify(patchOperations)))),
      contentType: 'application/json-patch+json',
    },
  };
}
