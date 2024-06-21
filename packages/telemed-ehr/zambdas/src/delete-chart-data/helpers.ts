import { BatchInputDeleteRequest, BatchInputPutRequest, FhirClient } from '@zapehr/sdk';
import { FhirResource, Resource } from 'fhir/r4';

export function deleteResourceRequest(resourceType: string, resourceId: string): BatchInputDeleteRequest {
  return { method: 'DELETE', url: `/${resourceType}/${resourceId}` };
}

export function updateResourceRequest(resource: FhirResource): BatchInputPutRequest {
  if (!resource.id) throw new Error('A resource must have an ID in order to be updated');
  return {
    method: 'PUT',
    url: `/${resource.resourceType}/${resource.id}`,
    resource: resource,
  };
}

export async function getEncounterAndRelatedResources(
  fhirClient: FhirClient,
  encounterId: string,
): Promise<Resource[]> {
  return await fhirClient.searchResources({
    resourceType: 'Encounter',
    searchParams: [
      {
        name: '_id',
        value: encounterId!,
      },
      {
        name: '_include',
        value: 'Encounter:subject',
      },
      {
        name: '_revinclude:iterate',
        value: 'ServiceRequest:encounter',
      },
      {
        name: '_revinclude:iterate',
        value: 'DocumentReference:encounter',
      },
    ],
  });
}
